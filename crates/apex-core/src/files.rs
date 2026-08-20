use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use anyhow::{Context, Result, bail};
use apex_proto::{FileContents, FileEntry};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;

pub const MAX_FILE_BYTES: u64 = 1024 * 1024;
pub const MAX_IMAGE_BYTES: u64 = 16 * 1024 * 1024;

const SNIFF_BYTES: usize = 8 * 1024;

const IMAGE_TYPES: &[(&str, &str)] = &[
    ("apng", "image/apng"),
    ("avif", "image/avif"),
    ("bmp", "image/bmp"),
    ("gif", "image/gif"),
    ("ico", "image/x-icon"),
    ("jpeg", "image/jpeg"),
    ("jpg", "image/jpeg"),
    ("png", "image/png"),
    ("webp", "image/webp"),
];

pub fn list_directory(root: &Path, relative: &str) -> Result<Vec<FileEntry>> {
    let target = resolve(root, relative)?;
    if !target.is_dir() {
        bail!("{} is not a directory", target.display());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&target).with_context(|| format!("reading {}", target.display()))? {
        let entry = entry?;
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        let path = join_relative(relative, &name);
        entries.push(FileEntry { name, path, is_dir: metadata.is_dir(), size: metadata.len() });
    }

    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn read_file(root: &Path, relative: &str) -> Result<FileContents> {
    let target = resolve(root, relative)?;
    let metadata =
        fs::metadata(&target).with_context(|| format!("reading {}", target.display()))?;
    if metadata.is_dir() {
        bail!("{} is a directory", target.display());
    }

    let size = metadata.len();
    let revision = revision(&metadata);
    if let Some(mime) = image_mime(&target) {
        return read_image(&target, relative, size, revision, mime);
    }

    let truncated = size > MAX_FILE_BYTES;
    let file = fs::File::open(&target).with_context(|| format!("reading {}", target.display()))?;
    let mut capped = Vec::new();
    file.take(MAX_FILE_BYTES)
        .read_to_end(&mut capped)
        .with_context(|| format!("reading {}", target.display()))?;

    if looks_binary(&capped) {
        return Ok(FileContents {
            path: relative.to_owned(),
            text: None,
            image: None,
            revision,
            size,
            truncated: false,
            binary: true,
        });
    }

    match String::from_utf8(capped) {
        Ok(text) => Ok(FileContents {
            path: relative.to_owned(),
            text: Some(text),
            image: None,
            revision,
            size,
            truncated,
            binary: false,
        }),
        Err(_) => Ok(FileContents {
            path: relative.to_owned(),
            text: None,
            image: None,
            revision,
            size,
            truncated: false,
            binary: true,
        }),
    }
}

#[derive(Debug, thiserror::Error)]
#[error("{path} changed on disk since it was opened")]
pub struct StaleWrite {
    pub path: String,
}

pub fn write_file(
    root: &Path,
    relative: &str,
    text: &str,
    expected: Option<&str>,
) -> Result<String> {
    let target = resolve_for_write(root, relative)?;
    let current = match fs::metadata(&target) {
        Ok(metadata) if metadata.is_dir() => bail!("{} is a directory", target.display()),
        Ok(metadata) => Some(revision(&metadata)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => {
            return Err(error).with_context(|| format!("reading {}", target.display()));
        }
    };

    match (expected, current) {
        (Some(expected), Some(current)) if current.as_deref() == Some(expected) => {}
        (None, None) => {}
        _ => bail!(StaleWrite { path: relative.to_owned() }),
    }

    let parent = target.parent().context("the project root has no parent")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .with_context(|| format!("writing {}", target.display()))?;
    temporary
        .write_all(text.as_bytes())
        .and_then(|()| temporary.as_file_mut().sync_all())
        .with_context(|| format!("writing {}", target.display()))?;
    if let Ok(metadata) = fs::metadata(&target) {
        let _ = fs::set_permissions(temporary.path(), metadata.permissions());
    }
    temporary.persist(&target).with_context(|| format!("writing {}", target.display()))?;

    let metadata =
        fs::metadata(&target).with_context(|| format!("reading {}", target.display()))?;
    revision(&metadata).context("the filesystem does not report modification times")
}

pub fn revision(metadata: &fs::Metadata) -> Option<String> {
    let stamp = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?;
    Some(format!("{}-{}", stamp.as_nanos(), metadata.len()))
}

pub fn image_mime(target: &Path) -> Option<&'static str> {
    let extension = target.extension()?.to_str()?.to_lowercase();
    IMAGE_TYPES.iter().find(|(name, _)| *name == extension).map(|(_, mime)| *mime)
}

pub fn data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", STANDARD.encode(bytes))
}

fn read_image(
    target: &Path,
    relative: &str,
    size: u64,
    revision: Option<String>,
    mime: &str,
) -> Result<FileContents> {
    let image = if size > MAX_IMAGE_BYTES {
        None
    } else {
        let bytes = fs::read(target).with_context(|| format!("reading {}", target.display()))?;
        Some(data_url(mime, &bytes))
    };

    Ok(FileContents {
        path: relative.to_owned(),
        text: None,
        image,
        revision,
        size,
        truncated: false,
        binary: true,
    })
}

pub fn search_files(root: &Path, query: &str, limit: usize) -> Vec<FileEntry> {
    let needle = query.trim().to_lowercase();
    let mut found: Vec<(usize, FileEntry)> = Vec::new();

    let walk = ignore::WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .require_git(false)
        .filter_entry(|entry| entry.file_name() != ".git")
        .max_filesize(Some(MAX_FILE_BYTES))
        .build();

    for entry in walk.flatten() {
        if !entry.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }
        let Ok(relative) = entry.path().strip_prefix(root) else {
            continue;
        };
        let Some(path) = relative.to_str() else {
            continue;
        };
        let Some(rank) = rank(path, &needle) else {
            continue;
        };

        found.push((
            rank,
            FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: path.to_owned(),
                is_dir: false,
                size: entry.metadata().map(|data| data.len()).unwrap_or_default(),
            },
        ));
        if needle.is_empty() && found.len() >= limit {
            break;
        }
    }

    found.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.path.cmp(&right.1.path)));
    found.into_iter().take(limit).map(|(_, entry)| entry).collect()
}

fn rank(path: &str, needle: &str) -> Option<usize> {
    if needle.is_empty() {
        return Some(path.len());
    }
    let haystack = path.to_lowercase();
    let name = haystack.rsplit('/').next().unwrap_or(&haystack);
    if name.contains(needle) {
        return Some(path.len());
    }
    if haystack.contains(needle) {
        return Some(path.len() + 1000);
    }
    subsequence(&haystack, needle).then(|| path.len() + 2000)
}

fn subsequence(haystack: &str, needle: &str) -> bool {
    let mut characters = haystack.chars();
    needle.chars().all(|wanted| characters.any(|found| found == wanted))
}

pub fn resolve(root: &Path, relative: &str) -> Result<PathBuf> {
    let root = root.canonicalize().with_context(|| format!("resolving {}", root.display()))?;

    let requested = Path::new(relative);
    if requested.is_absolute() {
        bail!("{relative} is not relative to the project");
    }
    for component in requested.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            _ => bail!("{relative} escapes the project"),
        }
    }

    let joined = root.join(requested);
    let resolved =
        joined.canonicalize().with_context(|| format!("resolving {}", joined.display()))?;
    if !resolved.starts_with(&root) {
        bail!("{relative} escapes the project");
    }
    Ok(resolved)
}

pub fn resolve_for_write(root: &Path, relative: &str) -> Result<PathBuf> {
    if let Ok(existing) = resolve(root, relative) {
        return Ok(existing);
    }

    let requested = Path::new(relative);
    let name = requested.file_name().with_context(|| format!("{relative} has no file name"))?;
    let parent = resolve(root, requested.parent().and_then(Path::to_str).unwrap_or(""))?;
    if !parent.is_dir() {
        bail!("{} is not a directory", parent.display());
    }
    Ok(parent.join(name))
}

fn join_relative(parent: &str, name: &str) -> String {
    if parent.is_empty() {
        name.to_owned()
    } else {
        format!("{}/{}", parent.trim_end_matches('/'), name)
    }
}

fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(SNIFF_BYTES).any(|byte| *byte == 0)
}

#[cfg(test)]
#[path = "files_tests.rs"]
mod tests;
