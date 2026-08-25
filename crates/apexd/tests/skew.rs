mod common;

use std::time::Duration;

use apex_proto::{
    ClientMessage, Command, CommandOutcome, ErrorCode, Frame, Hello, PROTOCOL_VERSION, Reply,
    RequestId, ServerMessage, connect_unix,
};
use common::Harness;
use tokio::time::timeout;

async fn greet_from_the_future(socket: &std::path::Path) -> apex_proto::Connection {
    let mut connection = connect_unix(socket).await.expect("connect");
    connection
        .send_control(&ClientMessage::Hello(Hello {
            protocol_version: PROTOCOL_VERSION + 1,
            client_name: "a newer apex".into(),
            identity: None,
            probe: false,
        }))
        .await
        .expect("hello");
    connection
}

async fn next(connection: &mut apex_proto::Connection) -> ServerMessage {
    let frame = timeout(Duration::from_secs(5), connection.recv())
        .await
        .expect("nothing came back")
        .expect("the daemon hung up")
        .expect("no transport error");
    assert!(matches!(frame, Frame::Control(_)));
    frame.parse_control::<ServerMessage>().expect("parse")
}

#[tokio::test]
async fn a_protocol_we_do_not_speak_is_refused_by_name() {
    let harness = Harness::start().await;
    let mut connection = greet_from_the_future(&harness.socket).await;

    let ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } =
        next(&mut connection).await
    else {
        panic!("expected a refusal");
    };

    assert_eq!(error.code, ErrorCode::UnsupportedVersion);
    assert!(error.message.contains(&format!("v{PROTOCOL_VERSION}")));
}

#[tokio::test]
async fn a_refused_client_can_still_ask_the_daemon_to_step_aside() {
    let harness = Harness::start().await;
    let mut quitting = harness.manager.quitting();
    assert!(!*quitting.borrow_and_update());

    let mut connection = greet_from_the_future(&harness.socket).await;
    let _refusal = next(&mut connection).await;

    connection
        .send_control(&ClientMessage::Request {
            id: RequestId(1),
            command: Command::DaemonShutdown,
        })
        .await
        .expect("shutdown");

    let ServerMessage::Response { outcome: CommandOutcome::Ok { reply }, .. } =
        next(&mut connection).await
    else {
        panic!("expected the daemon to agree");
    };

    assert!(matches!(*reply, Reply::Done));
    assert!(*quitting.borrow_and_update());
}

#[tokio::test]
async fn a_refused_client_is_never_counted_as_one() {
    let harness = Harness::start().await;

    let mut connection = greet_from_the_future(&harness.socket).await;
    let _refusal = next(&mut connection).await;

    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(harness.counted(), 0);
}
