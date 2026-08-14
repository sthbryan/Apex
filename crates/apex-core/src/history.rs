use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::profile::{AgentProfile, HistorySource};

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

    let mut found: Vec<HistoryEntry> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let session_id = path.file_stem()?.to_string_lossy().to_string();
            if session_id.is_empty() || path.is_dir() {
                return None;
            }
            Some(HistoryEntry {
                agent: profile.name.clone(),
                session_id,
                label: read_label(&path),
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
    Some(
        config
            .resume_args
            .iter()
            .map(|arg| arg.replace("{session_id}", session_id))
            .collect(),
    )
}

pub fn project_slug(root: &Path) -> String {
    root.display().to_string().replace(['/', '.'], "-")
}

fn expand_path(template: &str, project_root: &Path, home: &Path) -> PathBuf {
    let filled = template
        .replace("{project_slug}", &project_slug(project_root))
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

fn read_label(path: &Path) -> Option<String> {
    let raw = std::fs::read(path).ok()?;
    let head = &raw[..raw.len().min(LABEL_SCAN_BYTES)];

    for line in head.split(|byte| *byte == b'\n') {
        let Ok(value) = serde_json::from_slice::<serde_json::Value>(line) else {
            continue;
        };
        if let Some(text) = value.get("content").and_then(|content| content.as_str()) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(shorten(trimmed));
            }
        }
    }
    None
}

fn shorten(text: &str) -> String {
    let single_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if single_line.chars().count() <= LABEL_LIMIT {
        return single_line;
    }
    single_line.chars().take(LABEL_LIMIT).collect::<String>() + "…"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(path: &str, resume: &str) -> AgentProfile {
        AgentProfile::parse(&format!(
            "name = \"claude\"\ncommand = \"claude\"\n\
             [history]\nsource = \"dir\"\npath = \"{path}\"\nresume_args = [\"--resume\", \"{resume}\"]\n"
        ))
        .expect("perfil")
    }

    #[test]
    fn a_profile_without_history_yields_nothing() {
        let bare = AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("perfil");
        assert!(read_history(&bare, Path::new("/tmp"), Path::new("/tmp")).is_empty());
    }

    #[test]
    fn a_missing_directory_yields_nothing_instead_of_failing() {
        let profile = profile("~/no/existe/{project_slug}", "{session_id}");
        assert!(read_history(&profile, Path::new("/tmp/x"), Path::new("/tmp")).is_empty());
    }

    #[test]
    fn sessions_are_read_newest_first_with_their_label() {
        let home = tempfile::tempdir().expect("home");
        let slug = project_slug(Path::new("/Users/x/code"));
        let dir = home.path().join("sessions").join(&slug);
        std::fs::create_dir_all(&dir).expect("mkdir");

        std::fs::write(
            dir.join("aaa-111.jsonl"),
            "{\"type\":\"user\",\"content\":\"arregla el bug del login\"}\n",
        )
        .expect("escribir");
        std::thread::sleep(std::time::Duration::from_millis(1100));
        std::fs::write(dir.join("bbb-222.jsonl"), "{\"content\":\"escribe tests\"}\n")
            .expect("escribir");

        let profile = profile("~/sessions/{project_slug}", "{session_id}");
        let found = read_history(&profile, Path::new("/Users/x/code"), home.path());

        assert_eq!(found.len(), 2);
        assert_eq!(found[0].session_id, "bbb-222");
        assert_eq!(found[0].label.as_deref(), Some("escribe tests"));
        assert_eq!(found[1].session_id, "aaa-111");
        assert_eq!(found[1].label.as_deref(), Some("arregla el bug del login"));
        assert_eq!(found[0].agent, "claude");
    }

    #[test]
    fn a_session_without_readable_content_still_appears() {
        let home = tempfile::tempdir().expect("home");
        let dir = home.path().join("sessions").join(project_slug(Path::new("/p")));
        std::fs::create_dir_all(&dir).expect("mkdir");
        std::fs::write(dir.join("ccc-333.jsonl"), "esto no es json\n").expect("escribir");

        let found =
            read_history(&profile("~/sessions/{project_slug}", "{session_id}"), Path::new("/p"), home.path());
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].label, None);
    }

    #[test]
    fn a_long_label_is_shortened_to_one_line() {
        let long = "palabra ".repeat(80);
        assert!(shorten(&long).chars().count() <= LABEL_LIMIT + 1);
        assert_eq!(shorten("  varias\n  lineas  "), "varias lineas");
    }

    #[test]
    fn the_project_slug_matches_the_claude_layout() {
        assert_eq!(
            project_slug(Path::new("/Users/sthbryan/Documents/Codes/Apex")),
            "-Users-sthbryan-Documents-Codes-Apex"
        );
    }

    #[test]
    fn resume_args_substitute_the_session_id() {
        let profile = profile("~/x", "{session_id}");
        assert_eq!(
            resume_args(&profile, "abc-123"),
            Some(vec!["--resume".to_string(), "abc-123".to_string()])
        );
    }

    #[test]
    fn a_profile_without_resume_args_cannot_be_resumed() {
        let bare = AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("perfil");
        assert_eq!(resume_args(&bare, "abc"), None);
    }
}
