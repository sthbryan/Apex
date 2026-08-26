mod common;

use apex_proto::{Isolation, SessionState, TerminalSize};
use apexd::sessions::NewSession;
use common::{Harness, wait_for_state};

#[tokio::test]
async fn an_acp_session_streams_its_answer_and_waits_for_permission() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    assert_eq!(session.mode, apex_proto::AgentMode::Acp);
    assert!(harness.manager.acp_snapshot(session.id).await.expect("transcript").entries.is_empty());

    harness.manager.acp_prompt(session.id, "change hello".into()).await.expect("prompt");
    wait_for_state(&harness.manager, session.id, SessionState::Blocked).await;

    let snapshot = harness.manager.acp_snapshot(session.id).await.expect("transcript");
    assert_eq!(snapshot.commands.len(), 1);
    assert_eq!(snapshot.commands[0].name, "compact");
    assert_eq!(snapshot.commands[0].description, "Shrink the context");
    let entries = snapshot.entries;
    assert_eq!(entries[0].body, apex_proto::AcpBody::User { text: "change hello".into() });
    assert_eq!(entries[1].body, apex_proto::AcpBody::Agent { text: "on it".into() });

    let apex_proto::AcpBody::Tool { call } = &entries[2].body else {
        panic!("expected a tool call, got {:?}", entries[2].body);
    };
    assert_eq!(call.diffs[0].new_text, "two");
    assert_eq!(call.status, apex_proto::AcpToolStatus::Running);

    let apex_proto::AcpBody::Permission { ask } = &entries[3].body else {
        panic!("expected a permission, got {:?}", entries[3].body);
    };
    assert_eq!(ask.decided, None);
    assert_eq!(ask.options[0].id, "allow_once");

    harness
        .manager
        .acp_decide(session.id, ask.request, Some("allow_once".into()))
        .await
        .expect("decide");
    wait_for_state(&harness.manager, session.id, SessionState::Done).await;

    let settled = harness.manager.acp_snapshot(session.id).await.expect("transcript").entries;
    let apex_proto::AcpBody::Permission { ask } = &settled[3].body else {
        panic!("expected a permission");
    };
    assert_eq!(ask.decided.as_deref(), Some("allow_once"));

    let apex_proto::AcpBody::Tool { call } = &settled[2].body else {
        panic!("expected a tool call");
    };
    assert_eq!(call.status, apex_proto::AcpToolStatus::Completed);
    assert_eq!(call.diffs[0].new_text, "two");
    assert_eq!(settled.len(), 4);
}

#[tokio::test]
async fn an_acp_agent_that_dies_leaves_its_session_marked_as_finished() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    harness.manager.acp_prompt(session.id, "walk out".into()).await.expect("prompt");
    wait_for_state(&harness.manager, session.id, SessionState::Done).await;

    let listed = harness.manager.list_sessions().await;
    let found = listed.iter().find(|candidate| candidate.id == session.id).expect("the session");
    assert_eq!(found.exit_code, Some(3));
    assert!(!found.is_alive());
}

#[tokio::test]
async fn closing_an_acp_session_stops_its_agent_and_forgets_it() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    assert!(harness.manager.list_sessions().await.iter().any(|found| found.id == session.id));

    harness.manager.close(session.id, apex_proto::WorktreeDisposal::Keep).await.expect("close");

    assert!(!harness.manager.list_sessions().await.iter().any(|found| found.id == session.id));
    assert!(harness.manager.acp_snapshot(session.id).await.is_err());
}

#[tokio::test]
async fn an_acp_session_is_handed_the_apex_mcp_server() {
    let room = tempfile::tempdir().expect("tempdir");
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some(room.path().display().to_string()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    let seen = std::fs::read_to_string(room.path().join("session-new.json"))
        .expect("the agent recorded session/new");
    assert!(seen.contains("\"name\":\"apex\""), "no apex server in {seen}");
    assert!(seen.contains("\"type\":\"http\""), "this agent takes http, got {seen}");
    assert!(seen.contains("http://127.0.0.1:"), "no local url in {seen}");
    assert!(seen.contains("Bearer "), "no token in {seen}");
    let _ = session;
}

#[tokio::test]
async fn an_acp_agent_that_never_greets_leaves_no_session_behind() {
    let harness = Harness::start().await;
    let failure = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-mute".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect_err("the handshake cannot succeed");

    let told = format!("{failure:#}");
    assert!(told.contains("cannot reach the model"), "the agent complaint is missing from {told}");
    assert!(harness.manager.list_sessions().await.is_empty());
}

#[tokio::test]
async fn an_agent_that_takes_its_time_to_greet_does_not_freeze_the_rest() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    client.next += 1;
    let id = apex_proto::RequestId(client.next);
    client
        .connection
        .send_control(&apex_proto::ClientMessage::Request {
            id,
            command: apex_proto::Command::SessionCreate {
                mode: None,
                isolation: Isolation::Directory,
                slug: None,
                project: harness.project,
                agent: "acp-mummy".into(),
                cwd: Some("/tmp".into()),
                size: TerminalSize::default(),
            },
        })
        .await
        .expect("the slow request");

    assert_eq!(client.request(apex_proto::Command::Ping).await, apex_proto::Reply::Pong);
    assert_eq!(
        client.request(apex_proto::Command::ListSessions).await,
        apex_proto::Reply::Sessions { sessions: vec![] }
    );
}

#[tokio::test]
async fn an_agent_that_answers_nothing_says_so_in_the_transcript() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-quiet".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    harness.manager.acp_prompt(session.id, "are you there".into()).await.expect("prompt");
    wait_for_state(&harness.manager, session.id, SessionState::Done).await;

    let entries = harness.manager.acp_snapshot(session.id).await.expect("transcript").entries;
    let apex_proto::AcpBody::Notice { text } = &entries[1].body else {
        panic!("expected a notice, got {:?}", entries[1].body);
    };
    assert!(text.contains("without saying anything"), "unhelpful notice: {text}");
    assert!(text.contains("opencode auth login"), "the sign in hint is missing from {text}");
}

#[tokio::test]
async fn the_models_an_acp_agent_offers_can_be_switched() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    let models = harness.manager.acp_snapshot(session.id).await.expect("snapshot").models;
    assert_eq!(models.chosen.as_deref(), Some("fast"));
    assert_eq!(models.choices.len(), 2);
    assert_eq!(models.choices[1].name, "Deep");

    harness.manager.acp_choose(session.id, Some("deep".into()), None).await.expect("choose");
    let after = harness.manager.acp_snapshot(session.id).await.expect("snapshot").models;
    assert_eq!(after.chosen.as_deref(), Some("deep"));
}

#[tokio::test]
async fn the_http_mcp_endpoint_turns_away_a_caller_without_the_token() {
    let room = tempfile::tempdir().expect("tempdir");
    let harness = Harness::start().await;
    harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some(room.path().display().to_string()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    let seen = std::fs::read_to_string(room.path().join("session-new.json")).expect("session/new");
    let offered: serde_json::Value = serde_json::from_str(&seen).expect("json");
    let url = offered["params"]["mcpServers"][0]["url"].as_str().expect("a url").to_owned();
    let port: u16 = url.rsplit(':').next().unwrap().trim_end_matches("/mcp").parse().expect("port");

    let body = serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }).to_string();
    let refused = ask(port, "not-a-token", &body).await;
    assert!(refused.contains("401"), "an unknown token got in: {refused}");
}

#[tokio::test]
async fn the_http_mcp_endpoint_serves_its_tools_to_the_token_it_issued() {
    let room = tempfile::tempdir().expect("tempdir");
    let harness = Harness::start().await;
    harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some(room.path().display().to_string()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("create");

    let seen = std::fs::read_to_string(room.path().join("session-new.json")).expect("session/new");
    let offered: serde_json::Value = serde_json::from_str(&seen).expect("json");
    let server = &offered["params"]["mcpServers"][0];
    let url = server["url"].as_str().expect("a url").to_owned();
    let port: u16 = url.rsplit(':').next().unwrap().trim_end_matches("/mcp").parse().expect("port");
    let token = server["headers"][0]["value"]
        .as_str()
        .expect("a header")
        .trim_start_matches("Bearer ")
        .to_owned();

    let body = serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }).to_string();
    let served = ask(port, &token, &body).await;
    assert!(served.contains("200 OK"), "the token was turned away: {served}");
    assert!(served.contains("apex_spawn_agent"), "the tools never arrived: {served}");
}

async fn ask(port: u16, token: &str, body: &str) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.expect("connect");
    let request = format!(
        "POST /mcp HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes()).await.expect("write");
    let mut answered = String::new();
    stream.read_to_string(&mut answered).await.expect("read");
    answered
}

#[tokio::test]
async fn apex_can_open_a_session_with_its_own_agent() {
    let home = tempfile::tempdir().expect("home");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    std::fs::create_dir_all(paths.agent_dir()).expect("agent dir");
    std::fs::write(
        paths.agent_dir().join("last.toml"),
        "provider = \"ollama\"\nmodel = \"qwen3\"\n",
    )
    .expect("choice");

    let manager = common::manager_at(&paths);
    let root = tempfile::tempdir().expect("root");
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let session = manager
        .create(NewSession {
            project,
            agent: "apex".into(),
            cwd: Some(root.path().display().to_string()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("apex opens its own agent");

    assert_eq!(session.mode, apex_proto::AgentMode::Acp);
    assert_eq!(session.agent, "apex");

    let snapshot = manager.acp_snapshot(session.id).await.expect("snapshot");
    let modes: Vec<&str> = snapshot.modes.choices.iter().map(|one| one.id.as_str()).collect();
    assert_eq!(modes, vec!["auto", "plan", "chat"]);
    assert_eq!(snapshot.modes.chosen.as_deref(), Some("auto"));
}
