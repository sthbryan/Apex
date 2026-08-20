use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use apex_proto::{
    ClientMessage, Command, CommandOutcome, ConnectionReader, ConnectionWriter, Event, Frame,
    Hello, PROTOCOL_VERSION, Reply, RequestId, ServerMessage, connect_unix,
};
use tauri::ipc::{Channel, InvokeResponseBody};
use tokio::sync::{Mutex, oneshot};
use tokio::time::sleep;

const SPAWN_ATTEMPTS: u32 = 25;
const SPAWN_INTERVAL: Duration = Duration::from_millis(120);

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<CommandOutcome>>>>;
type OutputSink = Arc<Mutex<Option<Channel<InvokeResponseBody>>>>;
type EventSink = Arc<Mutex<Option<Channel<Event>>>>;

pub struct DaemonClient {
    writer: Mutex<ConnectionWriter>,
    pending: Pending,
    output: OutputSink,
    events: EventSink,
    next_id: AtomicU64,
    daemon_version: String,
}

impl DaemonClient {
    pub async fn attach(socket: &Path) -> Result<Arc<Self>> {
        ensure_running(socket).await?;
        let mut connection = connect_unix(socket)
            .await
            .with_context(|| format!("connecting to {}", socket.display()))?;

        connection
            .send_control(&ClientMessage::Hello(Hello {
                protocol_version: PROTOCOL_VERSION,
                client_name: "apex-desktop".into(),
                identity: None,
            }))
            .await?;

        let frame = connection.recv().await.context("apexd closed during handshake")??;
        let daemon_version = match frame.parse_control::<ServerMessage>()? {
            ServerMessage::Welcome(welcome) => welcome.daemon_version,
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                bail!("apexd rejected the handshake: {error}")
            }
            other => bail!("unexpected handshake reply: {other:?}"),
        };

        let (writer, reader) = connection.split();
        let client = Arc::new(Self {
            writer: Mutex::new(writer),
            pending: Pending::default(),
            output: OutputSink::default(),
            events: EventSink::default(),
            next_id: AtomicU64::new(1),
            daemon_version,
        });

        spawn_reader(reader, client.pending.clone(), client.output.clone(), client.events.clone());
        Ok(client)
    }

    pub fn daemon_version(&self) -> &str {
        &self.daemon_version
    }

    pub async fn set_output_channel(&self, channel: Channel<InvokeResponseBody>) {
        *self.output.lock().await = Some(channel);
    }

    pub async fn set_event_channel(&self, channel: Channel<Event>) {
        *self.events.lock().await = Some(channel);
    }

    pub async fn request(&self, command: Command) -> Result<Reply> {
        let id = RequestId(self.next_id.fetch_add(1, Ordering::Relaxed));
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().await.insert(id.0, sender);

        let sent =
            self.writer.lock().await.send_control(&ClientMessage::Request { id, command }).await;
        if let Err(error) = sent {
            self.pending.lock().await.remove(&id.0);
            return Err(error).context("sending request");
        }

        match receiver.await {
            Ok(CommandOutcome::Ok { reply }) => Ok(reply),
            Ok(CommandOutcome::Err { error }) => bail!("{error}"),
            Err(_) => bail!("apexd closed the connection"),
        }
    }
}

fn spawn_reader(
    mut reader: ConnectionReader,
    pending: Pending,
    output: OutputSink,
    events: EventSink,
) {
    tokio::spawn(async move {
        while let Some(frame) = reader.recv().await {
            let Ok(frame) = frame else {
                break;
            };

            match frame {
                Frame::Output { session, data } => {
                    let guard = output.lock().await;
                    let Some(channel) = guard.as_ref() else {
                        continue;
                    };
                    let mut payload = Vec::with_capacity(16 + data.len());
                    payload.extend_from_slice(session.as_bytes());
                    payload.extend_from_slice(&data);
                    if channel.send(InvokeResponseBody::Raw(payload)).is_err() {
                        break;
                    }
                }
                Frame::Control(_) => {
                    let Ok(message) = frame.parse_control::<ServerMessage>() else {
                        continue;
                    };
                    match message {
                        ServerMessage::Response { id, outcome } => {
                            if let Some(sender) = pending.lock().await.remove(&id.0) {
                                let _ = sender.send(outcome);
                            }
                        }
                        ServerMessage::Event(event) => {
                            let guard = events.lock().await;
                            if let Some(channel) = guard.as_ref()
                                && channel.send(event).is_err()
                            {
                                break;
                            }
                        }
                        ServerMessage::Welcome(_) => continue,
                    }
                }
            }
        }
        pending.lock().await.clear();
    });
}

async fn ensure_running(socket: &Path) -> Result<()> {
    if connect_unix(socket).await.is_ok() {
        return Ok(());
    }

    let binary = daemon_binary()?;
    tracing::info!(binary = %binary.display(), "starting apexd");
    tokio::process::Command::new(&binary)
        .env("APEX_HOST_PID", std::process::id().to_string())
        .stdin(std::process::Stdio::null())
        .spawn()
        .with_context(|| format!("spawning {}", binary.display()))?;

    for _ in 0..SPAWN_ATTEMPTS {
        sleep(SPAWN_INTERVAL).await;
        if connect_unix(socket).await.is_ok() {
            return Ok(());
        }
    }
    bail!("apexd did not respond on {}", socket.display())
}

fn daemon_binary() -> Result<PathBuf> {
    let exe = std::env::current_exe().context("current executable path")?;
    let dir = exe.parent().context("current executable directory")?;

    for candidate in [dir.join("apexd"), dir.join("../Resources/apexd")] {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }
    bail!("apexd not found next to {}", exe.display())
}
