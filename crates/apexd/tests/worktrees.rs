mod common;

use apex_proto::{DiffScope, GitTarget, Isolation, TerminalSize, WorktreeDisposal};
use apexd::sessions::NewSession;
use common::{Harness, init_repo};

#[tokio::test]
async fn an_isolated_session_runs_in_its_own_worktree() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());

    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("session");

    let tree = session.worktree.clone().expect("worktree");
    assert!(tree.branch.starts_with("apex/"));
    assert_eq!(session.cwd, tree.path);
    assert!(std::path::Path::new(&tree.path).join("README.md").is_file());

    let target = GitTarget::Session { id: session.id };
    let status = harness.manager.git_status(harness.project, target).await.expect("status");
    assert_eq!(status.branch, tree.branch);
    assert_eq!(status.base, "main");
    assert!(status.isolated);
    assert!(status.changes.is_empty());

    std::fs::write(std::path::Path::new(&tree.path).join("README.md"), "# agent\n").expect("write");
    let target = GitTarget::Session { id: session.id };
    let status = harness.manager.git_status(harness.project, target).await.expect("status");
    assert_eq!(status.changes.len(), 1);
    assert_eq!(status.changes[0].kind, "modified");
    assert!(
        harness
            .manager
            .git_diff(
                harness.project,
                GitTarget::Session { id: session.id },
                "README.md",
                None,
                DiffScope::Both,
            )
            .await
            .expect("diff")
            .contains("+# agent")
    );
}

#[tokio::test]
async fn a_worktree_outlives_the_session_that_made_it() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("session");
    let tree = session.worktree.clone().expect("worktree");

    harness.manager.close(session.id, WorktreeDisposal::Keep).await.expect("close");

    let listed = harness.manager.list_worktrees(harness.project).await.expect("list");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].branch, tree.branch);

    let target = GitTarget::Worktree { path: tree.path.clone() };
    let status = harness.manager.git_status(harness.project, target.clone()).await.expect("status");
    assert_eq!(status.branch, tree.branch);
    assert!(status.isolated);

    std::fs::write(std::path::Path::new(&tree.path).join("late.txt"), "after\n").expect("write");
    harness
        .manager
        .git_stage(harness.project, target.clone(), vec!["late.txt".to_owned()], true)
        .await
        .expect("stage");
    harness
        .manager
        .git_commit(harness.project, target.clone(), "feat: after the session".to_owned())
        .await
        .expect("commit");

    assert_eq!(
        harness.manager.merge_worktree(harness.project, target).await.expect("merge"),
        apex_proto::MergeReport::Merged
    );
    assert!(harness.root.path().join("late.txt").is_file());
}

#[tokio::test]
async fn a_worktree_commit_never_touches_the_project() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("session");
    let tree = std::path::PathBuf::from(&session.worktree.expect("worktree").path);

    std::fs::write(tree.join("README.md"), "# from the agent\n").expect("write");
    harness
        .manager
        .git_stage(
            harness.project,
            GitTarget::Session { id: session.id },
            vec!["README.md".to_owned()],
            true,
        )
        .await
        .expect("stage");
    harness
        .manager
        .git_commit(
            harness.project,
            GitTarget::Session { id: session.id },
            "feat: agent work".to_owned(),
        )
        .await
        .expect("commit");

    let project =
        harness.manager.git_log(harness.project, GitTarget::Project, 10).await.expect("log");
    assert_eq!(project[0].summary, "first");
    let after =
        harness.manager.git_status(harness.project, GitTarget::Project).await.expect("status");
    assert!(after.changes.is_empty());
}

#[tokio::test]
async fn discarding_a_session_takes_its_worktree_with_it() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());

    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("session");
    let path = std::path::PathBuf::from(&session.worktree.expect("worktree").path);

    harness.manager.close(session.id, WorktreeDisposal::Discard).await.expect("close");
    assert!(!path.exists());
}

#[tokio::test]
async fn a_session_in_a_plain_folder_cannot_be_isolated() {
    let harness = Harness::start().await;
    assert!(
        harness
            .manager
            .create(NewSession {
                project: harness.project,
                agent: "sh".into(),
                cwd: None,
                size: TerminalSize::default(),
                isolation: Isolation::Worktree,
                slug: None,
                mode: None,
                parent: None,
                run: None,
                unattended: false,
            })
            .await
            .is_err()
    );
}

#[tokio::test]
async fn a_branch_can_be_listed_and_checked_out_on_the_project() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());
    std::process::Command::new("git")
        .args(["branch", "second"])
        .current_dir(harness.root.path())
        .output()
        .expect("git");

    let branches =
        harness.manager.git_branches(harness.project, GitTarget::Project).await.expect("branches");
    let current = branches.iter().find(|branch| branch.name == "main").expect("main");
    assert!(current.current);
    assert!(current.worktree.is_some());
    assert!(branches.iter().any(|branch| branch.name == "second" && branch.worktree.is_none()));

    harness
        .manager
        .git_checkout(harness.project, GitTarget::Project, "second".into())
        .await
        .expect("checkout");
    let status =
        harness.manager.git_status(harness.project, GitTarget::Project).await.expect("status");
    assert_eq!(status.branch, "second");
}
