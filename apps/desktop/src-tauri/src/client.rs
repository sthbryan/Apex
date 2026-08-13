use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::{Context, Result, bail};
use apex_proto::{
    ClientMessage, Command, CommandOutcome, Connection, Hello, PROTOCOL_VERSION, Reply, RequestId,
    ServerMessage, connect_unix,
};
use tokio::sync::Mutex;
use tokio::time::sleep;

const SPAWN_ATTEMPTS: u32 = 25;
const SPAWN_INTERVAL: Duration = Duration::from_millis(120);

pub struct DaemonClient {
    connection: Mutex<Connection>,
    next_id: AtomicU64,
    daemon_version: String,
}

impl DaemonClient {
    pub async fn attach(socket: &Path) -> Result<Self> {
        ensure_running(socket).await?;
        let mut connection = connect_unix(socket)
            .await
            .with_context(|| format!("conectando a {}", socket.display()))?;

        connection
            .send_control(&ClientMessage::Hello(Hello {
                protocol_version: PROTOCOL_VERSION,
                client_name: "apex-desktop".into(),
                identity: None,
            }))
            .await?;

        let frame = connection.recv().await.context("apexd cerro durante el handshake")??;
        let daemon_version = match frame.parse_control::<ServerMessage>()? {
            ServerMessage::Welcome(welcome) => welcome.daemon_version,
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                bail!("apexd rechazo el handshake: {error}")
            }
            other => bail!("respuesta inesperada al handshake: {other:?}"),
        };

        Ok(Self {
            connection: Mutex::new(connection),
            next_id: AtomicU64::new(1),
            daemon_version,
        })
    }

    pub fn daemon_version(&self) -> &str {
        &self.daemon_version
    }

    pub async fn request(&self, command: Command) -> Result<Reply> {
        let id = RequestId(self.next_id.fetch_add(1, Ordering::Relaxed));
        let mut connection = self.connection.lock().await;
        connection.send_control(&ClientMessage::Request { id, command }).await?;

        loop {
            let frame = connection.recv().await.context("apexd cerro la conexion")??;
            match frame.parse_control::<ServerMessage>()? {
                ServerMessage::Response { id: got, outcome } if got == id => {
                    return match outcome {
                        CommandOutcome::Ok { reply } => Ok(reply),
                        CommandOutcome::Err { error } => bail!("{error}"),
                    };
                }
                ServerMessage::Event(_) => continue,
                other => bail!("respuesta fuera de orden: {other:?}"),
            }
        }
    }
}

async fn ensure_running(socket: &Path) -> Result<()> {
    if connect_unix(socket).await.is_ok() {
        return Ok(());
    }

    let binary = daemon_binary()?;
    tracing::info!(binary = %binary.display(), "levantando apexd");
    tokio::process::Command::new(&binary)
        .stdin(std::process::Stdio::null())
        .spawn()
        .with_context(|| format!("lanzando {}", binary.display()))?;

    for _ in 0..SPAWN_ATTEMPTS {
        sleep(SPAWN_INTERVAL).await;
        if connect_unix(socket).await.is_ok() {
            return Ok(());
        }
    }
    bail!("apexd no respondio en {}", socket.display())
}

fn daemon_binary() -> Result<PathBuf> {
    let exe = std::env::current_exe().context("ruta del ejecutable actual")?;
    let dir = exe.parent().context("directorio del ejecutable actual")?;
    let candidate = dir.join("apexd");
    if candidate.is_file() {
        return Ok(candidate);
    }
    bail!("no se encontro apexd junto a {}", exe.display())
}
