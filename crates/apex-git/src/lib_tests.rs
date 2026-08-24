use super::*;

fn repo() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    run(root, &["init", "--initial-branch=main"]).expect("init");
    run(root, &["config", "user.email", "test@apex.dev"]).expect("email");
    run(root, &["config", "user.name", "Apex Test"]).expect("name");
    std::fs::write(root.join("README.md"), "# sample\n").expect("readme");
    run(root, &["add", "."]).expect("add");
    run(root, &["commit", "-m", "first"]).expect("commit");
    dir
}

#[test]
fn a_repository_is_recognised_with_its_branch() {
    let dir = repo();
    assert!(is_repo(dir.path()));
    assert_eq!(current_branch(dir.path()).expect("branch"), "main");
    assert!(!is_repo(&std::env::temp_dir().join("definitely-not-a-repo")));
}

#[test]
fn status_reports_modified_and_untracked_files() {
    let dir = repo();
    std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");
    std::fs::write(dir.path().join("new.txt"), "hello\n").expect("write");

    let changes = status(dir.path()).expect("status");
    assert_eq!(changes.len(), 2);
    assert_eq!(changes[0].path, "README.md");
    assert_eq!(changes[0].kind, ChangeKind::Modified);
    assert!(!changes[0].staged);
    assert_eq!((changes[0].added, changes[0].removed), (1, 1));
    assert_eq!(changes[1].kind, ChangeKind::Untracked);
    assert_eq!((changes[1].added, changes[1].removed), (1, 0));
}

#[test]
fn a_branch_without_a_remote_has_no_upstream() {
    let dir = repo();
    assert!(upstream(dir.path()).is_none());
}

#[test]
fn the_upstream_counts_what_is_ahead_and_behind() {
    let origin = repo();
    let clone = tempfile::tempdir().expect("tempdir");
    let target = clone.path().join("work");
    run(
        origin.path(),
        &["clone", &origin.path().display().to_string(), &target.display().to_string()],
    )
    .expect("clone");
    run(&target, &["config", "user.email", "test@apex.dev"]).expect("email");
    run(&target, &["config", "user.name", "Apex Test"]).expect("name");

    assert_eq!(upstream(&target).expect("upstream").ahead, 0);

    std::fs::write(target.join("local.txt"), "mine\n").expect("write");
    run(&target, &["add", "."]).expect("add");
    run(&target, &["commit", "-m", "local work"]).expect("commit");

    let ahead = upstream(&target).expect("upstream");
    assert_eq!(ahead.ahead, 1);
    assert_eq!(ahead.behind, 0);
    assert!(ahead.name.contains("origin/"));
}

#[test]
fn a_diff_shows_the_change() {
    let dir = repo();
    std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");
    let patch = diff(dir.path(), "README.md").expect("diff");
    assert!(patch.contains("-# sample"));
    assert!(patch.contains("+# changed"));
}

#[test]
fn an_untracked_file_still_has_a_diff() {
    let dir = repo();
    std::fs::write(dir.path().join("new.txt"), "hello\n").expect("write");
    assert!(diff(dir.path(), "new.txt").expect("diff").contains("+hello"));
}

#[test]
fn the_log_carries_the_summary_and_the_author() {
    let dir = repo();
    std::fs::write(dir.path().join("second.txt"), "more\n").expect("write");
    run(dir.path(), &["add", "."]).expect("add");
    run(dir.path(), &["commit", "-m", "second commit"]).expect("commit");

    let commits = log(dir.path(), 10).expect("log");
    assert_eq!(commits.len(), 2);
    assert_eq!(commits[0].summary, "second commit");
    assert_eq!(commits[0].author, "Apex Test");
    assert!(commits[0].when > 0);
    assert_eq!(commits[0].short.len(), 7);
    assert!(commits[0].refs.contains("HEAD"));
    assert_eq!(commits[1].summary, "first");
}

#[test]
fn a_commit_can_be_shown_whole_or_by_file() {
    let dir = repo();
    std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");
    std::fs::write(dir.path().join("other.txt"), "hello\n").expect("write");
    run(dir.path(), &["add", "."]).expect("add");
    run(dir.path(), &["commit", "-m", "touch two files"]).expect("commit");
    let head = &log(dir.path(), 1).expect("log")[0].id;

    let whole = show(dir.path(), head, None).expect("show");
    assert!(whole.contains("+# changed"));
    assert!(whole.contains("+hello"));

    let single = show(dir.path(), head, Some("other.txt")).expect("show");
    assert!(single.contains("+hello"));
    assert!(!single.contains("+# changed"));
}

#[test]
fn staging_moves_a_file_in_and_out_of_the_index() {
    let dir = repo();
    std::fs::write(dir.path().join("README.md"), "# changed\n").expect("write");

    stage(dir.path(), &["README.md".to_owned()]).expect("stage");
    assert_eq!(staged_paths(dir.path()).expect("staged"), vec!["README.md".to_owned()]);

    unstage(dir.path(), &["README.md".to_owned()]).expect("unstage");
    assert!(staged_paths(dir.path()).expect("staged").is_empty());
    assert_eq!(status(dir.path()).expect("status").len(), 1);
}

#[test]
fn the_diff_separates_what_is_staged_from_what_is_not() {
    let dir = repo();
    std::fs::write(dir.path().join("README.md"), "# staged\n").expect("write");
    stage(dir.path(), &["README.md".to_owned()]).expect("stage");
    std::fs::write(dir.path().join("README.md"), "# staged then edited\n").expect("write");

    let staged = diff_scoped(dir.path(), "README.md", Scope::Staged).expect("staged");
    assert!(staged.contains("+# staged"));
    assert!(!staged.contains("then edited"));

    let unstaged = diff_scoped(dir.path(), "README.md", Scope::Unstaged).expect("unstaged");
    assert!(unstaged.contains("+# staged then edited"));

    let both = diff_scoped(dir.path(), "README.md", Scope::Both).expect("both");
    assert!(both.contains("+# staged then edited"));
    assert!(!both.contains("-# staged\n"));
}

#[test]
fn a_commit_only_takes_what_was_staged() {
    let dir = repo();
    std::fs::write(dir.path().join("README.md"), "# in\n").expect("write");
    std::fs::write(dir.path().join("left-out.txt"), "not yet\n").expect("write");
    stage(dir.path(), &["README.md".to_owned()]).expect("stage");

    let commit = commit(dir.path(), "docs: solo el readme").expect("commit");
    assert_eq!(commit.summary, "docs: solo el readme");

    let shown = show(dir.path(), &commit.id, None).expect("show");
    assert!(shown.contains("README.md"));
    assert!(!shown.contains("left-out.txt"));
    assert_eq!(status(dir.path()).expect("status").len(), 1);
}

#[test]
fn an_empty_message_is_refused_before_touching_git() {
    let dir = repo();
    std::fs::write(dir.path().join("README.md"), "# in\n").expect("write");
    stage(dir.path(), &["README.md".to_owned()]).expect("stage");

    assert!(commit(dir.path(), "   ").is_err());
    assert_eq!(log(dir.path(), 10).expect("log").len(), 1);
}

#[test]
fn a_single_hunk_can_be_staged_on_its_own() {
    let dir = repo();
    let lines: Vec<String> = (1..=20).map(|n| format!("line {n}")).collect();
    std::fs::write(dir.path().join("many.txt"), format!("{}\n", lines.join("\n"))).expect("write");
    run(dir.path(), &["add", "."]).expect("add");
    run(dir.path(), &["commit", "-m", "many"]).expect("commit");

    let mut edited = lines.clone();
    edited[1] = "line 2 touched".into();
    edited[18] = "line 19 touched".into();
    std::fs::write(dir.path().join("many.txt"), format!("{}\n", edited.join("\n"))).expect("write");

    let patch = diff_scoped(dir.path(), "many.txt", Scope::Unstaged).expect("diff");
    let hunks = split_hunks(&patch);
    assert_eq!(hunks.len(), 2);

    apply_to_index(dir.path(), &hunks[0], false).expect("apply");
    let staged = diff_scoped(dir.path(), "many.txt", Scope::Staged).expect("staged");
    assert!(staged.contains("+line 2 touched"));
    assert!(!staged.contains("+line 19 touched"));

    apply_to_index(dir.path(), &hunks[0], true).expect("reverse");
    assert!(staged_paths(dir.path()).expect("staged").is_empty());
}

#[test]
fn a_worktree_is_isolated_and_listed() {
    let dir = repo();
    let tree = add_worktree(dir.path(), "codex").expect("worktree");
    assert_eq!(tree.branch, "apex/codex");
    assert!(tree.path.join("README.md").is_file());
    assert_eq!(current_branch(&tree.path).expect("branch"), "apex/codex");

    std::fs::write(tree.path.join("README.md"), "# from the agent\n").expect("write");
    assert!(status(dir.path()).expect("status").is_empty());
    assert_eq!(status(&tree.path).expect("status").len(), 1);

    assert!(
        list_worktrees(dir.path()).expect("list").iter().any(|entry| entry.branch == "apex/codex")
    );
}

#[test]
fn worktrees_are_excluded_from_the_repository() {
    let dir = repo();
    add_worktree(dir.path(), "codex").expect("worktree");
    assert!(status(dir.path()).expect("status").is_empty());

    let exclude = std::fs::read_to_string(dir.path().join(".git/info/exclude")).expect("read");
    assert!(exclude.contains("/.apex/worktrees/"));
}

#[test]
fn work_merges_back_into_the_base_branch() {
    let dir = repo();
    let tree = add_worktree(dir.path(), "codex").expect("worktree");
    std::fs::write(tree.path.join("feature.txt"), "done\n").expect("write");
    run(&tree.path, &["add", "."]).expect("add");
    run(&tree.path, &["commit", "-m", "feature"]).expect("commit");

    assert_eq!(merge(dir.path(), "apex/codex").expect("merge"), MergeOutcome::Merged);
    assert!(dir.path().join("feature.txt").is_file());
}

#[test]
fn a_conflict_is_reported_instead_of_failing() {
    let dir = repo();
    let tree = add_worktree(dir.path(), "codex").expect("worktree");
    std::fs::write(tree.path.join("README.md"), "# theirs\n").expect("write");
    run(&tree.path, &["commit", "-am", "theirs"]).expect("commit");

    std::fs::write(dir.path().join("README.md"), "# ours\n").expect("write");
    run(dir.path(), &["commit", "-am", "ours"]).expect("commit");

    match merge(dir.path(), "apex/codex").expect("merge") {
        MergeOutcome::Conflicted { files } => assert_eq!(files, vec!["README.md".to_owned()]),
        other => panic!("expected a conflict, got {other:?}"),
    }

    abort_merge(dir.path()).expect("abort");
    assert!(status(dir.path()).expect("status").is_empty());
}

#[test]
fn removing_a_worktree_can_drop_its_branch() {
    let dir = repo();
    let tree = add_worktree(dir.path(), "codex").expect("worktree");
    remove_worktree(dir.path(), &tree.path, Some(&tree.branch)).expect("remove");

    assert!(!tree.path.exists());
    assert!(run(dir.path(), &["rev-parse", "--verify", "apex/codex"]).is_err());
}

#[test]
fn titles_become_safe_branch_slugs() {
    assert_eq!(slugify("Claude 2"), "claude-2");
    assert_eq!(slugify("  opencode//shell "), "opencode-shell");
}

#[test]
fn blobs_are_read_at_a_revision_and_missing_ones_are_none() {
    let dir = repo();
    let root = dir.path();
    std::fs::write(root.join("logo.png"), [0x89, 0x50]).expect("logo");
    run(root, &["add", "."]).expect("add");
    run(root, &["commit", "-m", "logo"]).expect("commit");
    std::fs::write(root.join("logo.png"), [0x89, 0x50, 0x4e]).expect("logo");

    assert_eq!(blob(root, "HEAD", "logo.png"), Some(vec![0x89, 0x50]));
    assert_eq!(blob(root, "HEAD^", "logo.png"), None);
    assert_eq!(blob(root, "HEAD", "nope.png"), None);
}

#[test]
fn a_tally_sums_every_change_in_the_tree() {
    let dir = repo();
    let root = dir.path();
    std::fs::write(root.join("README.md"), "# sample\nmore\n").expect("write");
    std::fs::write(root.join("new.txt"), "one\ntwo\n").expect("write");

    let counted = tally(root).expect("tally");
    assert_eq!(counted.files, 2);
    assert_eq!(counted.added, 3);
    assert_eq!(counted.removed, 0);
}

#[test]
fn a_clean_tree_tallies_to_nothing() {
    let dir = repo();
    assert_eq!(tally(dir.path()).expect("tally"), Tally::default());
}

#[test]
fn branches_mark_the_current_one_and_where_each_lives() {
    let dir = repo();
    let root = dir.path();
    run(root, &["branch", "second"]).expect("branch");
    let tree = add_worktree(root, "task").expect("worktree");

    let listed = branches(root).expect("branches");
    let names: Vec<_> = listed.iter().map(|branch| branch.name.as_str()).collect();
    assert!(names.contains(&"main") && names.contains(&"second"));

    let current = listed.iter().find(|branch| branch.name == "main").expect("main");
    assert!(current.current);
    assert_eq!(
        current.worktree.as_ref().map(|path| path.canonicalize().expect("real")),
        Some(root.canonicalize().expect("real"))
    );

    let idle = listed.iter().find(|branch| branch.name == "second").expect("second");
    assert!(!idle.current);
    assert!(idle.worktree.is_none());

    let taken = listed.iter().find(|branch| branch.name == tree.branch).expect("taken");
    assert_eq!(
        taken.worktree.as_ref().map(|path| path.canonicalize().expect("real")),
        Some(tree.path.canonicalize().expect("real"))
    );
}

#[test]
fn checkout_moves_head_and_refuses_a_branch_another_worktree_holds() {
    let dir = repo();
    let root = dir.path();
    run(root, &["branch", "second"]).expect("branch");
    let tree = add_worktree(root, "task").expect("worktree");

    checkout(root, "second").expect("checkout");
    assert_eq!(current_branch(root).expect("branch"), "second");

    assert!(checkout(root, &tree.branch).is_err());
}

#[test]
fn an_untracked_file_still_yields_a_hunk() {
    let dir = repo();
    std::fs::write(dir.path().join("fresh.txt"), "one\ntwo\n").expect("write");

    let patch = diff_scoped(dir.path(), "fresh.txt", Scope::Unstaged).expect("diff");
    assert!(patch.contains("@@"), "{patch}");
    assert!(patch.contains("+one"), "{patch}");
    assert_eq!(split_hunks(&patch).len(), 1);
}

#[test]
fn a_reversed_hunk_leaves_the_working_tree_without_it() {
    let dir = repo();
    let root = dir.path();
    std::fs::write(root.join("README.md"), "# sample\nkeep\ndrop\n").expect("write");

    let patch = diff_scoped(root, "README.md", Scope::Unstaged).expect("diff");
    apply_to_worktree(root, &patch, true).expect("reverse");

    assert_eq!(std::fs::read_to_string(root.join("README.md")).expect("read"), "# sample\n");
}

#[test]
fn a_reversed_hunk_can_be_applied_again_from_what_was_saved() {
    let dir = repo();
    let root = dir.path();
    std::fs::write(root.join("README.md"), "# sample\nkeep\n").expect("write");
    let patch = diff_scoped(root, "README.md", Scope::Unstaged).expect("diff");

    apply_to_worktree(root, &patch, true).expect("reverse");
    apply_to_worktree(root, &patch, false).expect("restore");

    assert_eq!(std::fs::read_to_string(root.join("README.md")).expect("read"), "# sample\nkeep\n");
}

#[test]
fn a_patch_carries_its_path_and_its_line_counts() {
    let dir = repo();
    let root = dir.path();
    std::fs::write(root.join("README.md"), "# changed\nextra\n").expect("write");

    let patch = diff_scoped(root, "README.md", Scope::Unstaged).expect("diff");
    assert_eq!(patch_path(&patch).as_deref(), Some("README.md"));
    assert_eq!(patch_counts(&patch), (2, 1));
}

#[test]
fn a_free_slug_is_the_wanted_one_when_nothing_holds_it() {
    let dir = repo();
    assert_eq!(free_slug(dir.path(), "pi"), "pi");
}

#[test]
fn a_slug_taken_on_disk_moves_to_the_next_one() {
    let dir = repo();
    add_worktree(dir.path(), "pi").expect("worktree");

    assert_eq!(free_slug(dir.path(), "pi"), "pi-2");
}

#[test]
fn a_slug_skips_every_number_already_in_use() {
    let dir = repo();
    add_worktree(dir.path(), "pi").expect("worktree");
    add_worktree(dir.path(), "pi-2").expect("worktree");

    assert_eq!(free_slug(dir.path(), "pi"), "pi-3");
}

#[test]
fn a_branch_left_behind_still_holds_its_slug() {
    let dir = repo();
    let tree = add_worktree(dir.path(), "pi").expect("worktree");
    remove_worktree(dir.path(), &tree.path, None).expect("remove");

    assert_eq!(free_slug(dir.path(), "pi"), "pi-2");
}
