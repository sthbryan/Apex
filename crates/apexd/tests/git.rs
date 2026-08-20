mod common;

use apex_proto::{Command, DiffScope, GitTarget, Reply};
use common::{Harness, init_repo};

#[tokio::test]
async fn the_project_itself_reports_its_changes_without_a_session() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());
    std::fs::write(harness.root.path().join("README.md"), "# edited\n").expect("write");

    let status =
        harness.manager.git_status(harness.project, GitTarget::Project).await.expect("status");
    assert_eq!(status.branch, "main");
    assert!(!status.isolated);
    assert_eq!(status.changes.len(), 1);
    assert!(
        harness
            .manager
            .git_diff(harness.project, GitTarget::Project, "README.md", None, DiffScope::Both)
            .await
            .expect("diff")
            .contains("+# edited")
    );
}

#[tokio::test]
async fn a_partial_commit_leaves_the_rest_alone() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());
    std::fs::write(harness.root.path().join("README.md"), "# picked\n").expect("write");
    std::fs::write(harness.root.path().join("left.txt"), "not this one\n").expect("write");

    harness
        .manager
        .git_stage(harness.project, GitTarget::Project, vec!["README.md".to_owned()], true)
        .await
        .expect("stage");

    let commit = harness
        .manager
        .git_commit(harness.project, GitTarget::Project, "docs: solo el readme".to_owned())
        .await
        .expect("commit");
    assert_eq!(commit.summary, "docs: solo el readme");

    let shown = harness
        .manager
        .git_diff(harness.project, GitTarget::Project, "", Some(commit.id), DiffScope::Both)
        .await
        .expect("show");
    assert!(shown.contains("README.md"));
    assert!(!shown.contains("left.txt"));

    let status =
        harness.manager.git_status(harness.project, GitTarget::Project).await.expect("status");
    assert_eq!(status.changes.len(), 1);
    assert_eq!(status.changes[0].path, "left.txt");
}

#[tokio::test]
async fn a_file_is_split_into_hunks_that_can_be_staged_apart() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());
    let lines: Vec<String> = (1..=20).map(|n| format!("line {n}")).collect();
    std::fs::write(harness.root.path().join("many.txt"), format!("{}\n", lines.join("\n")))
        .expect("write");
    for args in [&["add", "."][..], &["commit", "-m", "many"][..]] {
        std::process::Command::new("git")
            .args(args)
            .current_dir(harness.root.path())
            .output()
            .expect("git");
    }

    let mut edited = lines.clone();
    edited[1] = "line 2 touched".into();
    edited[18] = "line 19 touched".into();
    std::fs::write(harness.root.path().join("many.txt"), format!("{}\n", edited.join("\n")))
        .expect("write");

    let hunks = harness
        .manager
        .git_hunks(harness.project, GitTarget::Project, "many.txt", DiffScope::Unstaged)
        .await
        .expect("hunks");
    assert_eq!(hunks.len(), 2);

    harness
        .manager
        .git_stage_hunk(harness.project, GitTarget::Project, hunks[0].clone(), true)
        .await
        .expect("stage hunk");

    let staged = harness
        .manager
        .git_diff(harness.project, GitTarget::Project, "many.txt", None, DiffScope::Staged)
        .await
        .expect("staged");
    assert!(staged.contains("+line 2 touched"));
    assert!(!staged.contains("+line 19 touched"));
}

#[tokio::test]
async fn the_history_is_listed_newest_first() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());
    std::fs::write(harness.root.path().join("later.txt"), "later\n").expect("write");
    for args in [&["add", "."][..], &["commit", "-m", "a later commit"][..]] {
        std::process::Command::new("git")
            .args(args)
            .current_dir(harness.root.path())
            .output()
            .expect("git");
    }

    let commits =
        harness.manager.git_log(harness.project, GitTarget::Project, 10).await.expect("log");
    assert_eq!(commits[0].summary, "a later commit");
    assert_eq!(commits.len(), 2);

    let patch = harness
        .manager
        .git_diff(
            harness.project,
            GitTarget::Project,
            "",
            Some(commits[0].id.clone()),
            DiffScope::Both,
        )
        .await
        .expect("show");
    assert!(patch.contains("+later"));
}

#[tokio::test]
async fn a_layout_round_trips_through_the_protocol() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    let Reply::Layout { payload } =
        client.request(Command::LayoutLoad { project: harness.project }).await
    else {
        panic!("expected a layout");
    };
    assert_eq!(payload, None);

    client
        .request(Command::LayoutSave { project: harness.project, payload: "{\"tabs\":[]}".into() })
        .await;

    let Reply::Layout { payload } =
        client.request(Command::LayoutLoad { project: harness.project }).await
    else {
        panic!("expected a layout");
    };
    assert_eq!(payload.as_deref(), Some("{\"tabs\":[]}"));
}
