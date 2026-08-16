use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Weak};

use anyhow::{Context, Result};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use uuid::Uuid;

const BODY_CAP: usize = 1024 * 1024;

type Tokens = Arc<Mutex<HashMap<String, Uuid>>>;

pub struct HttpMcp {
    port: u16,
    owner: Weak<dyn crate::commands::Dispatch>,
    tokens: Tokens,
}

impl HttpMcp {
    pub async fn start(owner: Weak<dyn crate::commands::Dispatch>) -> Result<Arc<Self>> {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.context("opening the mcp port")?;
        let port = listener.local_addr()?.port();
        let served = Arc::new(Self { port, owner, tokens: Tokens::default() });

        let serving = Arc::clone(&served);
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let serving = Arc::clone(&serving);
                tokio::spawn(async move {
                    let mut stream = stream;
                    if let Err(error) = serving.answer(&mut stream).await {
                        tracing::warn!(%error, "an mcp request over http went wrong");
                        let body = serde_json::json!({ "error": format!("{error:#}") }).to_string();
                        let _ = reply(&mut stream, "500 Internal Server Error", &body).await;
                    }
                });
            }
        });

        Ok(served)
    }

    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/mcp", self.port)
    }

    pub async fn issue(&self, session: Uuid) -> String {
        let token = Uuid::new_v4().to_string();
        self.tokens.lock().await.insert(token.clone(), session);
        token
    }

    pub async fn revoke(&self, session: Uuid) {
        self.tokens.lock().await.retain(|_, owner| *owner != session);
    }

    async fn answer(&self, stream: &mut TcpStream) -> Result<()> {
        let request = read_request(stream).await?;
        let Some(session) = self.owner_of(&request.token).await else {
            return reply(stream, "401 Unauthorized", "").await;
        };

        let owner = self.owner.upgrade().context("apexd is shutting down")?;
        let mut daemon = crate::commands::Remote(owner);
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let caller = apex_mcp::caller_for(&mut daemon, Some(session), &cwd).await?;

        match apex_mcp::answer(&mut daemon, &caller, &request.body).await {
            Some(body) => reply(stream, "200 OK", &body).await,
            None => reply(stream, "202 Accepted", "").await,
        }
    }

    async fn owner_of(&self, token: &str) -> Option<Uuid> {
        self.tokens.lock().await.get(token).copied()
    }
}

struct Request {
    token: String,
    body: String,
}

async fn read_request(stream: &mut TcpStream) -> Result<Request> {
    let mut raw = Vec::new();
    let mut chunk = [0u8; 4096];
    let head = loop {
        let read = stream.read(&mut chunk).await?;
        if read == 0 {
            anyhow::bail!("the caller hung up before sending a request")
        }
        raw.extend_from_slice(&chunk[..read]);
        if let Some(at) = find(&raw, b"\r\n\r\n") {
            break at + 4;
        }
        if raw.len() > BODY_CAP {
            anyhow::bail!("the request headers are too long")
        }
    };

    let headers = String::from_utf8_lossy(&raw[..head]).to_ascii_lowercase();
    let length = headers
        .lines()
        .find_map(|line| line.strip_prefix("content-length:"))
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(0)
        .min(BODY_CAP);
    let token = headers
        .lines()
        .find_map(|line| line.strip_prefix("authorization:"))
        .and_then(|value| value.trim().strip_prefix("bearer "))
        .unwrap_or_default()
        .trim()
        .to_owned();

    while raw.len() < head + length {
        let read = stream.read(&mut chunk).await?;
        if read == 0 {
            break;
        }
        raw.extend_from_slice(&chunk[..read]);
    }

    Ok(Request { token, body: String::from_utf8_lossy(&raw[head..]).into_owned() })
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}

async fn reply(stream: &mut TcpStream, status: &str, body: &str) -> Result<()> {
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes()).await?;
    stream.write_all(body.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}
