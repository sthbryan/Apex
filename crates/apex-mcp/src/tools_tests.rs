use super::*;
use apex_proto::{SessionState, TerminalSize, WorktreeInfo};

fn session(title: &str, worktree: Option<WorktreeInfo>) -> SessionSummary {
    SessionSummary {
        id: Uuid::new_v4(),
        project_id: Uuid::nil(),
        agent: "claude".into(),
        title: title.into(),
        cwd: "/tmp/project".into(),
        started_at: 1_700_000_000,
        state: SessionState::Working,
        size: TerminalSize::default(),
        exit_code: None,
        worktree,
        task: None,
        mode: apex_proto::AgentMode::Pty,
        parent: None,
        run: None,
        url: None,
        tools_off: Vec::new(),
    }
}

fn caller(summary: SessionSummary) -> Caller {
    Caller {
        session: summary.id,
        project: summary.project_id,
        title: summary.title.clone(),
        summary,
    }
}

#[test]
fn every_tool_publishes_an_object_schema() {
    for tool in TOOLS {
        let schema = (tool.schema)();
        assert_eq!(schema["type"], "object", "{} has no object schema", tool.name);
        assert!(!tool.description.is_empty());
    }
}

#[test]
fn reading_without_a_key_lists_the_context() {
    let me = caller(session("claude", None));
    assert!(matches!(
        command_for(&me, "apex_context_read", &json!({})).expect("command"),
        Command::ContextList { .. }
    ));
    assert!(matches!(
        command_for(&me, "apex_context_read", &json!({ "key": "architecture" })).expect("command"),
        Command::ContextRead { key, .. } if key == "architecture"
    ));
}

#[test]
fn a_note_is_signed_with_the_calling_session() {
    let me = caller(session("codex 2", None));
    let command = command_for(&me, "apex_note", &json!({ "message": "done" })).expect("command");
    assert!(matches!(command, Command::ContextNote { from, to: None, .. } if from == "codex 2"));
}

#[test]
fn missing_arguments_are_refused_before_reaching_the_daemon() {
    let me = caller(session("claude", None));
    assert!(command_for(&me, "apex_context_write", &json!({ "key": "a" })).is_err());
    assert!(command_for(&me, "apex_session_transcript", &json!({ "session": "nope" })).is_err());
    assert!(command_for(&me, "apex_unknown", &json!({})).is_err());
}

#[test]
fn the_listing_hides_the_caller_and_other_projects() {
    let me = caller(session("claude", None));
    let mate = session("codex", None);
    let stranger = SessionSummary { project_id: Uuid::new_v4(), ..session("elsewhere", None) };

    let text = describe_sessions(&me, &[me.summary.clone(), mate.clone(), stranger]);
    assert!(text.contains("codex"));
    assert!(!text.contains("elsewhere"));
    assert!(!text.contains(&me.session.to_string()));
    assert!(text.contains(&mate.id.to_string()));

    assert_eq!(
        describe_sessions(&me, std::slice::from_ref(&me.summary)),
        "No other agents are running on this project."
    );
}

#[test]
fn the_worktree_answer_says_whether_you_are_isolated() {
    let isolated = caller(session(
        "claude",
        Some(WorktreeInfo { path: "/tmp/wt".into(), branch: "apex/claude".into() }),
    ));
    assert!(describe_worktree(&isolated).contains("apex/claude"));
    assert!(describe_worktree(&isolated).contains("cannot collide"));

    let shared = caller(session("claude", None));
    assert!(describe_worktree(&shared).contains("/tmp/project"));
}

#[test]
fn opening_and_closing_a_view_share_the_same_target() {
    let me = caller(session("claude", None));
    let args = json!({ "kind": "url", "url": "http://localhost:5173" });
    assert!(matches!(
        command_for(&me, "apex_open_view", &args).expect("command"),
        Command::OpenView { target: ViewTarget::Url { url, .. }, .. } if url == "http://localhost:5173"
    ));
    assert!(matches!(
        command_for(&me, "apex_close_view", &args).expect("command"),
        Command::CloseView { target: ViewTarget::Url { url, .. }, .. } if url == "http://localhost:5173"
    ));
    assert!(command_for(&me, "apex_close_view", &json!({ "kind": "url" })).is_err());
}

#[test]
fn a_preview_carries_the_file() {
    let me = caller(session("claude", None));
    assert!(matches!(
        command_for(&me, "apex_preview", &json!({ "path": "index.html" })).expect("command"),
        Command::Preview { path, .. } if path == "index.html"
    ));
    assert!(command_for(&me, "apex_preview", &json!({})).is_err());
}

#[test]
fn the_preview_tool_says_where_to_write_the_page() {
    let told = TOOLS.iter().find(|tool| tool.name == "apex_preview").expect("tool");
    assert!(told.description.contains(".apex/preview"), "{}", told.description);
    assert!(told.description.contains("APEX_PREVIEW_DIR"), "{}", told.description);
    assert!(told.description.contains("apex_close_view"), "{}", told.description);
}

#[test]
fn the_view_tools_take_no_pane_name() {
    let me = caller(session("claude", None));
    let opening = json!({ "kind": "url", "url": "http://localhost:6006", "name": "storybook" });
    assert!(matches!(
        command_for(&me, "apex_open_view", &opening).expect("command"),
        Command::OpenView { target: ViewTarget::Url { url }, .. } if url == "http://localhost:6006"
    ));
    for name in ["apex_open_view", "apex_close_view", "apex_preview"] {
        let tool = TOOLS.iter().find(|tool| tool.name == name).expect("tool");
        let schema = (tool.schema)();
        assert!(schema["properties"].get("name").is_none(), "{name}");
    }
}

#[test]
fn the_browser_reads_take_no_arguments() {
    let me = caller(session("claude", None));
    assert!(matches!(
        command_for(&me, "apex_browser_shot", &json!({ "pane": "storybook" })).expect("command"),
        Command::BrowserShot { .. }
    ));
    assert!(matches!(
        command_for(&me, "apex_browser_console", &json!({})).expect("command"),
        Command::BrowserLogs { .. }
    ));
    assert!(matches!(
        command_for(&me, "apex_browser_page", &json!({})).expect("command"),
        Command::BrowserPage { .. }
    ));
    for tool in TOOLS.iter().filter(|tool| tool.name.starts_with("apex_browser_")) {
        let schema = (tool.schema)();
        assert!(schema["properties"].as_object().expect("properties").is_empty(), "{}", tool.name);
    }
}

#[test]
fn a_request_carries_its_name_and_environment() {
    let me = caller(session("claude", None));
    assert!(matches!(
        command_for(&me, "apex_request", &json!({ "name": "create user" })).expect("command"),
        Command::ApiSend { name, environment: None, .. } if name == "create user"
    ));
    assert!(matches!(
        command_for(&me, "apex_request", &json!({ "name": "me", "environment": "local" }))
            .expect("command"),
        Command::ApiSend { environment: Some(env), .. } if env == "local"
    ));
    assert!(command_for(&me, "apex_request", &json!({})).is_err());
}

#[test]
fn the_request_tool_sends_you_to_the_write_tool_and_not_to_a_folder() {
    let told = TOOLS.iter().find(|tool| tool.name == "apex_request").expect("tool");
    assert!(told.description.contains("apex_api_write"), "{}", told.description);
    assert!(!told.description.contains("APEX_API_DIR"), "{}", told.description);
    assert_eq!(told.group, apex_proto::ToolGroup::Api);
}

#[test]
fn every_api_tool_shares_the_group_that_can_be_turned_off() {
    let named: Vec<&str> = TOOLS
        .iter()
        .filter(|tool| tool.group == apex_proto::ToolGroup::Api)
        .map(|t| t.name)
        .collect();
    assert_eq!(named, vec!["apex_api_read", "apex_api_write", "apex_api_remove", "apex_request"]);
}

#[test]
fn writing_a_request_takes_the_headers_as_they_come() {
    let me = caller(session("claude", None));
    let asked = json!({
        "name": "create user",
        "url": "https://{{host}}/users",
        "method": "POST",
        "headers": { "Content-Type": "application/json" },
        "body": "{}"
    });
    let Command::ApiWrite { name, request, .. } =
        command_for(&me, "apex_api_write", &asked).expect("command")
    else {
        panic!("not a write")
    };
    assert_eq!(name, "create user");
    assert_eq!(request.method, "POST");
    assert_eq!(request.headers["Content-Type"], "application/json");
    assert_eq!(request.body.as_deref(), Some("{}"));
}

#[test]
fn a_written_request_without_a_verb_is_a_get() {
    let me = caller(session("claude", None));
    let asked = json!({ "name": "ping", "url": "http://localhost:3000/health" });
    let Command::ApiWrite { request, .. } =
        command_for(&me, "apex_api_write", &asked).expect("command")
    else {
        panic!("not a write")
    };
    assert_eq!(request.method, "GET");
    assert!(request.headers.is_empty());
    assert_eq!(request.body, None);
}

#[test]
fn a_header_that_is_not_a_string_is_refused() {
    let me = caller(session("claude", None));
    let asked = json!({ "name": "ping", "url": "http://x", "headers": { "Accept": 7 } });
    let trouble = command_for(&me, "apex_api_write", &asked).expect_err("a number header");
    assert!(trouble.to_string().contains("Accept"), "{trouble}");
}

#[test]
fn reading_without_a_name_lists_the_collection() {
    let me = caller(session("claude", None));
    assert!(matches!(
        command_for(&me, "apex_api_read", &json!({})).expect("command"),
        Command::ApiList { .. }
    ));
    assert!(matches!(
        command_for(&me, "apex_api_read", &json!({ "name": "ping" })).expect("command"),
        Command::ApiRead { name, .. } if name == "ping"
    ));
}

#[test]
fn removing_names_the_request_it_takes_away() {
    let me = caller(session("claude", None));
    let command = command_for(&me, "apex_api_remove", &json!({ "name": "ping" })).expect("command");
    assert!(matches!(command, Command::ApiRemove { name, .. } if name == "ping"));
    assert!(command_for(&me, "apex_api_remove", &json!({})).is_err());
}

#[test]
fn a_written_request_needs_a_url() {
    let me = caller(session("claude", None));
    assert!(command_for(&me, "apex_api_write", &json!({ "name": "ping" })).is_err());
}

#[test]
fn a_run_reads_as_status_timing_and_body() {
    let run = apex_proto::ApiRun {
        name: "create user".into(),
        method: "POST".into(),
        url: "http://localhost:3000/users".into(),
        status: 201,
        millis: 12,
        at: 0,
        headers: Vec::new(),
        body: "{\"id\":7}".into(),
        truncated: false,
        size: 8,
    };
    let told = describe_run(&run);
    assert!(told.contains("POST http://localhost:3000/users answered 201 in 12ms"), "{told}");
    assert!(told.contains("{\"id\":7}"), "{told}");
    assert!(!told.contains("cut short"), "{told}");

    let empty = apex_proto::ApiRun { body: String::new(), ..run.clone() };
    assert!(describe_run(&empty).contains("with no body"));

    let cut = apex_proto::ApiRun { truncated: true, ..run };
    assert!(describe_run(&cut).contains("cut short"));
}
