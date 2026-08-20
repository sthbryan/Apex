use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use std::collections::HashMap;

use crate::profile::{AgentProfile, HistoryEntries, HistorySource};

const LABEL_LIMIT: usize = 120;
const LABEL_SCAN_BYTES: usize = 64 * 1024;
const MAX_ENTRIES_PER_AGENT: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryEntry {
    pub agent: String,
    pub session_id: String,
    pub label: Option<String>,
    pub updated_at: u64,
}

pub fn read_history(profile: &AgentProfile, project_root: &Path, home: &Path) -> Vec<HistoryEntry> {
    let Some(config) = &profile.history else {
        return Vec::new();
    };
    if config.source != HistorySource::Dir {
        return Vec::new();
    }

    let dir = expand_path(&config.path, project_root, home);
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };

    let wants_dirs = config.entries == HistoryEntries::Dirs;
    let index = config
        .label_file
        .as_ref()
        .zip(config.label_id_key.as_ref())
        .map(|(file, id_key)| read_label_index(&dir.join(file), id_key, &config.label_key))
        .unwrap_or_default();

    let mut found: Vec<HistoryEntry> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.is_dir() != wants_dirs {
                return None;
            }
            let session_id = if wants_dirs {
                path.file_name()?.to_string_lossy().to_string()
            } else {
                path.file_stem()?.to_string_lossy().to_string()
            };
            if session_id.is_empty() {
                return None;
            }

            let label = match index.get(&session_id) {
                Some(found) => Some(found.clone()),
                None if wants_dirs => None,
                None => read_label(&path, &config.label_key),
            };
            Some(HistoryEntry {
                agent: profile.name.clone(),
                session_id,
                label,
                updated_at: modified_seconds(&path),
            })
        })
        .collect();

    found.sort_by_key(|entry| std::cmp::Reverse(entry.updated_at));
    found.truncate(MAX_ENTRIES_PER_AGENT);
    found
}

pub fn resume_args(profile: &AgentProfile, session_id: &str) -> Option<Vec<String>> {
    let config = profile.history.as_ref()?;
    if config.resume_args.is_empty() {
        return None;
    }
    Some(config.resume_args.iter().map(|arg| arg.replace("{session_id}", session_id)).collect())
}

pub fn project_slug(root: &Path) -> String {
    root.display().to_string().replace(['/', '.'], "-")
}

pub fn project_encoded(root: &Path) -> String {
    root.display()
        .to_string()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || "-._~".contains(character) {
                character.to_string()
            } else {
                let mut encoded = String::new();
                let mut buffer = [0u8; 4];
                for byte in character.encode_utf8(&mut buffer).as_bytes() {
                    encoded.push_str(&format!("%{byte:02X}"));
                }
                encoded
            }
        })
        .collect()
}

fn expand_path(template: &str, project_root: &Path, home: &Path) -> PathBuf {
    let filled = template
        .replace("{project_slug}", &project_slug(project_root))
        .replace("{project_encoded}", &project_encoded(project_root))
        .replace("{project_root}", &project_root.display().to_string());

    match filled.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None => PathBuf::from(filled),
    }
}

fn modified_seconds(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

fn read_label(path: &Path, key: &str) -> Option<String> {
    let raw = std::fs::read(path).ok()?;
    let head = &raw[..raw.len().min(LABEL_SCAN_BYTES)];

    for line in head.split(|byte| *byte == b'\n') {
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(line) else {
            continue;
        };
        if let Some(text) = value.get(key).and_then(|content| content.as_str()) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(shorten(trimmed));
            }
        }
    }
    None
}

fn read_label_index(path: &Path, id_key: &str, text_key: &str) -> HashMap<String, String> {
    let Ok(raw) = std::fs::read(path) else {
        return HashMap::new();
    };

    let mut index = HashMap::new();
    for line in raw.split(|byte| *byte == b'\n') {
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(line) else {
            continue;
        };
        let (Some(id), Some(text)) = (
            value.get(id_key).and_then(|entry| entry.as_str()),
            value.get(text_key).and_then(|entry| entry.as_str()),
        ) else {
            continue;
        };
        if !text.trim().is_empty() {
            index.entry(id.to_string()).or_insert_with(|| shorten(text.trim()));
        }
    }
    index
}

fn shorten(text: &str) -> String {
    let single_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if single_line.chars().count() <= LABEL_LIMIT {
        return single_line;
    }
    single_line.chars().take(LABEL_LIMIT).collect::<String>() + "…"
}

#[cfg(test)]
#[path = "history_tests.rs"]
mod tests;
