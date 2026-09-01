use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{Result, anyhow, bail};
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{Mutex, mpsc, oneshot};

const PROTOCOL: &str = "2025-06-18";
const PATIENCE: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Wanted {
    Stdio {
        name: String,
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: Vec<Pair>,
    },
    Http {
        name: String,
        url: String,
    },
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum Offered {
    Tagged(Wanted),
    Stdio {
        name: String,
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: Vec<Pair>,
    },
}

impl From<Offered> for Wanted {
    fn from(value: Offered) -> Self {
        match value {
            Offered::Tagged(wanted) => wanted,
            Offered::Stdio { name, command, args, env } => Self::Stdio { name, command, args, env },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Pair {
    pub name: String,
    pub value: String,
}

struct Link {
    out: mpsc::UnboundedSender<String>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>,
    next: AtomicU64,
}

impl Link {
    async fn request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (answer, wait) = oneshot::channel();
        self.pending.lock().await.insert(id, answer);
        let body = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        self.out.send(body.to_string()).map_err(|_| anyhow!("{method}: the server is gone"))?;

        let reply = tokio::time::timeout(PATIENCE, wait)
            .await
            .map_err(|_| anyhow!("{method}: the server never answered"))?
            .map_err(|_| anyhow!("{method}: the server closed"))?;

        if let Some(error) = reply.get("error") {
            let said = error.get("message").and_then(Value::as_str).unwrap_or("something failed");
            bail!("{method}: {said}")
        }
        Ok(reply.get("result").cloned().unwrap_or(Value::Null))
    }

    fn notify(&self, method: &str, params: Value) {
        let body = json!({ "jsonrpc": "2.0", "method": method, "params": params });
        let _ = self.out.send(body.to_string());
    }
}

pub struct Server {
    name: String,
    tools: Vec<ToolDefinition>,
    link: Link,
}

impl Server {
    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn tools(&self) -> &[ToolDefinition] {
        &self.tools
    }
}

#[derive(Default)]
pub struct Servers {
    list: Vec<Server>,
    troubles: Vec<String>,
}

impl Servers {
    pub async fn connect(wanted: &[Wanted], ours: &[String]) -> Self {
        let mut list = Vec::new();
        let mut troubles = Vec::new();
        for one in wanted {
            match plug(one, ours).await {
                Ok(server) => list.push(server),
                Err(cause) => {
                    tracing::warn!(%cause, "could not reach an mcp server");
                    troubles.push(format!("{}: {cause:#}", named(one)));
                }
            }
        }
        Self { list, troubles }
    }

    pub fn names(&self) -> Vec<String> {
        self.list.iter().map(|server| server.name.clone()).collect()
    }

    pub fn troubles(&self) -> &[String] {
        &self.troubles
    }

    pub fn offered(&self) -> Vec<ToolDefinition> {
        self.list.iter().flat_map(|server| server.tools.iter().cloned()).collect()
    }

    pub fn holds(&self, tool: &str) -> bool {
        self.list.iter().any(|server| server.tools.iter().any(|one| one.name == tool))
    }

    pub async fn run(&self, tool: &str, args: &Value) -> Result<String> {
        let server = self
            .list
            .iter()
            .find(|server| server.tools.iter().any(|one| one.name == tool))
            .ok_or_else(|| anyhow!("no server offers {tool}"))?;

        let answer =
            server.link.request("tools/call", json!({ "name": tool, "arguments": args })).await?;
        told(&answer)
    }

    pub fn is_empty(&self) -> bool {
        self.list.is_empty()
    }
}

fn named(wanted: &Wanted) -> &str {
    match wanted {
        Wanted::Stdio { name, .. } | Wanted::Http { name, .. } => name,
    }
}

pub fn told(answer: &Value) -> Result<String> {
    let said = answer
        .get("content")
        .and_then(Value::as_array)
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|block| block.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();

    match answer.get("isError").and_then(Value::as_bool).unwrap_or(false) {
        true => bail!("{}", if said.is_empty() { "the tool failed".to_owned() } else { said }),
        false => Ok(match said.is_empty() {
            true => "the tool said nothing".to_owned(),
            false => said,
        }),
    }
}

pub fn readable(listed: &Value, ours: &[String]) -> Vec<ToolDefinition> {
    let Some(tools) = listed.get("tools").and_then(Value::as_array) else {
        return Vec::new();
    };
    tools
        .iter()
        .filter_map(|tool| {
            let name = tool.get("name")?.as_str()?.to_owned();
            if ours.contains(&name) {
                tracing::warn!(name, "an mcp server offered a tool apex already has, keeping ours");
                return None;
            }
            Some(ToolDefinition {
                name,
                description: tool
                    .get("description")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_owned(),
                parameters: tool
                    .get("inputSchema")
                    .cloned()
                    .unwrap_or_else(|| json!({ "type": "object", "properties": {} })),
            })
        })
        .collect()
}

async fn plug(wanted: &Wanted, ours: &[String]) -> Result<Server> {
    let (name, mut child) = match wanted {
        Wanted::Http { name, .. } => bail!("{name} is an http server and apex only speaks stdio"),
        Wanted::Stdio { name, command, args, env } => {
            let mut process = Command::new(command);
            process
                .args(args)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .kill_on_drop(true);
            for pair in env {
                process.env(&pair.name, &pair.value);
            }
            (name.clone(), process.spawn()?)
        }
    };

    let writing = child.stdin.take().ok_or_else(|| anyhow!("{name} has no stdin"))?;
    let reading = child.stdout.take().ok_or_else(|| anyhow!("{name} has no stdout"))?;

    let (out, mut queue) = mpsc::unbounded_channel::<String>();
    tokio::spawn(async move {
        let mut writing = writing;
        while let Some(line) = queue.recv().await {
            if writing.write_all(line.as_bytes()).await.is_err()
                || writing.write_all(b"\n").await.is_err()
                || writing.flush().await.is_err()
            {
                break;
            }
        }
    });

    let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>> = Arc::default();
    let waiting = Arc::clone(&pending);
    tokio::spawn(async move {
        let mut lines = BufReader::new(reading).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(message) = serde_json::from_str::<Value>(&line) else { continue };
            let Some(id) = message.get("id").and_then(Value::as_u64) else { continue };
            if let Some(answer) = waiting.lock().await.remove(&id) {
                let _ = answer.send(message);
            }
        }
        for (_, answer) in waiting.lock().await.drain() {
            let _ = answer.send(json!({ "error": { "message": "the server went away" } }));
        }
    });

    tokio::spawn(async move {
        let _ = child.wait().await;
    });

    let link = Link { out, pending, next: AtomicU64::new(1) };
    link.request(
        "initialize",
        json!({
            "protocolVersion": PROTOCOL,
            "capabilities": {},
            "clientInfo": { "name": "apex", "version": env!("CARGO_PKG_VERSION") },
        }),
    )
    .await?;
    link.notify("notifications/initialized", json!({}));

    let listed = link.request("tools/list", json!({})).await?;
    let tools = readable(&listed, ours);
    Ok(Server { name, tools, link })
}

#[cfg(test)]
#[path = "mcp_tests.rs"]
mod tests;
