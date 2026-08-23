use super::rejects::RejectsService;

fn git(dir: &std::path::Path, args: &[&str]) {
    let done = std::process::Command::new("git").current_dir(dir).args(args).output().expect("git");
    assert!(done.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&done.stderr));
}

fn repo() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    git(root, &["init", "--initial-branch=main"]);
    git(root, &["config", "user.email", "test@apex.dev"]);
    git(root, &["config", "user.name", "Apex Test"]);
    std::fs::write(root.join("README.md"), "# sample\n").expect("readme");
    git(root, &["add", "."]);
    git(root, &["commit", "-m", "first"]);
    dir
}

fn patch_of(root: &std::path::Path) -> String {
    apex_git::diff_scoped(root, "README.md", apex_git::Scope::Unstaged).expect("diff")
}

#[tokio::test]
async fn a_rejected_hunk_leaves_the_tree_and_stays_on_the_shelf() {
    let repo = repo();
    let data = tempfile::tempdir().expect("data");
    let shelf = RejectsService::new(data.path());
    let project = uuid::Uuid::new_v4();
    std::fs::write(repo.path().join("README.md"), "# sample\nnoise\n").expect("write");

    shelf.reject(repo.path(), project, "main", patch_of(repo.path())).await.expect("reject");

    assert_eq!(std::fs::read_to_string(repo.path().join("README.md")).expect("read"), "# sample\n");
    let saved = shelf.list(project, "main").await.expect("list");
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].path, "README.md");
    assert_eq!(saved[0].added, 1);
}

#[tokio::test]
async fn restoring_a_reject_puts_the_lines_back_and_takes_it_off_the_shelf() {
    let repo = repo();
    let data = tempfile::tempdir().expect("data");
    let shelf = RejectsService::new(data.path());
    let project = uuid::Uuid::new_v4();
    std::fs::write(repo.path().join("README.md"), "# sample\nnoise\n").expect("write");
    shelf.reject(repo.path(), project, "main", patch_of(repo.path())).await.expect("reject");

    let saved = shelf.list(project, "main").await.expect("list");
    shelf.restore(repo.path(), project, "main", &saved[0].id).await.expect("restore");

    assert_eq!(
        std::fs::read_to_string(repo.path().join("README.md")).expect("read"),
        "# sample\nnoise\n"
    );
    assert!(shelf.list(project, "main").await.expect("list").is_empty());
}

#[tokio::test]
async fn clearing_a_shelf_leaves_nothing_to_restore() {
    let repo = repo();
    let data = tempfile::tempdir().expect("data");
    let shelf = RejectsService::new(data.path());
    let project = uuid::Uuid::new_v4();
    std::fs::write(repo.path().join("README.md"), "# sample\nnoise\n").expect("write");
    shelf.reject(repo.path(), project, "main", patch_of(repo.path())).await.expect("reject");

    shelf.clear(project, "main").await.expect("clear");

    assert!(shelf.list(project, "main").await.expect("list").is_empty());
}

#[tokio::test]
async fn a_target_without_a_branch_is_refused() {
    assert!(super::rejects::require_branch("  ").is_err());
}

#[tokio::test]
async fn a_sweep_forgets_the_hunks_nobody_came_back_for() {
    let data = tempfile::tempdir().expect("data");
    let shelf = RejectsService::new(data.path());
    let project = uuid::Uuid::new_v4();
    let dir = data.path().join("rejected").join(project.to_string()).join("main");
    std::fs::create_dir_all(&dir).expect("shelf");
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("clock")
        .as_millis();
    let old = now - 60 * 24 * 60 * 60 * 1000;
    std::fs::write(dir.join(format!("{now}.patch")), "recent").expect("recent");
    std::fs::write(dir.join(format!("{old}.patch")), "ancient").expect("ancient");

    shelf.sweep().await;

    assert!(dir.join(format!("{now}.patch")).is_file());
    assert!(!dir.join(format!("{old}.patch")).exists());
}
