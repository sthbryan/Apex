use anyhow::{Result, bail};
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::{Kit, asked, shown, within};

#[derive(Debug, Deserialize)]
struct Args {
    path: String,
    content: String,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "write".to_owned(),
        description: "Write a whole file, creating it or replacing what is there. Read a file that already exists before you replace it. To change part of a file, use edit instead."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path to the file, relative to the project root." },
                "content": { "type": "string", "description": "The whole content the file should end up with." }
            },
            "required": ["path", "content"]
        }),
    }
}

pub async fn run(kit: &Kit, args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    let root = kit.root();
    let path = within(root, &args.path)?;
    let name = shown(root, &path);

    let there = tokio::fs::metadata(&path).await.ok();
    if there.as_ref().is_some_and(|facts| facts.is_dir()) {
        bail!("{name} is a folder, not a file")
    }
    if there.is_some() && !kit.has_seen(&path) {
        bail!("{name} is already there and you have not read it, read it first")
    }

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(&path, &args.content).await?;
    kit.saw(&path);

    let lines = args.content.lines().count();
    Ok(match there.is_some() {
        true => format!("replaced {name}, now {lines} lines\n"),
        false => format!("wrote {name}, {lines} lines\n"),
    })
}
