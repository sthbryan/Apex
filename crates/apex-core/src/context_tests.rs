use super::*;

#[test]
fn an_empty_project_has_no_context() {
    let dir = tempfile::tempdir().expect("tempdir");
    assert!(list(dir.path()).expect("list").is_empty());
    assert_eq!(read(dir.path(), "anything").expect("read"), "");
}

#[test]
fn writing_creates_the_folder_and_the_entry_round_trips() {
    let dir = tempfile::tempdir().expect("tempdir");
    write(dir.path(), "architecture", "# Layers\n").expect("write");

    assert!(dir.path().join(".apex/context/architecture.md").is_file());
    assert_eq!(read(dir.path(), "architecture").expect("read"), "# Layers\n");

    let entries = list(dir.path()).expect("list");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].key, "architecture");
    assert!(entries[0].bytes > 0);
}

#[test]
fn keys_are_slugged_so_they_cannot_escape_the_folder() {
    let dir = tempfile::tempdir().expect("tempdir");
    write(dir.path(), "../../escape", "nope").expect("write");
    assert!(dir.path().join(".apex/context/escape.md").is_file());
    assert!(!dir.path().parent().expect("parent").join("escape.md").exists());

    write(dir.path(), "Deploy Notes", "x").expect("write");
    assert_eq!(list(dir.path()).expect("list")[0].key, "deploy-notes");
    assert!(entry_path(dir.path(), "///").is_err());
}

#[test]
fn notes_pile_up_with_who_wrote_them() {
    let dir = tempfile::tempdir().expect("tempdir");
    append_note(dir.path(), "codex", None, "the parser lives in lib.rs").expect("note");
    append_note(dir.path(), "claude", Some("codex"), "picked it up").expect("note");

    let notes = read(dir.path(), NOTES_KEY).expect("read");
    assert!(notes.contains("## codex\n"));
    assert!(notes.contains("## claude → codex\n"));
    assert!(notes.find("codex\n").unwrap() < notes.find("claude").unwrap());
    assert!(append_note(dir.path(), "codex", None, "   ").is_err());
}

#[test]
fn an_oversized_entry_is_refused() {
    let dir = tempfile::tempdir().expect("tempdir");
    let huge = "x".repeat(MAX_ENTRY_BYTES + 1);
    assert!(write(dir.path(), "huge", &huge).is_err());
    assert!(list(dir.path()).expect("list").is_empty());
}
