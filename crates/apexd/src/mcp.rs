use anyhow::{Context, Result, bail};
use apex_mcp::Daemon;
use apex_proto::{
    ClientMessage, Command, CommandOutcome, Connection, Frame, Hello, PROTOCOL_VERSION, Reply,
    RequestId, ServerMessage, connect_unix,
};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub async fn run(socket: &Path, session: Option<Uuid>) -> Result<()> {
    let mut daemon = Link::connect(socket).await?;
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let caller = apex_mcp::caller_for(&mut daemon, session, &cwd).await?;
    apex_mcp::serve(&mut daemon, &caller, tokio::io::stdin(), tokio::io::stdout()).await
}

struct Link {
    connection: Connection,
    next: u64,
}

impl Link {
    async fn connect(socket: &Path) -> Result<Self> {
        let mut connection = connect_unix(socket)
            .await
            .with_context(|| format!("connecting to {}", socket.display()))?;

        connection
            .send_control(&ClientMessage::Hello(Hello {
                protocol_version: PROTOCOL_VERSION,
                client_name: "apex-mcp".into(),
                identity: None,
            }))
            .await?;

        let welcome = connection.recv().await.context("apexd closed during handshake")??;
        match welcome.parse_control::<ServerMessage>()? {
            ServerMessage::Welcome(_) => Ok(Self { connection, next: 0 }),
            other => bail!("apexd refused the handshake: {other:?}"),
        }
    }
}

impl Daemon for Link {
    async fn request(&mut self, command: Command) -> Result<Reply> {
        self.next += 1;
        let id = RequestId(self.next);
        self.connection.send_control(&ClientMessage::Request { id, command }).await?;

        loop {
            let frame = self.connection.recv().await.context("apexd closed the connection")??;
            if !matches!(frame, Frame::Control(_)) {
                continue;
            }
            match frame.parse_control::<ServerMessage>()? {
                ServerMessage::Response { id: answered, outcome } if answered == id => {
                    return match outcome {
                        CommandOutcome::Ok { reply } => Ok(reply),
                        CommandOutcome::Err { error } => bail!("{error}"),
                    };
                }
                _ => continue,
            }
        }
    }
}
