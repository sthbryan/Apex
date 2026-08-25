use std::path::Path;

use super::{content_type, dir, ensure};

#[test]
fn the_folder_hangs_off_the_working_directory() {
    assert_eq!(dir(Path::new("/tmp/project")), Path::new("/tmp/project/.apex/preview"));
}

#[test]
fn making_the_folder_makes_it_ignore_itself() {
    let home = tempfile::tempdir().unwrap();
    let made = ensure(home.path()).unwrap();
    assert_eq!(made, dir(home.path()));
    assert_eq!(std::fs::read_to_string(made.join(".gitignore")).unwrap(), "*\n");
}

#[test]
fn making_the_folder_twice_leaves_an_edited_ignore_alone() {
    let home = tempfile::tempdir().unwrap();
    let made = ensure(home.path()).unwrap();
    std::fs::write(made.join(".gitignore"), "*\n!keep.html\n").unwrap();
    ensure(home.path()).unwrap();
    assert_eq!(std::fs::read_to_string(made.join(".gitignore")).unwrap(), "*\n!keep.html\n");
}

#[test]
fn names_the_types_a_page_needs_to_load() {
    assert_eq!(content_type(Path::new("a/index.html")), "text/html; charset=utf-8");
    assert_eq!(content_type(Path::new("a/style.CSS")), "text/css; charset=utf-8");
    assert_eq!(content_type(Path::new("a/app.mjs")), "text/javascript; charset=utf-8");
    assert_eq!(content_type(Path::new("a/logo.svg")), "image/svg+xml");
    assert_eq!(content_type(Path::new("a/font.woff2")), "font/woff2");
}

#[test]
fn refuses_to_guess_at_anything_else() {
    assert_eq!(content_type(Path::new("a/blob.bin")), "application/octet-stream");
    assert_eq!(content_type(Path::new("a/noextension")), "application/octet-stream");
    assert_eq!(content_type(Path::new("a/.gitignore")), "application/octet-stream");
}
