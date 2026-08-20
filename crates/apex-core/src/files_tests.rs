use super::*;

fn sample() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tempdir");
    fs::create_dir(dir.path().join("src")).expect("src");
    fs::write(dir.path().join("src/main.rs"), "fn main() {}\n").expect("main.rs");
    fs::write(dir.path().join("README.md"), "# sample\n").expect("readme");
    dir
}

#[test]
fn lists_directories_before_files() {
    let dir = sample();
    let entries = list_directory(dir.path(), "").expect("listing");
    assert_eq!(entries[0].name, "src");
    assert!(entries[0].is_dir);
    assert_eq!(entries[1].name, "README.md");
}

#[test]
fn nests_relative_paths() {
    let dir = sample();
    let entries = list_directory(dir.path(), "src").expect("listing");
    assert_eq!(entries[0].path, "src/main.rs");
}

#[test]
fn reads_text_files() {
    let dir = sample();
    let contents = read_file(dir.path(), "src/main.rs").expect("contents");
    assert_eq!(contents.text.as_deref(), Some("fn main() {}\n"));
    assert!(!contents.binary);
}

#[test]
fn reports_binary_files_without_text() {
    let dir = sample();
    fs::write(dir.path().join("blob.bin"), [0x00, 0x01, 0x02]).expect("blob");
    let contents = read_file(dir.path(), "blob.bin").expect("contents");
    assert!(contents.binary);
    assert!(contents.text.is_none());
}

#[test]
fn reads_images_as_data_urls() {
    let dir = sample();
    fs::write(dir.path().join("logo.png"), [0x89, 0x50, 0x4e, 0x47]).expect("logo");
    let contents = read_file(dir.path(), "logo.png").expect("contents");
    assert!(contents.binary);
    assert!(contents.text.is_none());
    assert_eq!(contents.image.as_deref(), Some("data:image/png;base64,iVBORw=="));
}

#[test]
fn skips_images_beyond_the_preview_limit() {
    let dir = sample();
    let heavy = vec![0u8; MAX_IMAGE_BYTES as usize + 1];
    fs::write(dir.path().join("huge.png"), &heavy).expect("huge");
    let contents = read_file(dir.path(), "huge.png").expect("contents");
    assert!(contents.binary);
    assert!(contents.image.is_none());
}

#[test]
fn truncates_oversized_files() {
    let dir = sample();
    let big = "a".repeat(MAX_FILE_BYTES as usize + 10);
    fs::write(dir.path().join("big.txt"), &big).expect("big");
    let contents = read_file(dir.path(), "big.txt").expect("contents");
    assert!(contents.truncated);
    assert_eq!(contents.text.expect("text").len(), MAX_FILE_BYTES as usize);
}

#[test]
fn search_prefers_matches_on_the_file_name() {
    let dir = sample();
    fs::write(dir.path().join("src/main_test.rs"), "").expect("write");
    let found = search_files(dir.path(), "main", 10);
    assert_eq!(found[0].path, "src/main.rs");
    assert_eq!(found.len(), 2);
}

#[test]
fn search_matches_loose_sequences_and_honours_the_limit() {
    let dir = sample();
    assert_eq!(search_files(dir.path(), "srmn", 10)[0].path, "src/main.rs");
    assert_eq!(search_files(dir.path(), "", 1).len(), 1);
}

#[test]
fn search_skips_ignored_files() {
    let dir = sample();
    fs::write(dir.path().join(".gitignore"), "secret.txt\n").expect("gitignore");
    fs::write(dir.path().join("secret.txt"), "").expect("secret");
    assert!(search_files(dir.path(), "secret", 10).is_empty());
}

#[test]
fn rejects_paths_outside_the_project() {
    let dir = sample();
    assert!(list_directory(dir.path(), "../..").is_err());
    assert!(read_file(dir.path(), "/etc/hosts").is_err());
}

#[test]
fn rejects_symlinks_leaving_the_project() {
    let dir = sample();
    let outside = tempfile::tempdir().expect("outside");
    fs::write(outside.path().join("secret.txt"), "nope").expect("secret");
    std::os::unix::fs::symlink(outside.path().join("secret.txt"), dir.path().join("link.txt"))
        .expect("symlink");
    assert!(read_file(dir.path(), "link.txt").is_err());
}
