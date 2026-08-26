use super::*;

fn tree() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::create_dir_all(dir.path().join("src/deep")).expect("mkdir");
    std::fs::write(dir.path().join("src/one.rs"), "").expect("write");
    std::fs::write(dir.path().join("src/deep/two.rs"), "").expect("write");
    std::fs::write(dir.path().join("src/notes.txt"), "").expect("write");
    std::fs::write(dir.path().join(".gitignore"), "hidden.rs\n").expect("write");
    std::fs::write(dir.path().join("hidden.rs"), "").expect("write");
    dir
}

fn matcher(glob: &str) -> globset::GlobMatcher {
    GlobBuilder::new(glob).literal_separator(true).build().expect("glob").compile_matcher()
}

#[test]
fn nothing_found_says_so_plainly() {
    assert_eq!(spell(Vec::new(), false), "nothing matched\n");
}

#[test]
fn what_was_found_is_counted_and_listed() {
    assert_eq!(spell(vec!["a.rs".to_owned()], false), "1 files\na.rs\n");
}

#[test]
fn a_cut_off_walk_says_it_was_cut_off() {
    assert_eq!(spell(vec!["a.rs".to_owned()], true), "the first 1 files\na.rs\n");
}

#[test]
fn a_glob_reaches_down_through_folders() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(&root, &root, &matcher("src/**/*.rs")).expect("sweep");
    assert!(found.contains("src/one.rs"));
    assert!(found.contains("src/deep/two.rs"));
}

#[test]
fn a_glob_leaves_out_what_does_not_match() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(&root, &root, &matcher("src/**/*.rs")).expect("sweep");
    assert!(!found.contains("notes.txt"));
}

#[test]
fn a_star_does_not_jump_over_a_folder() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(&root, &root, &matcher("src/*.rs")).expect("sweep");
    assert!(found.contains("src/one.rs"));
    assert!(!found.contains("src/deep/two.rs"));
}

#[test]
fn what_git_ignores_is_skipped() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(&root, &root, &matcher("*.rs")).expect("sweep");
    assert!(!found.contains("hidden.rs"));
}

#[test]
fn the_files_come_back_in_order() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(&root, &root, &matcher("src/**/*.rs")).expect("sweep");
    let listed: Vec<&str> = found.lines().skip(1).collect();
    let mut sorted = listed.clone();
    sorted.sort();
    assert_eq!(listed, sorted);
}
