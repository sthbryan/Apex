use std::path::Path;

use anyhow::{Result, bail};
use globset::GlobBuilder;
use ignore::WalkBuilder;
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::{asked, shown, within};

const MOST_HITS: usize = 300;

#[derive(Debug, Deserialize)]
struct Args {
    glob: String,
    #[serde(default)]
    path: Option<String>,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "find".to_owned(),
        description:
            "Find files in the project whose path matches a glob. Skips whatever git ignores."
                .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "glob": { "type": "string", "description": "Glob to match against the path, such as src/**/*.rs." },
                "path": { "type": "string", "description": "Folder to look in, relative to the project root. The whole project by default." }
            },
            "required": ["glob"]
        }),
    }
}

pub async fn run(root: &Path, args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    if args.glob.trim().is_empty() {
        bail!("find needs a glob")
    }
    let matcher = GlobBuilder::new(args.glob.trim())
        .literal_separator(true)
        .build()
        .map_err(|cause| anyhow::anyhow!("{} is not a glob: {cause}", args.glob))?
        .compile_matcher();

    let start = match args.path.as_deref() {
        Some(path) => within(root, path)?,
        None => root.to_path_buf(),
    };
    let root = root.to_path_buf();

    tokio::task::spawn_blocking(move || sweep(&root, &start, &matcher)).await?
}

fn sweep(root: &Path, start: &Path, matcher: &globset::GlobMatcher) -> Result<String> {
    let mut found = Vec::new();
    let mut more = false;

    for entry in WalkBuilder::new(start).hidden(false).require_git(false).build() {
        let Ok(entry) = entry else { continue };
        if !entry.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }
        let name = shown(root, entry.path());
        if !matcher.is_match(&name) {
            continue;
        }
        if found.len() >= MOST_HITS {
            more = true;
            break;
        }
        found.push(name);
    }

    found.sort();
    Ok(spell(found, more))
}

fn spell(found: Vec<String>, more: bool) -> String {
    if found.is_empty() {
        return "nothing matched\n".to_owned();
    }
    let counted = match more {
        true => format!("the first {} files\n", found.len()),
        false => format!("{} files\n", found.len()),
    };
    format!("{counted}{}\n", found.join("\n"))
}

#[cfg(test)]
#[path = "find_tests.rs"]
mod tests;
