use crate::commands::cli::{look, plant, pull};

fn ground() -> (tempfile::TempDir, std::path::PathBuf, std::path::PathBuf) {
    let home = tempfile::tempdir().expect("tempdir");
    let target = home.path().join("apexd");
    std::fs::write(&target, "binary").expect("target");
    let link = home.path().join(".local").join("bin").join("apex");
    (home, link, target)
}

#[test]
fn nothing_is_linked_before_anyone_asks() {
    let (_home, link, target) = ground();

    let state = look(&link, &target, false);

    assert!(!state.linked);
    assert!(!state.occupied);
    assert!(!state.on_path);
}

#[test]
fn planting_the_link_makes_the_folder_it_needs() {
    let (_home, link, target) = ground();

    plant(&link, &target).expect("plant");

    assert!(look(&link, &target, false).linked);
    assert_eq!(std::fs::read_link(&link).expect("read link"), target);
}

#[test]
fn planting_twice_is_not_an_error() {
    let (_home, link, target) = ground();

    plant(&link, &target).expect("first");
    plant(&link, &target).expect("second");

    assert!(look(&link, &target, false).linked);
}

#[test]
fn a_stranger_at_that_path_is_never_overwritten() {
    let (_home, link, target) = ground();
    std::fs::create_dir_all(link.parent().expect("parent")).expect("bin");
    std::fs::write(&link, "someone else").expect("stranger");

    let refused = plant(&link, &target).expect_err("should refuse");

    assert!(refused.contains("already taken"));
    assert_eq!(std::fs::read(&link).expect("read"), b"someone else");
}

#[test]
fn a_stranger_at_that_path_reads_as_occupied() {
    let (_home, link, target) = ground();
    std::fs::create_dir_all(link.parent().expect("parent")).expect("bin");
    std::fs::write(&link, "someone else").expect("stranger");

    let state = look(&link, &target, false);

    assert!(!state.linked);
    assert!(state.occupied);
}

#[test]
fn pulling_takes_our_link_and_leaves_the_target() {
    let (_home, link, target) = ground();
    plant(&link, &target).expect("plant");

    pull(&link, &target).expect("pull");

    assert!(!look(&link, &target, false).linked);
    assert!(link.symlink_metadata().is_err());
    assert!(target.is_file());
}

#[test]
fn pulling_never_touches_a_link_that_is_not_ours() {
    let (_home, link, target) = ground();
    let stranger = target.parent().expect("parent").join("something-else");
    std::fs::write(&stranger, "other").expect("other");
    std::fs::create_dir_all(link.parent().expect("parent")).expect("bin");
    std::os::unix::fs::symlink(&stranger, &link).expect("symlink");

    pull(&link, &target).expect("pull");

    assert_eq!(std::fs::read_link(&link).expect("still there"), stranger);
}

#[test]
fn the_path_only_counts_when_the_link_is_ours() {
    let (_home, link, target) = ground();

    assert!(!look(&link, &target, true).on_path);

    plant(&link, &target).expect("plant");

    assert!(look(&link, &target, true).on_path);
}
