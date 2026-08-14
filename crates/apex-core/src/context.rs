use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};

pub const CONTEXT_DIR: &str = ".apex/context";
pub const NOTES_KEY: &str = "notes";

const MAX_ENTRY_BYTES: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub key: String,
    pub bytes: u64,
    pub updated_at: i64,
}

pub fn list(root: &Path) -> Result<Vec<Entry>> {
    let dir = root.join(CONTEXT_DIR);
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for found in fs::read_dir(&dir).with_context(|| format!("reading {}", dir.display()))? {
        let found = found?;
        let path = found.path();
        if path.extension().is_none_or(|extension| extension != "md") {
            continue;
        }
        let Some(key) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        let metadata = found.metadata()?;
        entries.push(Entry {
            key: key.to_owned(),
            bytes: metadata.len(),
            updated_at: modified_seconds(&metadata),
        });
    }

    entries.sort_by(|left, right| left.key.cmp(&right.key));
    Ok(entries)
}

pub fn read(root: &Path, key: &str) -> Result<String> {
    let path = entry_path(root, key)?;
    if !path.is_file() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).with_context(|| format!("reading {}", path.display()))
}

pub fn write(root: &Path, key: &str, contents: &str) -> Result<()> {
    if contents.len() > MAX_ENTRY_BYTES {
        bail!("{key} is larger than {MAX_ENTRY_BYTES} bytes")
    }
    let path = entry_path(root, key)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
    }
    fs::write(&path, contents).with_context(|| format!("writing {}", path.display()))
}

pub fn append_note(root: &Path, from: &str, to: Option<&str>, message: &str) -> Result<()> {
    if message.trim().is_empty() {
        bail!("the note is empty")
    }
    let existing = read(root, NOTES_KEY)?;
    let heading = match to {
        Some(target) => format!("## {from} → {target}"),
        None => format!("## {from}"),
    };
    let separator = if existing.is_empty() || existing.ends_with('\n') { "" } else { "\n" };
    let entry = format!("{separator}{heading}\n\n{}\n\n", message.trim());
    write(root, NOTES_KEY, &format!("{existing}{entry}"))
}

pub fn entry_path(root: &Path, key: &str) -> Result<PathBuf> {
    let slug = slugify(key);
    if slug.is_empty() {
        bail!("{key} is not a usable name")
    }
    Ok(root.join(CONTEXT_DIR).join(format!("{slug}.md")))
}

fn slugify(key: &str) -> String {
    let mut slug = String::new();
    for character in key.chars() {
        if character.is_ascii_alphanumeric() || character == '_' {
            slug.push(character.to_ascii_lowercase());
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    slug.trim_matches('-').to_owned()
}

fn modified_seconds(metadata: &fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|when| when.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|since| since.as_secs() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
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
}
