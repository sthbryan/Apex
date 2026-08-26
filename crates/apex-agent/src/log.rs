use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rig_core::completion::Message;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Head {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub cwd: String,
    pub at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum Line {
    Head(Head),
    Turn { message: Message },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Kept {
    pub head: Head,
    pub title: String,
    pub turns: usize,
}

pub struct Log {
    path: PathBuf,
}

impl Log {
    pub fn start(agent_dir: &Path, head: &Head) -> Result<Self> {
        std::fs::create_dir_all(agent_dir)
            .with_context(|| format!("making {}", agent_dir.display()))?;
        let log = Self { path: agent_dir.join(format!("{}.jsonl", head.id)) };
        log.append(&Line::Head(head.clone()))?;
        Ok(log)
    }

    pub fn wrote(&self, message: &Message) {
        if let Err(cause) = self.append(&Line::Turn { message: message.clone() }) {
            tracing::warn!(%cause, "could not write the conversation down");
        }
    }

    fn append(&self, line: &Line) -> Result<()> {
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .with_context(|| format!("opening {}", self.path.display()))?;
        writeln!(file, "{}", serde_json::to_string(line)?)?;
        Ok(())
    }
}

pub fn newest_id(now: chrono::DateTime<chrono::Local>) -> String {
    let tail = uuid::Uuid::new_v4().simple().to_string();
    format!("{}-{}", now.format("%Y%m%d-%H%M%S"), &tail[..4])
}

pub fn open(agent_dir: &Path, id: &str) -> Result<(Head, Vec<Message>)> {
    let path = agent_dir.join(format!("{id}.jsonl"));
    let raw = std::fs::read_to_string(&path)
        .with_context(|| format!("there is no session called {id}"))?;
    read(&raw).with_context(|| format!("{} is not a conversation", path.display()))
}

pub fn read(raw: &str) -> Result<(Head, Vec<Message>)> {
    let mut head = None;
    let mut messages = Vec::new();
    for line in raw.lines().filter(|line| !line.trim().is_empty()) {
        match serde_json::from_str::<Line>(line) {
            Ok(Line::Head(found)) => head = Some(found),
            Ok(Line::Turn { message }) => messages.push(message),
            Err(cause) => tracing::warn!(%cause, "skipped a line of the conversation"),
        }
    }
    Ok((head.context("it has no beginning")?, messages))
}

pub fn list(agent_dir: &Path) -> Vec<Kept> {
    let Ok(entries) = std::fs::read_dir(agent_dir) else {
        return Vec::new();
    };
    let mut kept: Vec<Kept> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "jsonl"))
        .filter_map(|path| std::fs::read_to_string(&path).ok())
        .filter_map(|raw| read(&raw).ok())
        .map(|(head, messages)| Kept {
            head,
            title: title(&messages),
            turns: messages.iter().filter(|message| asked(message)).count(),
        })
        .collect();
    kept.sort_by_key(|one| std::cmp::Reverse(one.head.at));
    kept
}

pub fn title(messages: &[Message]) -> String {
    const MOST: usize = 60;
    let first = messages.iter().find_map(said);
    let Some(first) = first else {
        return "nothing was said".to_owned();
    };
    let one = first.lines().find(|line| !line.trim().is_empty()).unwrap_or_default().trim();
    match one.chars().count() > MOST {
        true => format!("{}…", one.chars().take(MOST).collect::<String>()),
        false => one.to_owned(),
    }
}

fn asked(message: &Message) -> bool {
    said(message).is_some()
}

fn said(message: &Message) -> Option<String> {
    let Message::User { content } = message else {
        return None;
    };
    content.iter().find_map(|part| match part {
        rig_core::message::UserContent::Text(text) => Some(text.text.clone()),
        _ => None,
    })
}

#[cfg(test)]
#[path = "log_tests.rs"]
mod tests;
