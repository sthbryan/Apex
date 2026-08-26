use std::process::Stdio;
use std::time::Duration;

use anyhow::{Result, bail};
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::process::Command;

use super::{Kit, asked};

const MOST_OUTPUT: usize = 30_000;
const WAIT_BY_DEFAULT: u64 = 120;
const MOST_WAIT: u64 = 600;

#[derive(Debug, Deserialize)]
struct Args {
    command: String,
    #[serde(default)]
    timeout_seconds: Option<u64>,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "bash".to_owned(),
        description: "Run a shell command in the project folder and get back what it printed. Use the other tools for reading and searching, they are cheaper."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "command": { "type": "string", "description": "The command line to run." },
                "timeout_seconds": { "type": "integer", "description": "How long to wait before giving up. 120 by default, 600 at most." }
            },
            "required": ["command"]
        }),
    }
}

pub async fn run(kit: &Kit, args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    if args.command.trim().is_empty() {
        bail!("bash needs a command")
    }
    let wait = Duration::from_secs(args.timeout_seconds.unwrap_or(WAIT_BY_DEFAULT).min(MOST_WAIT));

    let child = Command::new("/bin/sh")
        .arg("-c")
        .arg(&args.command)
        .current_dir(kit.root())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()?;

    let Ok(finished) = tokio::time::timeout(wait, child.wait_with_output()).await else {
        bail!("gave up after {} seconds", wait.as_secs())
    };
    let finished = finished?;

    let mut printed = String::from_utf8_lossy(&finished.stdout).into_owned();
    let complaints = String::from_utf8_lossy(&finished.stderr);
    if !complaints.trim().is_empty() {
        printed.push_str(&complaints);
    }
    Ok(spell(finished.status.code(), &printed))
}

fn spell(code: Option<i32>, printed: &str) -> String {
    let ending = match code {
        Some(0) => "ok".to_owned(),
        Some(code) => format!("exit {code}"),
        None => "stopped by a signal".to_owned(),
    };
    match printed.trim().is_empty() {
        true => format!("{ending}, printed nothing\n"),
        false => format!("{ending}\n{}\n", clipped(printed)),
    }
}

fn clipped(printed: &str) -> String {
    if printed.chars().count() <= MOST_OUTPUT {
        return printed.trim_end().to_owned();
    }
    let half = MOST_OUTPUT / 2;
    let head: String = printed.chars().take(half).collect();
    let tail: String = printed.chars().skip(printed.chars().count() - half).collect();
    format!(
        "{head}\n… cut, {} characters in the middle …\n{tail}",
        printed.chars().count() - MOST_OUTPUT
    )
}

#[cfg(test)]
#[path = "bash_tests.rs"]
mod tests;
