use std::sync::Arc;

use apex_proto::{
    ClientMessage, Command, Connection, ErrorCode, Frame, Hello, PROTOCOL_VERSION, ProtocolError,
    Reply, RequestId, Scope, ServerMessage, TransportError, Welcome,
};

use crate::state::Daemon;

const DAEMON_VERSION: &str = env!("CARGO_PKG_VERSION");

pub async fn serve(daemon: Arc<Daemon>, mut connection: Connection) {
    let peer = connection.peer().clone();
    if let Err(error) = handshake(&mut connection).await {
        tracing::warn!(peer = %peer.label, %error, "handshake fallido");
        return;
    }
    tracing::info!(peer = %peer.label, "cliente conectado");

    while let Some(frame) = connection.recv().await {
        let frame = match frame {
            Ok(frame) => frame,
            Err(error) => {
                tracing::warn!(peer = %peer.label, %error, "frame invalida");
                break;
            }
        };

        let message: ClientMessage = match frame.parse_control() {
            Ok(message) => message,
            Err(error) => {
                tracing::warn!(peer = %peer.label, %error, "mensaje ilegible");
                continue;
            }
        };

        let response = match message {
            ClientMessage::Hello(_) => ServerMessage::err(
                RequestId(0),
                ProtocolError::new(ErrorCode::MalformedRequest, "hello duplicado"),
            ),
            ClientMessage::Request { id, command } => {
                dispatch(&daemon, peer.scope, id, command).await
            }
        };

        if let Err(error) = connection.send_control(&response).await {
            tracing::warn!(peer = %peer.label, %error, "no se pudo responder");
            break;
        }
    }
    tracing::info!(peer = %peer.label, "cliente desconectado");
}

async fn handshake(connection: &mut Connection) -> Result<Hello, TransportError> {
    let frame = connection
        .recv()
        .await
        .ok_or_else(|| TransportError::MalformedFrame("conexion cerrada antes del hello".into()))??;
    let hello = match frame.parse_control::<ClientMessage>()? {
        ClientMessage::Hello(hello) => hello,
        ClientMessage::Request { .. } => {
            return Err(TransportError::MalformedFrame("se esperaba hello".into()));
        }
    };

    if hello.protocol_version != PROTOCOL_VERSION {
        let error = ProtocolError::unsupported_version(format!(
            "el daemon habla v{PROTOCOL_VERSION}, el cliente v{}",
            hello.protocol_version
        ));
        let _ = connection.send(Frame::control(&ServerMessage::err(RequestId(0), error))?).await;
        return Err(TransportError::MalformedFrame("version incompatible".into()));
    }

    connection
        .send_control(&ServerMessage::Welcome(Welcome {
            protocol_version: PROTOCOL_VERSION,
            daemon_version: DAEMON_VERSION.to_string(),
            scope: connection.peer().scope,
        }))
        .await?;
    Ok(hello)
}

async fn dispatch(
    daemon: &Arc<Daemon>,
    scope: Scope,
    id: RequestId,
    command: Command,
) -> ServerMessage {
    if !scope_allows(scope, &command) {
        return ServerMessage::err(
            id,
            ProtocolError::unauthorized("comando no permitido para clientes remotos"),
        );
    }
    match command {
        Command::Ping => ServerMessage::ok(id, Reply::Pong),
        Command::ListAgents => {
            ServerMessage::ok(id, Reply::Agents { agents: daemon.list_agents().await })
        }
    }
}

fn scope_allows(scope: Scope, command: &Command) -> bool {
    match scope {
        Scope::Local => true,
        Scope::Remote => matches!(command, Command::Ping | Command::ListAgents),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use apex_core::ApexPaths;
    use apex_proto::{CommandOutcome, Identity, Listener, UnixTransport, connect_unix};
    use std::path::PathBuf;

    struct Harness {
        socket: PathBuf,
        home: tempfile::TempDir,
    }

    impl Harness {
        async fn start() -> Self {
            let home = tempfile::tempdir().expect("home");
            let id = uuid::Uuid::new_v4().simple().to_string();
            let socket = PathBuf::from("/tmp").join(format!("apexd-t-{}.sock", &id[..8]));

            let paths = ApexPaths { socket: socket.clone(), ..ApexPaths::rooted_at(home.path()) };
            let daemon = Daemon::bootstrap(&paths).await.expect("bootstrap");
            let mut transport = UnixTransport::bind(&socket).expect("bind");

            tokio::spawn(async move {
                while let Ok((stream, peer)) = transport.accept().await {
                    tokio::spawn(serve(daemon.clone(), Connection::new(stream, peer)));
                }
            });
            Self { socket, home }
        }

        async fn connect(&self, hello: Hello) -> (Connection, ServerMessage) {
            let mut client = connect_unix(&self.socket).await.expect("connect");
            client.send_control(&ClientMessage::Hello(hello)).await.expect("hello");
            let frame = client.recv().await.expect("frame").expect("sin error");
            (client, frame.parse_control().expect("parse"))
        }
    }

    fn hello(version: u32) -> Hello {
        Hello { protocol_version: version, client_name: "test".into(), identity: None }
    }

    async fn request(client: &mut Connection, id: RequestId, command: Command) -> ServerMessage {
        client.send_control(&ClientMessage::Request { id, command }).await.expect("request");
        client.recv().await.expect("frame").expect("sin error").parse_control().expect("parse")
    }

    #[tokio::test]
    async fn a_matching_version_is_welcomed() {
        let harness = Harness::start().await;
        let (_, response) = harness.connect(hello(PROTOCOL_VERSION)).await;
        match response {
            ServerMessage::Welcome(welcome) => {
                assert_eq!(welcome.protocol_version, PROTOCOL_VERSION);
                assert_eq!(welcome.scope, Scope::Local);
            }
            other => panic!("se esperaba welcome, llego {other:?}"),
        }
        assert!(harness.home.path().exists());
    }

    #[tokio::test]
    async fn a_mismatched_version_is_rejected() {
        let harness = Harness::start().await;
        let (_, response) = harness.connect(hello(PROTOCOL_VERSION + 99)).await;
        match response {
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                assert_eq!(error.code, ErrorCode::UnsupportedVersion);
            }
            other => panic!("se esperaba rechazo, llego {other:?}"),
        }
    }

    #[tokio::test]
    async fn ping_is_answered_with_pong() {
        let harness = Harness::start().await;
        let (mut client, _) = harness.connect(hello(PROTOCOL_VERSION)).await;
        let response = request(&mut client, RequestId(1), Command::Ping).await;
        assert_eq!(response, ServerMessage::ok(RequestId(1), Reply::Pong));
    }

    #[tokio::test]
    async fn listing_agents_returns_every_builtin_profile() {
        let harness = Harness::start().await;
        let (mut client, _) = harness.connect(hello(PROTOCOL_VERSION)).await;
        let response = request(&mut client, RequestId(2), Command::ListAgents).await;

        let ServerMessage::Response { outcome: CommandOutcome::Ok { reply }, .. } = response else {
            panic!("se esperaba una respuesta ok");
        };
        let Reply::Agents { agents } = reply else {
            panic!("se esperaba la lista de agentes");
        };

        let names: Vec<_> = agents.iter().map(|agent| agent.name.as_str()).collect();
        assert!(names.contains(&"claude"));
        assert!(names.contains(&"codex"));
        assert!(names.contains(&"shell"));
        assert!(agents.iter().any(|agent| agent.supports_resume));
    }

    #[tokio::test]
    async fn a_second_hello_is_rejected_without_dropping_the_connection() {
        let harness = Harness::start().await;
        let (mut client, _) = harness.connect(hello(PROTOCOL_VERSION)).await;

        client
            .send_control(&ClientMessage::Hello(Hello {
                identity: Some(Identity { device_id: "x".into(), token: "y".into() }),
                ..hello(PROTOCOL_VERSION)
            }))
            .await
            .expect("hello");
        let response: ServerMessage =
            client.recv().await.expect("frame").expect("sin error").parse_control().expect("parse");

        match response {
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                assert_eq!(error.code, ErrorCode::MalformedRequest);
            }
            other => panic!("se esperaba rechazo, llego {other:?}"),
        }

        let after = request(&mut client, RequestId(3), Command::Ping).await;
        assert_eq!(after, ServerMessage::ok(RequestId(3), Reply::Pong));
    }
}
