use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use anyhow::{Context, Result, bail};
use apex_proto::{FileContents, FileEntry};

pub const MAX_FILE_BYTES: u64 = 1024 * 1024;

const SNIFF_BYTES: usize = 8 * 1024;

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
        entries.push(FileEntry {
            name,
            path,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
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
            size,
            truncated: false,
            binary: true,
        });
    }

    match String::from_utf8(capped) {
        Ok(text) => Ok(FileContents {
            path: relative.to_owned(),
            text: Some(text),
            size,
            truncated,
            binary: false,
        }),
        Err(_) => Ok(FileContents {
            path: relative.to_owned(),
            text: None,
            size,
            truncated: false,
            binary: true,
        }),
    }
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
    let root = root
        .canonicalize()
        .with_context(|| format!("resolving {}", root.display()))?;

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
    let resolved = joined
        .canonicalize()
        .with_context(|| format!("resolving {}", joined.display()))?;
    if !resolved.starts_with(&root) {
        bail!("{relative} escapes the project");
    }
    Ok(resolved)
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
mod tests {
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
}
