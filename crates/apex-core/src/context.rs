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
#[path = "context_tests.rs"]
mod tests;
