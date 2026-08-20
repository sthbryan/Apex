mod common;

use apex_proto::{Command, CommandOutcome, ErrorCode, Frame, Reply, RequestId, ServerMessage};
use common::Harness;

#[tokio::test]
async fn ping_still_works_alongside_sessions() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    assert_eq!(client.request(Command::Ping).await, Reply::Pong);
}

#[tokio::test]
async fn a_command_the_daemon_cannot_read_is_refused_not_dropped() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    client.next += 1;
    let id = RequestId(client.next);
    client
        .connection
        .send(Frame::Control(
            serde_json::json!({
                "kind": "request",
                "id": id,
                "command": { "type": "from_the_future" },
            })
            .to_string()
            .into(),
        ))
        .await
        .expect("request");

    let frame = client.connection.recv().await.expect("frame").expect("no error");
    match frame.parse_control::<ServerMessage>().expect("parse") {
        ServerMessage::Response { id: answered, outcome: CommandOutcome::Err { error } } => {
            assert_eq!(answered, id);
            assert_eq!(error.code, ErrorCode::MalformedRequest);
        }
        other => panic!("expected an error, got {other:?}"),
    }
}
