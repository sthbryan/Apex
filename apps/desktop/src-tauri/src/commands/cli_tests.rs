use crate::commands::cli::{Spot, look, plan, plant, pull, stock};

fn ground() -> (tempfile::TempDir, std::path::PathBuf, std::path::PathBuf) {
    let home = tempfile::tempdir().expect("tempdir");
    let target = home.path().join("apexd");
    std::fs::write(&target, "binary").expect("target");
    let link = home.path().join(".local").join("bin").join("apex");
    (home, link, target)
}

fn steady(link: &std::path::Path, target: &std::path::Path) -> Spot {
    Spot { link: link.to_path_buf(), target: target.to_path_buf(), copied_from: None }
}

#[test]
fn nothing_is_linked_before_anyone_asks() {
    let (_home, link, target) = ground();

    let state = look(&steady(&link, &target), false);

    assert!(!state.linked);
    assert!(!state.occupied);
    assert!(!state.on_path);
}

#[test]
fn planting_the_link_makes_the_folder_it_needs() {
    let (_home, link, target) = ground();

    plant(&steady(&link, &target)).expect("plant");

    assert!(look(&steady(&link, &target), false).linked);
    assert_eq!(std::fs::read_link(&link).expect("read link"), target);
}

#[test]
fn planting_twice_is_not_an_error() {
    let (_home, link, target) = ground();

    plant(&steady(&link, &target)).expect("first");
    plant(&steady(&link, &target)).expect("second");

    assert!(look(&steady(&link, &target), false).linked);
}

#[test]
fn a_stranger_at_that_path_is_never_overwritten() {
    let (_home, link, target) = ground();
    std::fs::create_dir_all(link.parent().expect("parent")).expect("bin");
    std::fs::write(&link, "someone else").expect("stranger");

    let refused = plant(&steady(&link, &target)).expect_err("should refuse");

    assert!(refused.contains("already taken"));
    assert_eq!(std::fs::read(&link).expect("read"), b"someone else");
}

#[test]
fn a_stranger_at_that_path_reads_as_occupied() {
    let (_home, link, target) = ground();
    std::fs::create_dir_all(link.parent().expect("parent")).expect("bin");
    std::fs::write(&link, "someone else").expect("stranger");

    let state = look(&steady(&link, &target), false);

    assert!(!state.linked);
    assert!(state.occupied);
}

#[test]
fn pulling_takes_our_link_and_leaves_the_target() {
    let (_home, link, target) = ground();
    plant(&steady(&link, &target)).expect("plant");

    pull(&steady(&link, &target)).expect("pull");

    assert!(!look(&steady(&link, &target), false).linked);
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

    pull(&steady(&link, &target)).expect("pull");

    assert_eq!(std::fs::read_link(&link).expect("still there"), stranger);
}

#[test]
fn the_path_only_counts_when_the_link_is_ours() {
    let (_home, link, target) = ground();

    assert!(!look(&steady(&link, &target), true).on_path);

    plant(&steady(&link, &target)).expect("plant");

    assert!(look(&steady(&link, &target), true).on_path);
}

#[test]
fn a_steady_binary_is_linked_where_it_already_lives() {
    let home = std::path::Path::new("/home/someone");
    let binary = std::path::Path::new("/Applications/Apex.app/Contents/Resources/apexd");

    let spot = plan(home, binary, false);

    assert_eq!(spot.target, binary);
    assert_eq!(spot.copied_from, None);
}

#[test]
fn a_binary_that_vanishes_is_copied_somewhere_that_stays() {
    let home = std::path::Path::new("/home/someone");
    let binary = std::path::Path::new("/tmp/.mount_apex-dGmIAeP/usr/bin/apexd");

    let spot = plan(home, binary, true);

    assert_eq!(spot.target, home.join(".local/share/apex/apexd"));
    assert_eq!(spot.copied_from.as_deref(), Some(binary));
    assert!(!spot.target.starts_with("/tmp"));
}

#[test]
fn planting_from_a_mount_leaves_a_copy_behind_the_link() {
    let home = tempfile::tempdir().expect("tempdir");
    let mount = home.path().join("mount");
    std::fs::create_dir_all(&mount).expect("mount");
    let source = mount.join("apexd");
    std::fs::write(&source, "the daemon").expect("source");
    let spot = plan(home.path(), &source, true);

    plant(&spot).expect("plant");

    assert!(look(&spot, false).linked);
    assert_eq!(std::fs::read(&spot.target).expect("copy"), b"the daemon");
    assert_eq!(std::fs::read_link(&spot.link).expect("link"), spot.target);
}

#[test]
fn pulling_a_copied_link_takes_the_copy_with_it() {
    let home = tempfile::tempdir().expect("tempdir");
    let source = home.path().join("apexd");
    std::fs::write(&source, "the daemon").expect("source");
    let spot = plan(home.path(), &source, true);
    plant(&spot).expect("plant");

    pull(&spot).expect("pull");

    assert!(!spot.target.exists());
    assert!(spot.link.symlink_metadata().is_err());
    assert!(source.is_file());
}

#[test]
fn a_newer_binary_replaces_the_copy_that_went_stale() {
    let home = tempfile::tempdir().expect("tempdir");
    let source = home.path().join("apexd");
    std::fs::write(&source, "old daemon").expect("source");
    let spot = plan(home.path(), &source, true);
    plant(&spot).expect("plant");

    std::fs::write(&source, "a much newer daemon").expect("update");
    stock(&spot).expect("stock");

    assert_eq!(std::fs::read(&spot.target).expect("copy"), b"a much newer daemon");
}

#[test]
fn a_copy_that_still_matches_is_left_alone() {
    let home = tempfile::tempdir().expect("tempdir");
    let source = home.path().join("apexd");
    std::fs::write(&source, "the daemon").expect("source");
    let spot = plan(home.path(), &source, true);
    plant(&spot).expect("plant");

    std::fs::write(&spot.target, "XXXXXXXXXX").expect("scribble");
    let stamp = std::fs::metadata(&source).expect("source").modified().expect("mtime");
    filetime::set_file_mtime(&spot.target, filetime::FileTime::from_system_time(stamp))
        .expect("mtime");

    stock(&spot).expect("stock");

    assert_eq!(std::fs::read(&spot.target).expect("copy"), b"XXXXXXXXXX");
}
