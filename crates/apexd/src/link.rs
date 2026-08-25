use anyhow::{Context, Result, bail};
use apex_mcp::Daemon;
use apex_proto::{
    ClientMessage, Command, CommandOutcome, Connection, ErrorCode, Frame, Hello, PROTOCOL_VERSION,
    Reply, RequestId, ServerMessage, connect_unix,
};
use std::path::Path;

pub struct Link {
    connection: Connection,
    next: u64,
}

impl Link {
    pub async fn connect(socket: &Path) -> Result<Self> {
        Self::hail(socket, "apex-mcp", false).await
    }

    pub async fn hail(socket: &Path, name: &str, probe: bool) -> Result<Self> {
        match Self::knock(socket, name, probe, PROTOCOL_VERSION).await? {
            Greeted::Linked(link) => Ok(*link),
            Greeted::Stranger(speaks) => {
                bail!("apexd speaks protocol v{speaks}, this one speaks v{PROTOCOL_VERSION}")
            }
        }
    }

    pub async fn knock(socket: &Path, name: &str, probe: bool, version: u32) -> Result<Greeted> {
        let mut connection = connect_unix(socket)
            .await
            .with_context(|| format!("connecting to {}", socket.display()))?;

        connection
            .send_control(&ClientMessage::Hello(Hello {
                protocol_version: version,
                client_name: name.into(),
                identity: None,
                probe,
            }))
            .await?;

        let welcome = connection.recv().await.context("apexd closed during handshake")??;
        match welcome.parse_control::<ServerMessage>()? {
            ServerMessage::Welcome(_) => {
                Ok(Greeted::Linked(Box::new(Self { connection, next: 0 })))
            }
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. }
                if error.code == ErrorCode::UnsupportedVersion =>
            {
                match spoken_version(&error.message) {
                    Some(speaks) => Ok(Greeted::Stranger(speaks)),
                    None => bail!("apexd refused the handshake: {error}"),
                }
            }
            other => bail!("apexd refused the handshake: {other:?}"),
        }
    }
}

pub enum Greeted {
    Linked(Box<Link>),
    Stranger(u32),
}

pub fn spoken_version(message: &str) -> Option<u32> {
    message
        .split_whitespace()
        .find_map(|word| word.strip_prefix('v'))
        .and_then(|rest| rest.trim_end_matches(',').parse().ok())
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
                        CommandOutcome::Ok { reply } => Ok(*reply),
                        CommandOutcome::Err { error } => bail!("{error}"),
                    };
                }
                _ => continue,
            }
        }
    }
}
