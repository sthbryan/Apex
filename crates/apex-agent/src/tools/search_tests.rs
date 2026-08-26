use super::*;

#[test]
fn nothing_found_says_so_plainly() {
    assert_eq!(spell(Vec::new(), false), "nothing matched\n");
}

#[test]
fn what_was_found_is_counted() {
    let hits = vec!["a.rs:1: uno".to_owned(), "b.rs:4: dos".to_owned()];
    assert_eq!(spell(hits, false), "2 matches\na.rs:1: uno\nb.rs:4: dos\n");
}

#[test]
fn a_cut_off_search_says_it_was_cut_off() {
    let hits = vec!["a.rs:1: uno".to_owned()];
    assert_eq!(spell(hits, true), "the first 1 matches\na.rs:1: uno\n");
}

fn tree() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("one.rs"), "fn uno() {}\nfn dos() {}\n").expect("write");
    std::fs::create_dir(dir.path().join("deep")).expect("mkdir");
    std::fs::write(dir.path().join("deep/two.rs"), "fn UNO() {}\n").expect("write");
    std::fs::write(dir.path().join(".gitignore"), "skipped.rs\n").expect("write");
    std::fs::write(dir.path().join("skipped.rs"), "fn uno() {}\n").expect("write");
    dir
}

#[test]
fn a_match_names_the_file_and_the_line() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(&root, &root, &regex::Regex::new("fn uno").expect("pattern")).expect("sweep");
    assert!(found.contains("one.rs:1: fn uno() {}"));
}

#[test]
fn a_search_walks_into_folders() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found =
        sweep(&root, &root, &RegexBuilder::new("fn uno").case_insensitive(true).build().unwrap())
            .expect("sweep");
    assert!(found.contains("deep/two.rs:1:"));
}

#[test]
fn what_git_ignores_is_skipped() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(&root, &root, &regex::Regex::new("fn uno").expect("pattern")).expect("sweep");
    assert!(!found.contains("skipped.rs"));
}

#[test]
fn a_search_can_be_pointed_at_one_folder() {
    let dir = tree();
    let root = dir.path().canonicalize().expect("real");
    let found = sweep(
        &root,
        &root.join("deep"),
        &RegexBuilder::new("fn uno").case_insensitive(true).build().unwrap(),
    )
    .expect("sweep");
    assert!(found.contains("deep/two.rs"));
    assert!(!found.contains("one.rs:1"));
}
