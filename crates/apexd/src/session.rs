use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use apex_proto::{
    ClientMessage, Command, Connection, ConnectionReader, ErrorCode, Frame, Hello,
    PROTOCOL_VERSION, ProtocolError, RequestId, Scope, ServerMessage, TransportError, Welcome,
};
use tokio::task::JoinHandle;

use crate::commands::{Executor, Outbox, runs_detached, scope_allows};
use crate::sessions::SessionManager;

const DAEMON_VERSION: &str = env!("CARGO_PKG_VERSION");
const CLIENT_QUEUE_DEPTH: usize = 1024;

struct Census(Arc<AtomicUsize>);

impl Census {
    fn enter(clients: Arc<AtomicUsize>) -> Self {
        clients.fetch_add(1, Ordering::SeqCst);
        Self(clients)
    }
}

impl Drop for Census {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

pub async fn serve(
    manager: Arc<SessionManager>,
    mut connection: Connection,
    clients: Arc<AtomicUsize>,
) {
    let peer = connection.peer().clone();
    match handshake(&mut connection).await {
        Ok(Some(_)) => tracing::info!(peer = %peer.label, "client connected"),
        Ok(None) => {
            tracing::debug!(peer = %peer.label, "availability probe");
            return;
        }
        Err(error) => {
            tracing::warn!(peer = %peer.label, %error, "handshake failed");
            return;
        }
    }
    let _census = Census::enter(clients);

    let (mut writer, reader) = connection.split();
    let (outbox, mut queue) = tokio::sync::mpsc::channel::<Frame>(CLIENT_QUEUE_DEPTH);

    let pump = tokio::spawn(async move {
        while let Some(frame) = queue.recv().await {
            if writer.send(frame).await.is_err() {
                return;
            }
        }
    });

    let events = spawn_event_forwarder(manager.clone(), outbox.clone());
    let mut client = Client::new(manager, outbox, peer.scope);
    client.run(reader).await;

    events.abort();
    client.executor.detach_all().await;
    drop(client);
    let _ = pump.await;
    tracing::info!(peer = %peer.label, "client disconnected");
}

#[derive(Clone)]
struct Client {
    executor: Executor,
    outbox: Outbox,
    scope: Scope,
}

impl Client {
    fn new(manager: Arc<SessionManager>, outbox: Outbox, scope: Scope) -> Self {
        Self { executor: Executor::attached(manager, outbox.clone()), outbox, scope }
    }

    async fn run(&mut self, mut reader: ConnectionReader) {
        while let Some(frame) = reader.recv().await {
            let frame = match frame {
                Ok(frame) => frame,
                Err(error) => {
                    tracing::warn!(%error, "invalid frame");
                    return;
                }
            };

            let message: ClientMessage = match frame.parse_control() {
                Ok(message) => message,
                Err(error) => {
                    tracing::warn!(%error, "unreadable message");
                    let refused = ServerMessage::err(
                        frame.request_id().unwrap_or(RequestId(0)),
                        ProtocolError::new(ErrorCode::MalformedRequest, error.to_string()),
                    );
                    if let Ok(frame) = Frame::control(&refused)
                        && self.outbox.send(frame).await.is_err()
                    {
                        return;
                    }
                    continue;
                }
            };

            let response = match message {
                ClientMessage::Hello(_) => ServerMessage::err(
                    RequestId(0),
                    ProtocolError::new(ErrorCode::MalformedRequest, "hello duplicado"),
                ),
                ClientMessage::Request { id, command } if runs_detached(&command) => {
                    let client = self.clone();
                    tokio::spawn(async move {
                        let response = client.dispatch(id, command).await;
                        if let Ok(frame) = Frame::control(&response) {
                            let _ = client.outbox.send(frame).await;
                        }
                    });
                    continue;
                }
                ClientMessage::Request { id, command } => self.dispatch(id, command).await,
            };

            let Ok(frame) = Frame::control(&response) else {
                continue;
            };
            if self.outbox.send(frame).await.is_err() {
                return;
            }
        }
    }

    async fn dispatch(&self, id: RequestId, command: Command) -> ServerMessage {
        if !scope_allows(self.scope, &command) {
            return ServerMessage::err(
                id,
                ProtocolError::unauthorized("command not allowed for remote clients"),
            );
        }

        match self.executor.execute(command).await {
            Ok(reply) => ServerMessage::ok(id, reply),
            Err(error) => ServerMessage::err(id, error),
        }
    }
}

fn spawn_event_forwarder(manager: Arc<SessionManager>, outbox: Outbox) -> JoinHandle<()> {
    let mut events = manager.subscribe();
    tokio::spawn(async move {
        loop {
            match events.recv().await {
                Ok(event) => {
                    let Ok(frame) = Frame::control(&ServerMessage::Event(Box::new(event))) else {
                        continue;
                    };
                    if outbox.send(frame).await.is_err() {
                        return;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => return,
            }
        }
    })
}

async fn handshake(connection: &mut Connection) -> Result<Option<Hello>, TransportError> {
    let Some(frame) = connection.recv().await else {
        return Ok(None);
    };
    let hello = match frame?.parse_control::<ClientMessage>()? {
        ClientMessage::Hello(hello) => hello,
        ClientMessage::Request { .. } => {
            return Err(TransportError::MalformedFrame("expected hello".into()));
        }
    };

    if hello.protocol_version != PROTOCOL_VERSION {
        let error = ProtocolError::unsupported_version(format!(
            "daemon speaks v{PROTOCOL_VERSION}, client speaks v{}",
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
    Ok(Some(hello))
}
