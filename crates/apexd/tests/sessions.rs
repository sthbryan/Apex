mod common;

use apex_proto::{
    ClientMessage, Command, CommandOutcome, ErrorCode, Isolation, Reply, RequestId, ServerMessage,
    SessionState, TerminalSize, WorktreeDisposal,
};
use apexd::sessions::NewSession;
use common::{Harness, wait_for_state};
use tokio::time::timeout;

#[tokio::test]
async fn creating_a_session_streams_its_output() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;

    client
        .request(Command::SessionInput { id: session.id, data: "echo marca-de-salida\n".into() })
        .await;
    let text = client.collect_output(session.id, "marca-de-salida").await;
    assert!(text.contains("marca-de-salida"));
}

#[tokio::test]
async fn sessions_appear_in_the_listing() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;

    let Reply::Sessions { sessions } = client.request(Command::ListSessions).await else {
        panic!("expected session list");
    };
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].id, session.id);
    assert!(sessions[0].is_alive());
}

#[tokio::test]
async fn resizing_updates_the_stored_size() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;

    client
        .request(Command::SessionResize {
            id: session.id,
            size: TerminalSize { rows: 40, cols: 120 },
        })
        .await;
    client.request(Command::SessionInput { id: session.id, data: "stty size\n".into() }).await;

    let text = client.collect_output(session.id, "40 120").await;
    assert!(text.contains("40 120"));
}

#[tokio::test]
async fn a_session_survives_the_client_disconnecting() {
    let harness = Harness::start().await;

    let session = {
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;
        client
            .request(Command::SessionInput { id: session.id, data: "echo before-close\n".into() })
            .await;
        client.collect_output(session.id, "before-close").await;
        session
    };

    assert_eq!(harness.manager.list_sessions().await.len(), 1);

    let mut reconnected = harness.client().await;
    reconnected.request(Command::SessionAttach { id: session.id }).await;
    let replayed = reconnected.collect_output(session.id, "before-close").await;
    assert!(replayed.contains("before-close"));

    reconnected
        .request(Command::SessionInput { id: session.id, data: "echo still-alive\n".into() })
        .await;
    let text = reconnected.collect_output(session.id, "still-alive").await;
    assert!(text.contains("still-alive"));
}

#[tokio::test]
async fn a_prompt_moves_the_session_to_blocked() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "prompted".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("create");

    wait_for_state(&harness.manager, session.id, SessionState::Blocked).await;
}

#[tokio::test]
async fn a_state_change_is_announced_as_an_event() {
    let harness = Harness::start().await;
    let mut events = harness.manager.subscribe();

    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "prompted".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("create");

    let announced = timeout(std::time::Duration::from_secs(30), async {
        loop {
            match events.recv().await {
                Ok(apex_proto::Event::SessionStateChanged { id, state })
                    if id == session.id && state == SessionState::Blocked =>
                {
                    return true;
                }
                Ok(_) => continue,
                Err(_) => return false,
            }
        }
    })
    .await;
    assert_eq!(announced, Ok(true), "state change was never announced");
}

#[tokio::test]
async fn a_quiet_session_without_patterns_settles_on_idle() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;
    client.request(Command::SessionInput { id: session.id, data: "echo quiet\n".into() }).await;

    wait_for_state(&harness.manager, session.id, SessionState::Idle).await;
}

#[tokio::test]
async fn answering_the_prompt_moves_the_session_back_to_working() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "prompted".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("create");
    wait_for_state(&harness.manager, session.id, SessionState::Blocked).await;

    harness.manager.write(session.id, "still writing\n").await.expect("input");
    wait_for_state(&harness.manager, session.id, SessionState::Working).await;
}

#[tokio::test]
async fn a_transcript_returns_the_tail_of_what_an_agent_printed() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;

    client
        .request(Command::SessionInput { id: session.id, data: "echo marca-para-el-otro\n".into() })
        .await;
    client.collect_output(session.id, "marca-para-el-otro").await;

    let Reply::Text { text } = client
        .request(Command::SessionTranscript { id: session.id, tail: 4096, plain: false })
        .await
    else {
        panic!("expected a transcript");
    };
    assert!(text.contains("marca-para-el-otro"));
    assert!(text.len() <= 4096);
}

#[tokio::test]
async fn a_slow_command_does_not_hold_up_the_others() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    client.next += 1;
    let slow = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request {
            id: slow,
            command: Command::ReadMetrics { refresh_quota: true },
        })
        .await
        .expect("metrics");

    client.next += 1;
    let quick = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request { id: quick, command: Command::Ping })
        .await
        .expect("ping");

    let frame = timeout(std::time::Duration::from_secs(5), client.connection.recv())
        .await
        .expect("no timeout")
        .expect("frame")
        .expect("no error");
    match frame.parse_control::<ServerMessage>().expect("parse") {
        ServerMessage::Response { id, .. } => assert_eq!(id, quick),
        other => panic!("expected the ping answer first, got {other:?}"),
    }
}

#[tokio::test]
async fn a_session_carries_the_project_it_belongs_to() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;
    assert_eq!(session.project_id, harness.project);

    let Reply::Sessions { sessions } = client.request(Command::ListSessions).await else {
        panic!("expected session list");
    };
    assert_eq!(sessions[0].project_id, harness.project);
}

#[tokio::test]
async fn a_session_defaults_to_the_project_root_as_its_cwd() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("create");

    let root = harness
        .manager
        .list_projects()
        .await
        .expect("projects")
        .into_iter()
        .find(|project| project.id == harness.project)
        .expect("project")
        .root;
    assert_eq!(session.cwd, root);
}

#[tokio::test]
async fn closing_a_session_removes_it() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;

    client
        .request(Command::SessionClose { id: session.id, worktree: WorktreeDisposal::Keep })
        .await;
    assert!(harness.manager.list_sessions().await.is_empty());
}

#[tokio::test]
async fn creating_a_session_for_an_unknown_agent_fails() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    client.next += 1;
    let id = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request {
            id,
            command: Command::SessionCreate {
                mode: None,
                isolation: Isolation::Directory,
                slug: None,
                project: harness.project,
                agent: "does-not-exist".into(),
                cwd: None,
                size: TerminalSize::default(),
            },
        })
        .await
        .expect("request");

    let frame = client.connection.recv().await.expect("frame").expect("no error");
    match frame.parse_control::<ServerMessage>().expect("parse") {
        ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
            assert_eq!(error.code, ErrorCode::Internal);
        }
        other => panic!("expected an error, got {other:?}"),
    }
}

#[tokio::test]
async fn a_plain_transcript_carries_no_terminal_codes() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("session");

    harness
        .manager
        .tell(session.id, "printf '\\033[31mred\\033[0m done'".into())
        .await
        .expect("tell");

    let plain = timeout(std::time::Duration::from_secs(30), async {
        loop {
            let text = harness.manager.transcript(session.id, 8192, true).await.expect("plain");
            if text.contains("done") {
                return text;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("the shell never answered");

    assert!(!plain.contains('\u{1b}'), "escapes survived: {plain:?}");
}
