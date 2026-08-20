mod common;

use apex_proto::{Command, Reply};
use common::Harness;

#[tokio::test]
async fn context_round_trips_and_notes_pile_up() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    client
        .request(Command::ContextWrite {
            project: harness.project,
            key: "architecture".into(),
            contents: "# Layers\n".into(),
        })
        .await;

    let Reply::Text { text } = client
        .request(Command::ContextRead { project: harness.project, key: "architecture".into() })
        .await
    else {
        panic!("expected the entry back");
    };
    assert_eq!(text, "# Layers\n");

    client
        .request(Command::ContextNote {
            project: harness.project,
            from: "codex".into(),
            to: Some("claude".into()),
            message: "the parser lives in lib.rs".into(),
        })
        .await;

    let Reply::Context { entries } =
        client.request(Command::ContextList { project: harness.project }).await
    else {
        panic!("expected the listing");
    };
    let keys: Vec<&str> = entries.iter().map(|entry| entry.key.as_str()).collect();
    assert_eq!(keys, vec!["architecture", "notes"]);
    assert!(harness.root.path().join(".apex/context/notes.md").is_file());
}
