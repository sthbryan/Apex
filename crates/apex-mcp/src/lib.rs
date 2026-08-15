mod tools;

use anyhow::{Context, Result};
use apex_proto::{Command, Reply};
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use uuid::Uuid;

pub use tools::{Caller, TOOLS};

pub const PROTOCOL_VERSION: &str = "2025-06-18";
pub const SERVER_NAME: &str = "apex";

#[allow(async_fn_in_trait)]
pub trait Daemon {
    async fn request(&mut self, command: Command) -> Result<Reply>;
}

pub async fn serve<D, R, W>(daemon: &mut D, caller: &Caller, input: R, mut output: W) -> Result<()>
where
    D: Daemon,
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin,
{
    let mut lines = BufReader::new(input).lines();
    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }
        let Some(response) = handle(daemon, caller, &line).await else {
            continue;
        };
        output.write_all(response.as_bytes()).await?;
        output.write_all(b"\n").await?;
        output.flush().await?;
    }
    Ok(())
}

async fn handle<D: Daemon>(daemon: &mut D, caller: &Caller, line: &str) -> Option<String> {
    let request: Value = match serde_json::from_str(line) {
        Ok(value) => value,
        Err(error) => {
            return Some(error_body(Value::Null, -32700, &format!("invalid json: {error}")));
        }
    };

    let id = request.get("id").cloned()?;
    let method = request.get("method").and_then(Value::as_str).unwrap_or_default();
    let params = request.get("params").cloned().unwrap_or_else(|| json!({}));

    match method {
        "initialize" => Some(result_body(id, initialize())),
        "ping" => Some(result_body(id, json!({}))),
        "tools/list" => Some(result_body(id, tool_list())),
        "tools/call" => match call(daemon, caller, &params).await {
            Ok(text) => Some(result_body(id, content(&text, false))),
            Err(error) => Some(result_body(id, content(&format!("{error:#}"), true))),
        },
        other => Some(error_body(id, -32601, &format!("unknown method {other}"))),
    }
}

fn initialize() -> Value {
    json!({
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": { "tools": {} },
        "serverInfo": { "name": SERVER_NAME, "version": env!("CARGO_PKG_VERSION") },
        "instructions": "Apex shares context between the agents working on this project. \
                         Read the shared context before starting, and write down what the \
                         others would need to know."
    })
}

fn tool_list() -> Value {
    json!({
        "tools": TOOLS
            .iter()
            .map(|tool| json!({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": (tool.schema)(),
            }))
            .collect::<Vec<_>>()
    })
}

async fn call<D: Daemon>(daemon: &mut D, caller: &Caller, params: &Value) -> Result<String> {
    let name = params.get("name").and_then(Value::as_str).context("the call has no tool name")?;
    let arguments = params.get("arguments").cloned().unwrap_or_else(|| json!({}));

    if name == "apex_worktree_info" {
        return Ok(tools::describe_worktree(caller));
    }

    let command = tools::command_for(caller, name, &arguments)?;
    let reply = daemon.request(command).await?;

    Ok(match reply {
        Reply::Text { text } if text.trim().is_empty() => "There is nothing there yet.".to_owned(),
        Reply::Text { text } => text,
        Reply::Context { entries } if entries.is_empty() => {
            "The shared context is empty. Write the first entry.".to_owned()
        }
        Reply::Context { entries } => entries
            .iter()
            .map(|entry| format!("- {} ({} bytes)", entry.key, entry.bytes))
            .collect::<Vec<_>>()
            .join("\n"),
        Reply::Sessions { sessions } => tools::describe_sessions(caller, &sessions),
        Reply::Done => "Done.".to_owned(),
        other => format!("Unexpected answer from the daemon: {other:?}"),
    })
}

fn content(text: &str, failed: bool) -> Value {
    json!({ "content": [{ "type": "text", "text": text }], "isError": failed })
}

fn result_body(id: Value, result: Value) -> String {
    json!({ "jsonrpc": "2.0", "id": id, "result": result }).to_string()
}

fn error_body(id: Value, code: i32, message: &str) -> String {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } }).to_string()
}

pub async fn caller_for<D: Daemon>(
    daemon: &mut D,
    session: Option<Uuid>,
    cwd: &std::path::Path,
) -> Result<Caller> {
    let Reply::Sessions { sessions } = daemon.request(Command::ListSessions).await? else {
        anyhow::bail!("the daemon did not answer with sessions")
    };

    let summary = session
        .and_then(|wanted| sessions.iter().find(|found| found.id == wanted).cloned())
        .or_else(|| running_in(&sessions, cwd))
        .with_context(|| format!("no session of this project is running in {}", cwd.display()))?;

    Ok(Caller {
        session: summary.id,
        project: summary.project_id,
        title: summary.title.clone(),
        summary,
    })
}

fn running_in(sessions: &[apex_proto::SessionSummary], cwd: &std::path::Path) -> Option<apex_proto::SessionSummary> {
    let wanted = cwd.canonicalize().unwrap_or_else(|_| cwd.to_path_buf());
    sessions
        .iter()
        .filter(|session| session.is_alive())
        .find(|session| {
            let theirs = std::path::Path::new(&session.cwd);
            theirs.canonicalize().unwrap_or_else(|_| theirs.to_path_buf()) == wanted
        })
        .cloned()
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
