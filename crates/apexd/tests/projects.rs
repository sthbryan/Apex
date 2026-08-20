mod common;

use apex_proto::{
    ClientMessage, Command, CommandOutcome, ErrorCode, Reply, RequestId, ServerMessage,
};
use common::Harness;

#[tokio::test]
async fn a_project_is_opened_and_listed() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    let Reply::Projects { projects } = client.request(Command::ListProjects).await else {
        panic!("expected project list");
    };
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].id, harness.project);
    assert!(!projects[0].is_git);
}

#[tokio::test]
async fn opening_a_folder_that_is_not_a_directory_fails() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    client.next += 1;
    let id = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request {
            id,
            command: Command::ProjectOpen { root: "/no/such/folder".into() },
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

#[tokio::test]
async fn a_project_tree_is_listed_and_read() {
    let harness = Harness::start().await;
    std::fs::create_dir(harness.root.path().join("src")).expect("src");
    std::fs::write(harness.root.path().join("src/main.rs"), "fn main() {}\n").expect("write");
    let mut client = harness.client().await;

    let Reply::Directory { entries } =
        client.request(Command::DirList { project: harness.project, path: String::new() }).await
    else {
        panic!("expected a directory");
    };
    assert_eq!(entries.len(), 1);
    assert!(entries[0].is_dir);

    let Reply::File { contents } = client
        .request(Command::FileRead { project: harness.project, path: "src/main.rs".into() })
        .await
    else {
        panic!("expected a file");
    };
    assert_eq!(contents.text.as_deref(), Some("fn main() {}\n"));
}

#[tokio::test]
async fn reading_outside_the_project_is_refused() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    client.next += 1;
    let id = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request {
            id,
            command: Command::FileRead { project: harness.project, path: "../../etc/hosts".into() },
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
