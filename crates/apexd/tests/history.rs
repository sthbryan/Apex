mod common;

use apex_proto::{
    ClientMessage, Command, CommandOutcome, ErrorCode, Reply, RequestId, ServerMessage,
    TerminalSize,
};
use common::Harness;

#[tokio::test]
async fn history_is_listed_across_agents_newest_first() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    let Reply::History { entries } =
        client.request(Command::ListHistory { project: harness.project }).await
    else {
        panic!("expected history");
    };
    assert!(entries.iter().all(|entry| entry.updated_at > 0 || entry.label.is_none()));
    assert!(
        entries.windows(2).all(|pair| pair[0].updated_at >= pair[1].updated_at),
        "history was not sorted"
    );
}

#[tokio::test]
async fn resuming_an_agent_without_history_support_fails() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    client.next += 1;
    let id = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request {
            id,
            command: Command::SessionResume {
                project: harness.project,
                agent: "sh".into(),
                session_id: "abc".into(),
                size: TerminalSize::default(),
            },
        })
        .await
        .expect("request");

    let frame = client.connection.recv().await.expect("frame").expect("no error");
    match frame.parse_control::<ServerMessage>().expect("parse") {
        ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
            assert_eq!(error.code, ErrorCode::Internal);
            assert!(error.message.contains("resume"));
        }
        other => panic!("expected an error, got {other:?}"),
    }
}
