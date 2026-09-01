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
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

use agent_client_protocol::schema::{ProtocolVersion, v1 as sdk};
use agent_client_protocol::{Agent as SdkAgent, ByteStreams, ConnectionTo};

pub use types::*;

const STDERR_KEPT: usize = 20;

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

#[async_trait::async_trait]
pub trait Client: Send + Sync + 'static {
    async fn update(&self, session: &str, update: SessionUpdate);

    async fn permission(&self, request: PermissionRequest) -> PermissionOutcome {
        let _ = request;
        PermissionOutcome::Cancelled
    }

    async fn read_file(&self, path: &str) -> Result<String> {
        bail!("this client cannot read {path}")
    }

    async fn write_file(&self, path: &str, content: &str) -> Result<()> {
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

    pub async fn request<P: Serialize, T: DeserializeOwned>(
        &self,
        method: &str,
        params: P,
    ) -> Result<T> {
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

        let reply =
            wait.await.map_err(|_| anyhow!("the agent closed before answering {method}"))?;
        let value = reply.map_err(|message| anyhow!("{method} failed: {message}"))?;
        serde_json::from_value(value)
            .with_context(|| format!("could not read the answer to {method}"))
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

async fn listen<R, C>(
    reader: R,
    outgoing: mpsc::UnboundedSender<String>,
    pending: Pending,
    client: C,
) where
    R: AsyncRead + Unpin + Send + 'static,
    C: Client,
{
    let client = Arc::new(client);
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
                let asked = Arc::clone(&client);
                let back = outgoing.clone();
                tokio::spawn(async move {
                    let answer = answer_request(asked.as_ref(), &method, params).await;
                    let body = match answer {
                        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
                        Err(error) => json!({
                            "jsonrpc": "2.0",
                            "id": id,
                            "error": { "code": -32603, "message": format!("{error:#}") },
                        }),
                    };
                    let _ = back.send(body.to_string());
                });
            }
            (Some(method), None) => notify_client(client.as_ref(), &method, params).await,
            (None, Some(id)) => {
                let Some(waiting) = take_pending(&pending, &id).await else {
                    continue;
                };
                let _ = waiting.send(match message.get("error") {
                    Some(error) => Err(describe(error)),
                    None => Ok(message.get("result").cloned().unwrap_or(Value::Null)),
                });
            }
            (None, None) => {
                tracing::warn!(line, "the agent sent a message with no method and no id")
            }
        }
    }

    for (_, waiting) in pending.lock().await.drain() {
        let _ = waiting.send(Err("the agent went away".to_owned()));
    }
}

async fn take_pending(
    pending: &Pending,
    id: &Value,
) -> Option<oneshot::Sender<Result<Value, String>>> {
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

fn sdk_error(error: impl std::fmt::Display) -> agent_client_protocol::Error {
    agent_client_protocol::Error::new(-32603, error.to_string())
}

async fn sdk_connection<R, W, C>(reader: R, writer: W, client: C) -> Result<ConnectionTo<SdkAgent>>
where
    R: AsyncRead + Unpin + Send + 'static,
    W: AsyncWrite + Unpin + Send + 'static,
    C: Client,
{
    let client = Arc::new(client);
    let updates = Arc::clone(&client);
    let permissions = Arc::clone(&client);
    let reads = Arc::clone(&client);
    let writes = Arc::clone(&client);
    let builder = agent_client_protocol::Client
        .builder()
        .name("apex")
        .on_receive_notification(
            async move |notice: sdk::SessionNotification, _| {
                let raw = serde_json::to_value(notice).map_err(sdk_error)?;
                let notice: SessionNotification = serde_json::from_value(raw).map_err(sdk_error)?;
                updates.update(&notice.session_id, notice.update).await;
                Ok(())
            },
            agent_client_protocol::on_receive_notification!(),
        )
        .on_receive_request(
            async move |request: sdk::RequestPermissionRequest, responder, _| {
                let raw = serde_json::to_value(request).map_err(sdk_error)?;
                let request: PermissionRequest = serde_json::from_value(raw).map_err(sdk_error)?;
                let outcome = match permissions.permission(request).await {
                    PermissionOutcome::Cancelled => sdk::RequestPermissionOutcome::Cancelled,
                    PermissionOutcome::Selected { option_id } => {
                        sdk::RequestPermissionOutcome::Selected(
                            sdk::SelectedPermissionOutcome::new(option_id),
                        )
                    }
                };
                responder.respond(sdk::RequestPermissionResponse::new(outcome))
            },
            agent_client_protocol::on_receive_request!(),
        )
        .on_receive_request(
            async move |request: sdk::ReadTextFileRequest, responder, _| {
                let content = reads
                    .read_file(request.path.to_string_lossy().as_ref())
                    .await
                    .map_err(sdk_error)?;
                responder.respond(sdk::ReadTextFileResponse::new(content))
            },
            agent_client_protocol::on_receive_request!(),
        )
        .on_receive_request(
            async move |request: sdk::WriteTextFileRequest, responder, _| {
                writes
                    .write_file(request.path.to_string_lossy().as_ref(), &request.content)
                    .await
                    .map_err(sdk_error)?;
                responder.respond(sdk::WriteTextFileResponse::new())
            },
            agent_client_protocol::on_receive_request!(),
        );
    let transport = ByteStreams::new(writer.compat_write(), reader.compat());
    let (ready, connection) = oneshot::channel();
    tokio::spawn(async move {
        let future = builder.connect_with(transport, async move |current| {
            let _ = ready.send(current.clone());
            current.incoming_closed().await;
            Ok(())
        });
        if let Err(error) = future.await {
            tracing::debug!(%error, "acp connection closed");
        }
    });
    connection.await.context("the acp connection did not start")
}

async fn answer_request<C: Client>(client: &C, method: &str, params: Value) -> Result<Value> {
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
            client
                .write_file(&request.path, request.content.as_deref().unwrap_or_default())
                .await?;
            Ok(Value::Null)
        }
        other => bail!("this client does not answer {other}"),
    }
}

async fn notify_client<C: Client>(client: &C, method: &str, params: Value) {
    if method != "session/update" {
        return;
    }
    match serde_json::from_value::<SessionNotification>(params) {
        Ok(notice) => client.update(&notice.session_id, notice.update).await,
        Err(error) => tracing::warn!(%error, "the agent sent an update this client cannot read"),
    }
}

pub struct Agent {
    connection: ConnectionTo<SdkAgent>,
    child: Mutex<Option<Child>>,
    pid: u32,
    complaints: Arc<Mutex<Vec<String>>>,
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
            .process_group(0)
            .kill_on_drop(true);
        for (key, value) in env {
            process.env(key, value);
        }

        let mut child = process.spawn().with_context(|| format!("could not start {command}"))?;
        let pid = child.id().unwrap_or(0);
        let stdin = child.stdin.take().context("the agent has no stdin")?;
        let stdout = child.stdout.take().context("the agent has no stdout")?;
        let complaints: Arc<Mutex<Vec<String>>> = Arc::default();
        if let Some(stderr) = child.stderr.take() {
            let name = command.to_owned();
            let kept = Arc::clone(&complaints);
            tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    tracing::debug!(agent = name, line, "acp stderr");
                    let mut kept = kept.lock().await;
                    if kept.len() == STDERR_KEPT {
                        kept.remove(0);
                    }
                    kept.push(line);
                }
            });
        }

        let connection = sdk_connection(stdout, stdin, client).await?;
        Ok(Self { connection, child: Mutex::new(Some(child)), pid, complaints })
    }

    pub async fn initialize(&self) -> Result<Initialized> {
        let mut capabilities = sdk::ClientCapabilities::default();
        capabilities.fs.read_text_file = true;
        capabilities.fs.write_text_file = true;
        let request = sdk::InitializeRequest::new(ProtocolVersion::V1)
            .client_capabilities(capabilities)
            .client_info(sdk::Implementation::new("apex", env!("CARGO_PKG_VERSION")));
        let answer = self.connection.send_request(request).block_task().await?;
        let initialized: Initialized = serde_json::from_value(serde_json::to_value(answer)?)?;

        if initialized.protocol_version > PROTOCOL_VERSION {
            bail!(
                "the agent speaks acp {} and this client only speaks {PROTOCOL_VERSION}",
                initialized.protocol_version
            );
        }
        Ok(initialized)
    }

    pub async fn authenticate(&self, method: &str) -> Result<()> {
        self.connection
            .send_request(sdk::AuthenticateRequest::new(method.to_owned()))
            .block_task()
            .await?;
        Ok(())
    }

    pub async fn new_session(&self, cwd: &Path, servers: &[McpServer]) -> Result<NewSession> {
        let servers = serde_json::from_value(serde_json::to_value(servers)?)?;
        let answer = self
            .connection
            .send_request(sdk::NewSessionRequest::new(cwd).mcp_servers(servers))
            .block_task()
            .await?;
        tokio::task::yield_now().await;
        Ok(serde_json::from_value(serde_json::to_value(answer)?)?)
    }

    pub async fn set_model(&self, session: &str, model: &str) -> Result<()> {
        let request = sdk::SetSessionConfigOptionRequest::new(
            session.to_owned(),
            "model",
            sdk::SessionConfigValueId::from(model.to_owned()),
        );
        self.connection.send_request(request).block_task().await?;
        Ok(())
    }

    pub async fn set_mode(&self, session: &str, mode: &str) -> Result<()> {
        self.connection
            .send_request(sdk::SetSessionModeRequest::new(session.to_owned(), mode.to_owned()))
            .block_task()
            .await?;
        Ok(())
    }

    pub async fn prompt(&self, session: &str, text: &str) -> Result<StopReason> {
        let request = sdk::PromptRequest::new(
            session.to_owned(),
            vec![sdk::ContentBlock::Text(sdk::TextContent::new(text.to_owned()))],
        );
        let answer = self.connection.send_request(request).block_task().await?;
        let prompted: Prompted = serde_json::from_value(serde_json::to_value(answer)?)?;
        Ok(prompted.stop_reason)
    }

    pub fn cancel(&self, session: &str) -> Result<()> {
        self.connection
            .send_notification(sdk::CancelNotification::new(session.to_owned()))
            .map_err(Into::into)
    }

    pub fn pid(&self) -> Option<u32> {
        (self.pid != 0).then_some(self.pid)
    }

    pub async fn complaints(&self) -> String {
        self.complaints.lock().await.join("\n")
    }

    pub async fn wait(&self) -> i32 {
        let child = {
            let mut guard = self.child.lock().await;
            guard.take()
        };
        match child {
            Some(mut child) => match child.wait().await {
                Ok(status) => status.code().unwrap_or(1),
                Err(_) => 1,
            },
            None => 1,
        }
    }

    pub async fn kill(&self) -> Result<()> {
        if self.pid != 0 {
            let _ = Command::new("/bin/kill")
                .arg("-KILL")
                .arg(format!("-{}", self.pid))
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .await;
        }
        let mut child = self.child.lock().await;
        if let Some(child) = child.as_mut() {
            child.kill().await.context("could not stop the agent")?;
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
