mod common;

use std::time::Duration;

use apex_proto::{Command, Reply, connect_unix};
use common::Harness;

#[tokio::test]
async fn a_client_counts_once_it_has_said_hello() {
    let harness = Harness::start().await;
    assert_eq!(harness.counted(), 0);

    let client = harness.client().await;
    assert_eq!(harness.settle(1).await, 1);

    drop(client);
    assert_eq!(harness.settle(0).await, 0);
}

#[tokio::test]
async fn a_probe_never_counts_as_a_client() {
    let harness = Harness::start().await;

    let mut probe = harness.probe().await;
    let reply = probe.request(Command::DaemonStatus).await;

    assert!(matches!(reply, Reply::Daemon { .. }));
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(harness.counted(), 0);
}

#[tokio::test]
async fn status_reports_the_daemon_it_is_talking_to() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    let Reply::Daemon { report } = client.request(Command::DaemonStatus).await else {
        panic!("expected a daemon report");
    };

    assert_eq!(report.daemon_version, env!("CARGO_PKG_VERSION"));
    assert_eq!(report.protocol_version, apex_proto::PROTOCOL_VERSION);
    assert_eq!(report.clients, 1);
    assert_eq!(report.sessions, 0);
    assert_eq!(report.live, 0);
    assert_eq!(report.remaining, None);
}

#[tokio::test]
async fn a_connection_that_never_speaks_is_not_a_client() {
    let harness = Harness::start().await;

    let held = connect_unix(&harness.socket).await.expect("connect");

    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(harness.counted(), 0);
    drop(held);
}
