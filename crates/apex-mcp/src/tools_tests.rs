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
fn a_named_pane_travels_with_the_view_and_the_reads() {
    let me = caller(session("claude", None));
    let opening = json!({ "kind": "url", "url": "http://localhost:6006", "name": "storybook" });
    assert!(matches!(
        command_for(&me, "apex_open_view", &opening).expect("command"),
        Command::OpenView { target: ViewTarget::Url { name: Some(name), .. }, .. }
            if name == "storybook"
    ));
    assert!(matches!(
        command_for(&me, "apex_browser_shot", &json!({ "pane": "storybook" })).expect("command"),
        Command::BrowserShot { pane: Some(pane), .. } if pane == "storybook"
    ));
    assert!(matches!(
        command_for(&me, "apex_browser_read", &json!({})).expect("command"),
        Command::BrowserRead { pane: None, .. }
    ));
}
