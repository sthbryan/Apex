use super::*;

#[test]
fn the_builtin_one_says_something() {
    assert!(builtin().contains("Apex"));
    assert!(builtin().contains("preserve existing work"));
    assert!(builtin().contains("verify it in proportion to its risk"));
    assert!(builtin().contains("Avoid destructive actions"));
}

#[test]
fn a_folder_with_nothing_in_it_falls_back_to_the_builtin_one() {
    let dir = tempfile::tempdir().expect("dir");
    assert_eq!(read(dir.path()), builtin());
}

#[test]
fn a_folder_that_is_not_there_falls_back_to_the_builtin_one() {
    assert_eq!(read(Path::new("/nowhere/at/all")), builtin());
}

#[test]
fn your_own_file_wins_over_the_builtin_one() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("preamble.md"), "be brief").expect("write");
    assert_eq!(read(dir.path()), "be brief");
}

#[test]
fn an_empty_file_of_your_own_is_not_a_preamble() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("preamble.md"), "   \n\n").expect("write");
    assert_eq!(read(dir.path()), builtin());
}
