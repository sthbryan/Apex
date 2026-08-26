use std::path::Path;

use anyhow::{Result, bail};
use ignore::WalkBuilder;
use regex::RegexBuilder;
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::{asked, shown, within};

const MOST_HITS: usize = 200;
const MOST_BYTES: u64 = 400_000;

#[derive(Debug, Deserialize)]
struct Args {
    pattern: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    ignore_case: bool,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "search".to_owned(),
        description: "Search the project for a regular expression. Skips whatever git ignores."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "pattern": { "type": "string", "description": "Rust regular expression to look for." },
                "path": { "type": "string", "description": "Folder or file to search in, relative to the project root. The whole project by default." },
                "ignore_case": { "type": "boolean", "description": "Match without caring about case." }
            },
            "required": ["pattern"]
        }),
    }
}

pub async fn run(root: &Path, args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    if args.pattern.is_empty() {
        bail!("search needs a pattern")
    }
    let looking = RegexBuilder::new(&args.pattern)
        .case_insensitive(args.ignore_case)
        .build()
        .map_err(|cause| anyhow::anyhow!("{} is not a pattern: {cause}", args.pattern))?;

    let start = match args.path.as_deref() {
        Some(path) => within(root, path)?,
        None => root.to_path_buf(),
    };
    let root = root.to_path_buf();

    tokio::task::spawn_blocking(move || sweep(&root, &start, &looking)).await?
}

fn sweep(root: &Path, start: &Path, looking: &regex::Regex) -> Result<String> {
    let mut hits = Vec::new();
    let mut more = false;

    for found in WalkBuilder::new(start).hidden(false).require_git(false).build() {
        let Ok(entry) = found else { continue };
        if !entry.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }
        if entry.metadata().map(|facts| facts.len() > MOST_BYTES).unwrap_or(true) {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(entry.path()) else { continue };
        for (number, line) in text.lines().enumerate() {
            if !looking.is_match(line) {
                continue;
            }
            if hits.len() >= MOST_HITS {
                more = true;
                break;
            }
            hits.push(format!("{}:{}: {}", shown(root, entry.path()), number + 1, line.trim_end()));
        }
        if more {
            break;
        }
    }

    Ok(spell(hits, more))
}

fn spell(hits: Vec<String>, more: bool) -> String {
    if hits.is_empty() {
        return "nothing matched\n".to_owned();
    }
    let counted = match more {
        true => format!("the first {} matches\n", hits.len()),
        false => format!("{} matches\n", hits.len()),
    };
    format!("{counted}{}\n", hits.join("\n"))
}

#[cfg(test)]
#[path = "search_tests.rs"]
mod tests;
