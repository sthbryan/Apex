use anyhow::{Result, bail};
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::{Kit, asked, shown, within};

const MOST_LINES: usize = 2000;
const MOST_BYTES: u64 = 400_000;

#[derive(Debug, Deserialize)]
struct Args {
    path: String,
    #[serde(default)]
    offset: Option<usize>,
    #[serde(default)]
    limit: Option<usize>,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "read".to_owned(),
        description: "Read a text file from the project. Read a file before you change it."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path to the file, relative to the project root." },
                "offset": { "type": "integer", "description": "First line to read, counting from 1." },
                "limit": { "type": "integer", "description": "How many lines to read." }
            },
            "required": ["path"]
        }),
    }
}

pub async fn run(kit: &Kit, args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    let root = kit.root();
    let path = within(root, &args.path)?;

    let facts = tokio::fs::metadata(&path).await?;
    if facts.is_dir() {
        bail!("{} is a folder, not a file", args.path)
    }
    if facts.len() > MOST_BYTES {
        bail!("{} is {} bytes, too big to read whole", args.path, facts.len())
    }

    let raw = tokio::fs::read(&path).await?;
    if raw.contains(&0) {
        bail!("{} looks binary", args.path)
    }
    let text = String::from_utf8(raw)?;
    kit.saw(&path);
    Ok(cut(&shown(root, &path), &text, args.offset, args.limit))
}

fn cut(name: &str, text: &str, offset: Option<usize>, limit: Option<usize>) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let whole = lines.len();
    if whole == 0 {
        return format!("{name} is empty\n");
    }
    let from = offset.unwrap_or(1).max(1);
    if from > whole {
        return format!("{name} has {whole} lines, so there is nothing at line {from}\n");
    }
    let want = limit.unwrap_or(MOST_LINES).min(MOST_LINES);
    let to = (from - 1 + want).min(whole);
    let body = lines[from - 1..to].join("\n");

    match from == 1 && to == whole {
        true => format!("{name}, {whole} lines\n{body}\n"),
        false => format!("{name}, lines {from} to {to} of {whole}\n{body}\n"),
    }
}

#[cfg(test)]
#[path = "read_tests.rs"]
mod tests;
