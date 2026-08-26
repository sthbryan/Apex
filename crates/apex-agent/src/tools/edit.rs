use anyhow::{Result, bail};
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::{Kit, asked, shown, within};

#[derive(Debug, Deserialize)]
struct Args {
    path: String,
    old: String,
    new: String,
    #[serde(default)]
    all: bool,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "edit".to_owned(),
        description: "Replace an exact piece of text in a file you have already read. Give enough surrounding text that the piece appears only once."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path to the file, relative to the project root." },
                "old": { "type": "string", "description": "The exact text to replace, copied from the file." },
                "new": { "type": "string", "description": "What it becomes." },
                "all": { "type": "boolean", "description": "Replace every occurrence instead of insisting on exactly one." }
            },
            "required": ["path", "old", "new"]
        }),
    }
}

pub async fn run(kit: &Kit, args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    let root = kit.root();
    let path = within(root, &args.path)?;
    let name = shown(root, &path);

    if !kit.has_seen(&path) {
        bail!("you have not read {name} yet, read it before you change it")
    }

    let text = tokio::fs::read_to_string(&path).await?;
    let (changed, times) = swap(&text, &args.old, &args.new, args.all)
        .map_err(|why| anyhow::anyhow!("{name} {why}"))?;
    tokio::fs::write(&path, &changed).await?;

    Ok(match times {
        1 => format!("edited {name}\n"),
        many => format!("edited {name}, {many} places\n"),
    })
}

fn swap(text: &str, old: &str, new: &str, all: bool) -> Result<(String, usize), String> {
    if old.is_empty() {
        return Err("was given nothing to replace".to_owned());
    }
    if old == new {
        return Err("was given the same text twice, nothing to do".to_owned());
    }
    let times = text.matches(old).count();
    match (times, all) {
        (0, _) => Err("does not have that text in it".to_owned()),
        (1, _) => Ok((text.replacen(old, new, 1), 1)),
        (many, true) => Ok((text.replace(old, new), many)),
        (many, false) => Err(format!("has that text {many} times, add more around it or pass all")),
    }
}

#[cfg(test)]
#[path = "edit_tests.rs"]
mod tests;
