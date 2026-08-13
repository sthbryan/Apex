use std::io;
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tokio::io::{AsyncRead, AsyncWrite, Join, join, split};
use tokio::net::{UnixListener, UnixStream};
use tokio_util::codec::Framed;

use crate::codec::{Frame, FrameCodec};
use crate::error::TransportError;
use crate::message::Scope;

pub type BoxedStream =
    Join<Box<dyn AsyncRead + Send + Unpin>, Box<dyn AsyncWrite + Send + Unpin>>;

pub fn box_stream<S>(stream: S) -> BoxedStream
where
    S: AsyncRead + AsyncWrite + Send + Unpin + 'static,
{
    let (reader, writer) = split(stream);
    join(
        Box::new(reader) as Box<dyn AsyncRead + Send + Unpin>,
        Box::new(writer) as Box<dyn AsyncWrite + Send + Unpin>,
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PeerInfo {
    pub scope: Scope,
    pub label: String,
}

impl PeerInfo {
    pub fn local(label: impl Into<String>) -> Self {
        Self { scope: Scope::Local, label: label.into() }
    }
}

#[async_trait]
pub trait Listener: Send {
    async fn accept(&mut self) -> io::Result<(BoxedStream, PeerInfo)>;
    fn describe(&self) -> String;
}

pub struct Connection {
    framed: Framed<BoxedStream, FrameCodec>,
    peer: PeerInfo,
}

impl Connection {
    pub fn new(stream: BoxedStream, peer: PeerInfo) -> Self {
        Self { framed: Framed::new(stream, FrameCodec::default()), peer }
    }

    pub fn peer(&self) -> &PeerInfo {
        &self.peer
    }

    pub async fn send(&mut self, frame: Frame) -> Result<(), TransportError> {
        self.framed.send(frame).await
    }

    pub async fn send_control<T: Serialize>(&mut self, message: &T) -> Result<(), TransportError> {
        self.send(Frame::control(message)?).await
    }

    pub async fn recv(&mut self) -> Option<Result<Frame, TransportError>> {
        self.framed.next().await
    }
}

pub struct UnixTransport {
    listener: UnixListener,
    path: PathBuf,
}

impl UnixTransport {
    pub fn bind(path: impl AsRef<Path>) -> io::Result<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        if path.exists() && is_stale_socket(&path) {
            std::fs::remove_file(&path)?;
        }
        let listener = UnixListener::bind(&path)?;
        Ok(Self { listener, path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for UnixTransport {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

#[async_trait]
impl Listener for UnixTransport {
    async fn accept(&mut self) -> io::Result<(BoxedStream, PeerInfo)> {
        let (stream, _) = self.listener.accept().await?;
        Ok((box_stream(stream), PeerInfo::local(self.path.display().to_string())))
    }

    fn describe(&self) -> String {
        format!("unix:{}", self.path.display())
    }
}

pub async fn connect_unix(path: impl AsRef<Path>) -> io::Result<Connection> {
    let path = path.as_ref();
    let stream = UnixStream::connect(path).await?;
    Ok(Connection::new(box_stream(stream), PeerInfo::local(path.display().to_string())))
}

fn is_stale_socket(path: &Path) -> bool {
    matches!(
        std::os::unix::net::UnixStream::connect(path),
        Err(error) if error.kind() == io::ErrorKind::ConnectionRefused
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::message::{ClientMessage, Command, PROTOCOL_VERSION, RequestId, Reply, ServerMessage};

    fn short_socket_dir() -> PathBuf {
        let id = uuid::Uuid::new_v4().simple().to_string();
        PathBuf::from("/tmp").join(format!("apex-t-{}", &id[..8]))
    }

    #[tokio::test]
    async fn unix_transport_carries_a_request_and_a_reply() {
        let dir = short_socket_dir();
        let socket = dir.join("d.sock");
        let mut transport = UnixTransport::bind(&socket).expect("bind");

        let server = tokio::spawn(async move {
            let (stream, peer) = transport.accept().await.expect("accept");
            let mut connection = Connection::new(stream, peer);
            let frame = connection.recv().await.expect("frame").expect("sin error");
            let message: ClientMessage = frame.parse_control().expect("parse");
            assert_eq!(
                message,
                ClientMessage::Request { id: RequestId(1), command: Command::Ping }
            );
            connection
                .send_control(&ServerMessage::ok(RequestId(1), Reply::Pong))
                .await
                .expect("send");
        });

        let mut client = connect_unix(&socket).await.expect("connect");
        client
            .send_control(&ClientMessage::Request { id: RequestId(1), command: Command::Ping })
            .await
            .expect("send");
        let frame = client.recv().await.expect("frame").expect("sin error");
        let reply: ServerMessage = frame.parse_control().expect("parse");
        assert_eq!(reply, ServerMessage::ok(RequestId(1), Reply::Pong));

        server.await.expect("server");
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(PROTOCOL_VERSION, 1);
    }

    #[tokio::test]
    async fn bind_replaces_a_stale_socket_file() {
        let dir = short_socket_dir();
        std::fs::create_dir_all(&dir).expect("mkdir");
        let socket = dir.join("d.sock");
        std::os::unix::net::UnixListener::bind(&socket).expect("listener");
        drop(std::fs::File::open(&socket));

        assert!(socket.exists());
        let transport = UnixTransport::bind(&socket).expect("rebind");
        assert_eq!(transport.path(), socket.as_path());
        drop(transport);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
