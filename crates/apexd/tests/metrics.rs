mod common;

use apex_proto::{
    ClientMessage, Command, CommandOutcome, ErrorCode, Reply, RequestId, ServerMessage, WorktreeDisposal,
};
use common::Harness;

#[tokio::test]
async fn metrics_report_the_system_and_the_live_sessions() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;
    tokio::time::sleep(std::time::Duration::from_millis(400)).await;

    let Reply::Metrics { snapshot } =
        client.request(Command::ReadMetrics { refresh_quota: false }).await
    else {
        panic!("expected metrics");
    };

    assert!(snapshot.system.memory_total > 0.0, "missing total memory");
    assert!(snapshot.system.cores >= 1);

    let mine = snapshot
        .sessions
        .iter()
        .find(|usage| usage.id == session.id)
        .expect("session missing from metrics");
    assert!(mine.memory > 0.0, "session reports no memory");
    assert!(!mine.processes.is_empty());
    assert_eq!(mine.title, session.title);
}

#[tokio::test]
async fn a_closed_session_disappears_from_the_metrics() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = client.create_shell(harness.project).await;
    client
        .request(Command::SessionClose { id: session.id, worktree: WorktreeDisposal::Keep })
        .await;

    let Reply::Metrics { snapshot } =
        client.request(Command::ReadMetrics { refresh_quota: false }).await
    else {
        panic!("expected metrics");
    };
    assert!(snapshot.sessions.iter().all(|usage| usage.id != session.id));
}

#[tokio::test]
async fn a_provider_that_cannot_be_reached_does_not_hide_the_others() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    let Reply::Metrics { snapshot } =
        client.request(Command::ReadMetrics { refresh_quota: true }).await
    else {
        panic!("expected metrics");
    };

    let reported: Vec<&str> = snapshot.quotas.iter().map(|q| q.agent.as_str()).collect();
    assert!(!reported.contains(&"unreachable"), "the failing provider should report no windows");
    assert!(
        snapshot.quota_failures.contains(&"unreachable".to_string()),
        "the failing provider should say so instead of vanishing"
    );
    assert!(snapshot.system.memory_total > 0.0, "system metrics broke alongside quota");
}

#[tokio::test]
async fn killing_an_unknown_process_fails() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    client.next += 1;
    let id = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request {
            id,
            command: Command::KillProcess { pid: u32::MAX },
        })
        .await
        .expect("request");

    let frame = client.connection.recv().await.expect("frame").expect("no error");
    match frame.parse_control::<ServerMessage>().expect("parse") {
        ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
            assert_eq!(error.code, ErrorCode::NotFound);
        }
        other => panic!("expected an error, got {other:?}"),
    }
}
