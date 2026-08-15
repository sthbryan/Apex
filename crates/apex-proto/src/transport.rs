use std::io;
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use futures_util::stream::{SplitSink, SplitStream};
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

    pub fn split(self) -> (ConnectionWriter, ConnectionReader) {
        let (sink, stream) = self.framed.split();
        (ConnectionWriter { sink }, ConnectionReader { stream })
    }
}

pub struct ConnectionWriter {
    sink: SplitSink<Framed<BoxedStream, FrameCodec>, Frame>,
}

impl ConnectionWriter {
    pub async fn send(&mut self, frame: Frame) -> Result<(), TransportError> {
        self.sink.send(frame).await
    }

    pub async fn send_control<T: Serialize>(&mut self, message: &T) -> Result<(), TransportError> {
        self.send(Frame::control(message)?).await
    }
}

pub struct ConnectionReader {
    stream: SplitStream<Framed<BoxedStream, FrameCodec>>,
}

impl ConnectionReader {
    pub async fn recv(&mut self) -> Option<Result<Frame, TransportError>> {
        self.stream.next().await
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
#[path = "transport_tests.rs"]
mod tests;
