mod types;

use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, oneshot};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

use agent_client_protocol::schema::{ProtocolVersion, v1 as sdk};
use agent_client_protocol::{Agent as SdkAgent, ByteStreams, ConnectionTo};

pub use types::*;

const STDERR_KEPT: usize = 20;

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
                let permissions = Arc::clone(&permissions);
                tokio::spawn(async move {
                    let outcome = match permissions.permission(request).await {
                        PermissionOutcome::Cancelled => sdk::RequestPermissionOutcome::Cancelled,
                        PermissionOutcome::Selected { option_id } => {
                            sdk::RequestPermissionOutcome::Selected(
                                sdk::SelectedPermissionOutcome::new(option_id),
                            )
                        }
                    };
                    let _ = responder.respond(sdk::RequestPermissionResponse::new(outcome));
                });
                Ok(())
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
        Ok(serde_json::from_value(serde_json::to_value(answer.stop_reason)?)?)
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
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn official_permissions_keep_apex_question_metadata() {
        let raw = json!({
            "sessionId": "session",
            "toolCall": { "toolCallId": "call", "title": "Which one?" },
            "options": [{
                "optionId": "first",
                "name": "First",
                "kind": "allow_once",
                "_meta": { "description": "the first choice" },
            }],
            "_meta": {
                "apexQuestion": true,
                "apexGroup": { "id": "call", "at": 0, "of": 2 },
            },
        });
        let official: sdk::RequestPermissionRequest =
            serde_json::from_value(raw).expect("an official permission");
        let request: PermissionRequest = serde_json::from_value(
            serde_json::to_value(official).expect("a serialized permission"),
        )
        .expect("an apex permission");

        assert_eq!(request.options.len(), 1);
        assert!(request.meta.as_ref().is_some_and(|meta| meta.apex_question));
        assert_eq!(request.meta.and_then(|meta| meta.apex_group).map(|group| group.of), Some(2));
        assert_eq!(
            request.options[0].meta.as_ref().and_then(|meta| meta.description.as_deref()),
            Some("the first choice")
        );
    }

    #[test]
    fn official_v1_sessions_keep_model_options() {
        let raw = json!({
            "sessionId": "session",
            "configOptions": [{
                "id": "model",
                "name": "Model",
                "category": "model",
                "type": "select",
                "currentValue": "qwen3:8b",
                "options": [{ "value": "qwen3:8b", "name": "Qwen 3 8B" }],
            }],
        });
        let official: sdk::NewSessionResponse =
            serde_json::from_value(raw).expect("an official session");
        let session: NewSession =
            serde_json::from_value(serde_json::to_value(official).expect("a serialized session"))
                .expect("an apex session");

        assert_eq!(session.config_options[0].id, "model");
        assert_eq!(session.config_options[0].current_value.as_deref(), Some("qwen3:8b"));
        assert_eq!(session.config_options[0].options[0].name, "Qwen 3 8B");
    }
}
