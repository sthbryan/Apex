use super::*;
use apex_proto::{ContextEntry, SessionState, SessionSummary, TerminalSize, ToolGroup};

struct Fake {
    seen: Vec<Command>,
    reply: Reply,
}

impl Daemon for Fake {
    async fn request(&mut self, command: Command) -> Result<Reply> {
        self.seen.push(command);
        Ok(self.reply.clone())
    }
}

fn caller() -> Caller {
    let summary = SessionSummary {
        id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        agent: "claude".into(),
        title: "claude".into(),
        cwd: "/tmp/project".into(),
        started_at: 1_700_000_000,
        state: SessionState::Working,
        size: TerminalSize::default(),
        exit_code: None,
        worktree: None,
        task: None,
        mode: apex_proto::AgentMode::Pty,
        parent: None,
        run: None,
        url: None,
        tools_off: Vec::new(),
    };
    Caller {
        session: summary.id,
        project: summary.project_id,
        title: summary.title.clone(),
        summary,
    }
}

async fn exchange(daemon: &mut Fake, request: Value) -> Value {
    exchange_as(daemon, caller(), request).await
}

fn caller_without(off: &[ToolGroup]) -> Caller {
    let mut caller = caller();
    caller.summary.tools_off = off.to_vec();
    caller
}

async fn exchange_as(daemon: &mut Fake, caller: Caller, request: Value) -> Value {
    let line = request.to_string();
    let answer = answer(daemon, &caller, &line).await.expect("a response");
    serde_json::from_str(&answer).expect("json")
}

fn listed(answer: &Value) -> Vec<String> {
    answer["result"]["tools"]
        .as_array()
        .expect("tools")
        .iter()
        .map(|tool| tool["name"].as_str().expect("name").to_owned())
        .collect()
}

fn summary_in(cwd: &str, title: &str) -> SessionSummary {
    SessionSummary {
        id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        agent: "opencode".into(),
        title: title.into(),
        cwd: cwd.into(),
        started_at: 1_700_000_000,
        state: SessionState::Working,
        size: TerminalSize::default(),
        exit_code: None,
        worktree: None,
        task: None,
        mode: apex_proto::AgentMode::Pty,
        parent: None,
        run: None,
        url: None,
        tools_off: Vec::new(),
    }
}

struct Listing(Vec<SessionSummary>);

impl Daemon for Listing {
    async fn request(&mut self, _command: Command) -> Result<Reply> {
        Ok(Reply::Sessions { sessions: self.0.clone() })
    }
}

#[tokio::test]
async fn a_stale_session_id_falls_back_to_whoever_runs_here() {
    let dir = tempfile::tempdir().expect("tempdir");
    let here = summary_in(&dir.path().display().to_string(), "opencode 2");
    let mut daemon = Listing(vec![here.clone()]);

    let caller = caller_for(&mut daemon, Some(Uuid::new_v4()), dir.path())
        .await
        .expect("the dead id should not sink us");
    assert_eq!(caller.session, here.id);
    assert_eq!(caller.title, "opencode 2");
}

#[tokio::test]
async fn without_an_id_the_folder_says_who_is_calling() {
    let dir = tempfile::tempdir().expect("tempdir");
    let elsewhere = summary_in("/somewhere/else", "grok");
    let here = summary_in(&dir.path().display().to_string(), "opencode");
    let mut daemon = Listing(vec![elsewhere, here.clone()]);

    let caller = caller_for(&mut daemon, None, dir.path()).await.expect("resolved");
    assert_eq!(caller.session, here.id);
}

#[tokio::test]
async fn a_finished_session_does_not_answer_for_the_folder() {
    let dir = tempfile::tempdir().expect("tempdir");
    let gone = SessionSummary {
        exit_code: Some(0),
        ..summary_in(&dir.path().display().to_string(), "opencode")
    };
    let mut daemon = Listing(vec![gone]);

    assert!(caller_for(&mut daemon, None, dir.path()).await.is_err());
}

#[tokio::test]
async fn initialize_announces_tools_and_the_protocol() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer =
        exchange(&mut daemon, json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize" })).await;

    assert_eq!(answer["result"]["protocolVersion"], PROTOCOL_VERSION);
    assert_eq!(answer["result"]["serverInfo"]["name"], SERVER_NAME);
    assert!(answer["result"]["capabilities"]["tools"].is_object());
}

#[tokio::test]
async fn the_tool_list_carries_every_tool_with_its_schema() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer =
        exchange(&mut daemon, json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" })).await;

    let listed = answer["result"]["tools"].as_array().expect("tools").len();
    assert_eq!(listed, TOOLS.len());
    assert!(answer["result"]["tools"][0]["inputSchema"].is_object());
}

#[tokio::test]
async fn a_notification_gets_no_answer() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let line = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }).to_string();
    assert!(answer(&mut daemon, &caller(), &line).await.is_none());
}

#[tokio::test]
async fn writing_context_reaches_the_daemon_and_reports_back() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer = exchange(
        &mut daemon,
        json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "apex_context_write",
                "arguments": { "key": "findings", "content": "# Found\n" }
            }
        }),
    )
    .await;

    assert_eq!(answer["result"]["isError"], false);
    assert!(matches!(
        daemon.seen.first().expect("a command"),
        Command::ContextWrite { key, contents, .. } if key == "findings" && contents == "# Found\n"
    ));
}

#[tokio::test]
async fn an_empty_context_tells_the_agent_to_start_it() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Context { entries: Vec::new() } };
    let answer = exchange(
        &mut daemon,
        json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": { "name": "apex_context_read", "arguments": {} }
        }),
    )
    .await;

    let text = answer["result"]["content"][0]["text"].as_str().expect("text");
    assert!(text.contains("empty"));
}

#[tokio::test]
async fn a_listing_is_rendered_for_the_agent_to_read() {
    let entries = vec![ContextEntry { key: "architecture".into(), bytes: 42, updated_at: 0 }];
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Context { entries } };
    let answer = exchange(
        &mut daemon,
        json!({
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": { "name": "apex_context_read", "arguments": {} }
        }),
    )
    .await;

    assert!(
        answer["result"]["content"][0]["text"].as_str().expect("text").contains("architecture")
    );
}

#[tokio::test]
async fn a_failing_tool_answers_as_an_error_not_a_crash() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer = exchange(
        &mut daemon,
        json!({
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": { "name": "apex_context_write", "arguments": {} }
        }),
    )
    .await;

    assert_eq!(answer["result"]["isError"], true);
    assert!(daemon.seen.is_empty(), "the daemon should not have been called");
}

#[tokio::test]
async fn the_worktree_tool_answers_without_touching_the_daemon() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer = exchange(
        &mut daemon,
        json!({
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": { "name": "apex_worktree_info", "arguments": {} }
        }),
    )
    .await;

    assert!(
        answer["result"]["content"][0]["text"].as_str().expect("text").contains("/tmp/project")
    );
    assert!(daemon.seen.is_empty());
}

#[tokio::test]
async fn broken_json_is_answered_with_a_parse_error() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer = answer(&mut daemon, &caller(), "{not json").await.expect("a response");
    let parsed: Value = serde_json::from_str(&answer).expect("json");
    assert_eq!(parsed["error"]["code"], -32700);
}

#[tokio::test]
async fn a_conversation_over_the_pipe_answers_every_request() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let input = format!(
        "{}\n{}\n{}\n",
        json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize" }),
        json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
    );
    let mut output = Vec::new();
    serve(&mut daemon, &caller(), input.as_bytes(), &mut output).await.expect("served");

    let text = String::from_utf8(output).expect("utf8");
    let answers: Vec<&str> = text.lines().collect();
    assert_eq!(answers.len(), 2, "the notification should not be answered");
    assert!(answers[0].contains("serverInfo"));
    assert!(answers[1].contains("apex_context_read"));
}

#[tokio::test]
async fn a_group_that_is_off_leaves_the_tool_list() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer = exchange_as(
        &mut daemon,
        caller_without(&[ToolGroup::Browser]),
        json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
    )
    .await;

    let names = listed(&answer);
    assert_eq!(names.len(), TOOLS.len() - 3);
    assert!(!names.iter().any(|name| name.starts_with("apex_browser_")));
    assert!(names.iter().any(|name| name == "apex_context_read"));
}

#[tokio::test]
async fn the_groups_that_cannot_be_turned_off_survive_every_other_one() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer = exchange_as(
        &mut daemon,
        caller_without(ToolGroup::OPTIONAL),
        json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
    )
    .await;

    assert_eq!(
        listed(&answer),
        ["apex_context_read", "apex_context_write", "apex_done", "apex_worktree_info"]
    );
}

#[tokio::test]
async fn a_hidden_tool_is_refused_when_a_stale_list_still_calls_it() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    let answer = exchange_as(
        &mut daemon,
        caller_without(&[ToolGroup::Orchestration]),
        json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": { "name": "apex_agents_list", "arguments": {} }
        }),
    )
    .await;

    assert_eq!(answer["result"]["isError"], true);
    assert!(
        answer["result"]["content"][0]["text"].as_str().expect("text").contains("unknown tool")
    );
    assert!(daemon.seen.is_empty());
}

#[tokio::test]
async fn a_group_left_on_still_reaches_the_daemon() {
    let mut daemon = Fake { seen: Vec::new(), reply: Reply::Done };
    exchange_as(
        &mut daemon,
        caller_without(&[ToolGroup::Browser]),
        json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": { "name": "apex_agents_list", "arguments": {} }
        }),
    )
    .await;

    assert_eq!(daemon.seen, vec![Command::ListAgents]);
}
