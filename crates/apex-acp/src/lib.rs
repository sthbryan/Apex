mod types;

use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::{Context, Result, anyhow, bail};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, mpsc, oneshot};

pub use types::*;

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

#[async_trait::async_trait]
pub trait Client: Send + 'static {
    async fn update(&mut self, session: &str, update: SessionUpdate);

    async fn permission(&mut self, request: PermissionRequest) -> PermissionOutcome {
        let _ = request;
        PermissionOutcome::Cancelled
    }

    async fn read_file(&mut self, path: &str) -> Result<String> {
        bail!("this client cannot read {path}")
    }

    async fn write_file(&mut self, path: &str, content: &str) -> Result<()> {
        let _ = content;
        bail!("this client cannot write {path}")
    }
}

pub struct Connection {
    outgoing: mpsc::UnboundedSender<String>,
    pending: Pending,
    next: AtomicU64,
}

impl Connection {
    pub fn new<R, W, C>(reader: R, writer: W, client: C) -> Self
    where
        R: AsyncRead + Unpin + Send + 'static,
        W: AsyncWrite + Unpin + Send + 'static,
        C: Client,
    {
        let (outgoing, mut queue) = mpsc::unbounded_channel::<String>();
        let pending: Pending = Arc::default();

        tokio::spawn(async move {
            let mut writer = writer;
            while let Some(line) = queue.recv().await {
                if writer.write_all(line.as_bytes()).await.is_err()
                    || writer.write_all(b"\n").await.is_err()
                    || writer.flush().await.is_err()
                {
                    break;
                }
            }
        });

        tokio::spawn(listen(reader, outgoing.clone(), Arc::clone(&pending), client));

        Self { outgoing, pending, next: AtomicU64::new(1) }
    }

    pub async fn request<P: Serialize, T: DeserializeOwned>(&self, method: &str, params: P) -> Result<T> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (answer, wait) = oneshot::channel();
        self.pending.lock().await.insert(id, answer);

        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": serde_json::to_value(params)?,
        });
        self.outgoing
            .send(body.to_string())
            .map_err(|_| anyhow!("the agent is no longer listening"))?;

        let reply = wait.await.map_err(|_| anyhow!("the agent closed before answering {method}"))?;
        let value = reply.map_err(|message| anyhow!("{method} failed: {message}"))?;
        serde_json::from_value(value).with_context(|| format!("could not read the answer to {method}"))
    }

    pub fn notify<P: Serialize>(&self, method: &str, params: P) -> Result<()> {
        let body = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": serde_json::to_value(params)?,
        });
        self.outgoing
            .send(body.to_string())
            .map_err(|_| anyhow!("the agent is no longer listening"))?;
        Ok(())
    }
}

async fn listen<R, C>(reader: R, outgoing: mpsc::UnboundedSender<String>, pending: Pending, mut client: C)
where
    R: AsyncRead + Unpin + Send + 'static,
    C: Client,
{
    let mut lines = BufReader::new(reader).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(message) = serde_json::from_str::<Value>(&line) else {
            tracing::warn!(line, "the agent sent something that is not json");
            continue;
        };

        let method = message.get("method").and_then(Value::as_str).map(str::to_owned);
        let id = message.get("id").cloned();
        let params = message.get("params").cloned().unwrap_or_else(|| json!({}));

        match (method, id) {
            (Some(method), Some(id)) => {
                let answer = answer_request(&mut client, &method, params).await;
                let body = match answer {
                    Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
                    Err(error) => json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": { "code": -32603, "message": format!("{error:#}") },
                    }),
                };
                if outgoing.send(body.to_string()).is_err() {
                    break;
                }
            }
            (Some(method), None) => notify_client(&mut client, &method, params).await,
            (None, Some(id)) => {
                let Some(waiting) = take_pending(&pending, &id).await else {
                    continue;
                };
                let _ = waiting.send(match message.get("error") {
                    Some(error) => Err(describe(error)),
                    None => Ok(message.get("result").cloned().unwrap_or(Value::Null)),
                });
            }
            (None, None) => tracing::warn!(line, "the agent sent a message with no method and no id"),
        }
    }

    for (_, waiting) in pending.lock().await.drain() {
        let _ = waiting.send(Err("the agent went away".to_owned()));
    }
}

async fn take_pending(pending: &Pending, id: &Value) -> Option<oneshot::Sender<Result<Value, String>>> {
    let id = id.as_u64()?;
    pending.lock().await.remove(&id)
}

fn describe(error: &Value) -> String {
    error
        .get("message")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_else(|| error.to_string())
}

async fn answer_request<C: Client>(client: &mut C, method: &str, params: Value) -> Result<Value> {
    match method {
        "session/request_permission" => {
            let request: PermissionRequest = serde_json::from_value(params)?;
            let outcome = client.permission(request).await;
            Ok(json!({ "outcome": outcome }))
        }
        "fs/read_text_file" => {
            let request: FileRequest = serde_json::from_value(params)?;
            let content = client.read_file(&request.path).await?;
            Ok(json!({ "content": content }))
        }
        "fs/write_text_file" => {
            let request: FileRequest = serde_json::from_value(params)?;
            client.write_file(&request.path, request.content.as_deref().unwrap_or_default()).await?;
            Ok(Value::Null)
        }
        other => bail!("this client does not answer {other}"),
    }
}

async fn notify_client<C: Client>(client: &mut C, method: &str, params: Value) {
    if method != "session/update" {
        return;
    }
    match serde_json::from_value::<SessionNotification>(params) {
        Ok(notice) => client.update(&notice.session_id, notice.update).await,
        Err(error) => tracing::warn!(%error, "the agent sent an update this client cannot read"),
    }
}

pub struct Agent {
    connection: Connection,
    child: Mutex<Child>,
}

impl Agent {
    pub async fn spawn<C: Client>(
        command: &str,
        args: &[String],
        env: &[(String, String)],
        cwd: &Path,
        client: C,
    ) -> Result<Self> {
        let mut process = Command::new(command);
        process
            .args(args)
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        for (key, value) in env {
            process.env(key, value);
        }

        let mut child = process.spawn().with_context(|| format!("could not start {command}"))?;
        let stdin = child.stdin.take().context("the agent has no stdin")?;
        let stdout = child.stdout.take().context("the agent has no stdout")?;
        if let Some(stderr) = child.stderr.take() {
            let name = command.to_owned();
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    tracing::debug!(agent = name, line, "acp stderr");
                }
            });
        }

        Ok(Self { connection: Connection::new(stdout, stdin, client), child: Mutex::new(child) })
    }

    pub async fn initialize(&self) -> Result<Initialized> {
        let initialized: Initialized = self
            .connection
            .request(
                "initialize",
                Initialize {
                    protocol_version: PROTOCOL_VERSION,
                    client_capabilities: ClientCapabilities {
                        fs: FsCapabilities { read_text_file: true, write_text_file: true },
                    },
                },
            )
            .await?;

        if initialized.protocol_version > PROTOCOL_VERSION {
            bail!(
                "the agent speaks acp {} and this client only speaks {PROTOCOL_VERSION}",
                initialized.protocol_version
            );
        }
        Ok(initialized)
    }

    pub async fn authenticate(&self, method: &str) -> Result<()> {
        let _: Value = self.connection.request("authenticate", json!({ "methodId": method })).await?;
        Ok(())
    }

    pub async fn new_session(&self, cwd: &Path) -> Result<String> {
        let session: NewSession = self
            .connection
            .request("session/new", json!({ "cwd": cwd, "mcpServers": [] }))
            .await?;
        Ok(session.session_id)
    }

    pub async fn prompt(&self, session: &str, text: &str) -> Result<StopReason> {
        let prompted: Prompted = self
            .connection
            .request(
                "session/prompt",
                json!({ "sessionId": session, "prompt": [ContentBlock::text(text)] }),
            )
            .await?;
        Ok(prompted.stop_reason)
    }

    pub fn cancel(&self, session: &str) -> Result<()> {
        self.connection.notify("session/cancel", json!({ "sessionId": session }))
    }

    pub async fn pid(&self) -> Option<u32> {
        self.child.lock().await.id()
    }

    pub async fn kill(&self) -> Result<()> {
        self.child.lock().await.kill().await.context("could not stop the agent")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{DuplexStream, duplex};

    struct Recorder {
        updates: mpsc::UnboundedSender<SessionUpdate>,
        choice: Option<String>,
    }

    #[async_trait::async_trait]
    impl Client for Recorder {
        async fn update(&mut self, _session: &str, update: SessionUpdate) {
            let _ = self.updates.send(update);
        }

        async fn permission(&mut self, request: PermissionRequest) -> PermissionOutcome {
            match self.choice.clone().or_else(|| {
                request.options.first().map(|option| option.option_id.clone())
            }) {
                Some(option_id) => PermissionOutcome::Selected { option_id },
                None => PermissionOutcome::Cancelled,
            }
        }

        async fn read_file(&mut self, path: &str) -> Result<String> {
            Ok(format!("the body of {path}"))
        }
    }

    fn link(choice: Option<&str>) -> (Connection, DuplexStream, mpsc::UnboundedReceiver<SessionUpdate>) {
        let (ours, theirs) = duplex(8192);
        let (reader, writer) = tokio::io::split(ours);
        let (updates, seen) = mpsc::unbounded_channel();
        let client = Recorder { updates, choice: choice.map(str::to_owned) };
        (Connection::new(reader, writer, client), theirs, seen)
    }

    async fn next_line(agent: &mut BufReader<DuplexStream>) -> Value {
        let mut line = String::new();
        agent.read_line(&mut line).await.expect("a line");
        serde_json::from_str(&line).expect("json")
    }

    async fn reply(agent: &mut DuplexStream, id: &Value, result: Value) {
        let body = json!({ "jsonrpc": "2.0", "id": id, "result": result });
        agent.write_all(format!("{body}\n").as_bytes()).await.expect("write");
    }

    #[tokio::test]
    async fn a_request_carries_its_answer_back_to_the_caller() {
        let (connection, theirs, _) = link(None);
        let mut agent = BufReader::new(theirs);

        let asking = tokio::spawn(async move {
            connection.request::<_, NewSession>("session/new", json!({ "cwd": "/tmp" })).await
        });

        let request = next_line(&mut agent).await;
        assert_eq!(request["method"], "session/new");
        assert_eq!(request["jsonrpc"], "2.0");
        reply(agent.get_mut(), &request["id"], json!({ "sessionId": "abc" })).await;

        let session = asking.await.expect("join").expect("a session");
        assert_eq!(session.session_id, "abc");
    }

    #[tokio::test]
    async fn an_error_from_the_agent_becomes_an_error_for_the_caller() {
        let (connection, theirs, _) = link(None);
        let mut agent = BufReader::new(theirs);

        let asking = tokio::spawn(async move {
            connection.request::<_, Prompted>("session/prompt", json!({})).await
        });

        let request = next_line(&mut agent).await;
        let body = json!({
            "jsonrpc": "2.0",
            "id": request["id"],
            "error": { "code": -32603, "message": "no session" },
        });
        agent.get_mut().write_all(format!("{body}\n").as_bytes()).await.expect("write");

        let failure = asking.await.expect("join").expect_err("an error");
        assert!(format!("{failure:#}").contains("no session"));
    }

    #[tokio::test]
    async fn message_chunks_and_tool_calls_reach_the_client() {
        let (_connection, mut theirs, mut seen) = link(None);

        let chunk = json!({
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {
                "sessionId": "abc",
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": { "type": "text", "text": "hello" },
                },
            },
        });
        let call = json!({
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {
                "sessionId": "abc",
                "update": {
                    "sessionUpdate": "tool_call",
                    "toolCallId": "call-1",
                    "title": "Edit main.rs",
                    "kind": "edit",
                    "status": "pending",
                    "content": [{
                        "type": "diff",
                        "path": "/tmp/main.rs",
                        "oldText": "one",
                        "newText": "two",
                    }],
                },
            },
        });
        theirs.write_all(format!("{chunk}\n{call}\n").as_bytes()).await.expect("write");

        let first = seen.recv().await.expect("a chunk");
        assert_eq!(first, SessionUpdate::AgentMessageChunk { content: ContentBlock::text("hello") });

        let second = seen.recv().await.expect("a tool call");
        let SessionUpdate::ToolCall { call } = second else {
            panic!("expected a tool call, got {second:?}");
        };
        assert_eq!(call.tool_call_id, "call-1");
        assert_eq!(call.status, Some(ToolStatus::Pending));
        assert_eq!(
            call.content,
            vec![ToolContent::Diff {
                path: "/tmp/main.rs".into(),
                old_text: Some("one".into()),
                new_text: "two".into(),
            }]
        );
    }

    #[tokio::test]
    async fn a_permission_request_is_answered_with_the_option_the_client_picked() {
        let (_connection, theirs, _) = link(Some("allow_always"));
        let mut agent = BufReader::new(theirs);

        let ask = json!({
            "jsonrpc": "2.0",
            "id": 7,
            "method": "session/request_permission",
            "params": {
                "sessionId": "abc",
                "toolCall": { "toolCallId": "call-1", "title": "Write main.rs" },
                "options": [
                    { "optionId": "allow_once", "name": "Allow once", "kind": "allow_once" },
                    { "optionId": "allow_always", "name": "Always allow", "kind": "allow_always" },
                ],
            },
        });
        agent.get_mut().write_all(format!("{ask}\n").as_bytes()).await.expect("write");

        let answer = next_line(&mut agent).await;
        assert_eq!(answer["id"], 7);
        assert_eq!(answer["result"]["outcome"]["outcome"], "selected");
        assert_eq!(answer["result"]["outcome"]["optionId"], "allow_always");
    }

    #[tokio::test]
    async fn a_read_the_client_cannot_serve_comes_back_as_a_json_rpc_error() {
        let (_connection, theirs, _) = link(None);
        let mut agent = BufReader::new(theirs);

        let ask = json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "fs/write_text_file",
            "params": { "sessionId": "abc", "path": "/tmp/one", "content": "two" },
        });
        agent.get_mut().write_all(format!("{ask}\n").as_bytes()).await.expect("write");

        let answer = next_line(&mut agent).await;
        assert_eq!(answer["id"], 3);
        assert!(answer["error"]["message"].as_str().expect("a message").contains("/tmp/one"));
    }

    #[tokio::test]
    async fn a_file_read_is_served_from_the_client() {
        let (_connection, theirs, _) = link(None);
        let mut agent = BufReader::new(theirs);

        let ask = json!({
            "jsonrpc": "2.0",
            "id": 4,
            "method": "fs/read_text_file",
            "params": { "sessionId": "abc", "path": "/tmp/one" },
        });
        agent.get_mut().write_all(format!("{ask}\n").as_bytes()).await.expect("write");

        let answer = next_line(&mut agent).await;
        assert_eq!(answer["result"]["content"], "the body of /tmp/one");
    }

    #[tokio::test]
    async fn a_dead_agent_frees_everyone_waiting_on_it() {
        let (connection, theirs, _) = link(None);
        let mut agent = BufReader::new(theirs);

        let asking =
            tokio::spawn(async move { connection.request::<_, Prompted>("session/prompt", json!({})).await });
        next_line(&mut agent).await;
        drop(agent);

        let failure = asking.await.expect("join").expect_err("an error");
        assert!(format!("{failure:#}").contains("went away"));
    }
}
