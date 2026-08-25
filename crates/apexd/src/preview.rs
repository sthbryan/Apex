use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result};
use percent_encoding::{AsciiSet, CONTROLS, percent_decode_str, utf8_percent_encode};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use uuid::Uuid;

const HEAD_CAP: usize = 8 * 1024;
const FILE_CAP: u64 = 32 * 1024 * 1024;
const INDEX: &str = "index.html";

const IN_PATH: &AsciiSet =
    &CONTROLS.add(b' ').add(b'"').add(b'#').add(b'<').add(b'>').add(b'?').add(b'%').add(b'`');

type Roots = Arc<Mutex<HashMap<String, PathBuf>>>;

pub struct PreviewServer {
    port: u16,
    roots: Roots,
}

impl PreviewServer {
    pub async fn start() -> Result<Arc<Self>> {
        let listener =
            TcpListener::bind(("127.0.0.1", 0)).await.context("opening the preview port")?;
        let port = listener.local_addr()?.port();
        let served = Arc::new(Self { port, roots: Roots::default() });

        let serving = Arc::clone(&served);
        tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let serving = Arc::clone(&serving);
                tokio::spawn(async move {
                    let mut stream = stream;
                    if let Err(error) = serving.answer(&mut stream).await {
                        tracing::warn!(%error, "a preview request went wrong");
                    }
                });
            }
        });

        Ok(served)
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub async fn issue(&self, dir: &Path) -> String {
        let mut roots = self.roots.lock().await;
        if let Some((token, _)) = roots.iter().find(|(_, served)| served.as_path() == dir) {
            return token.clone();
        }
        let token = Uuid::new_v4().to_string();
        roots.insert(token.clone(), dir.to_path_buf());
        token
    }

    pub fn url(&self, token: &str, file: &str) -> String {
        let trail = utf8_percent_encode(file.trim_start_matches('/'), IN_PATH);
        format!("http://127.0.0.1:{}/{token}/{trail}", self.port)
    }

    async fn answer(&self, stream: &mut TcpStream) -> Result<()> {
        let request = read_head(stream).await?;
        if request.method != "GET" && request.method != "HEAD" {
            return send(stream, "405 Method Not Allowed", &[], true).await;
        }
        if !self.knows(&request.host) {
            return send(stream, "403 Forbidden", &[], true).await;
        }

        let head_only = request.method == "HEAD";
        let Some((token, wanted)) = split_target(&request.target) else {
            return send(stream, "404 Not Found", &[], head_only).await;
        };
        let Some(root) = self.roots.lock().await.get(&token).cloned() else {
            return send(stream, "404 Not Found", &[], head_only).await;
        };
        let Some(file) = find_file(&root, &wanted) else {
            return send(stream, "404 Not Found", &[], head_only).await;
        };

        let size = tokio::fs::metadata(&file).await?.len();
        if size > FILE_CAP {
            return send(stream, "413 Payload Too Large", &[], head_only).await;
        }

        let body = tokio::fs::read(&file).await?;
        let status = format!("200 OK\r\nContent-Type: {}", apex_core::preview::content_type(&file));
        send(stream, &status, &body, head_only).await
    }

    fn knows(&self, host: &str) -> bool {
        host == format!("127.0.0.1:{}", self.port) || host == format!("localhost:{}", self.port)
    }
}

fn find_file(root: &Path, wanted: &str) -> Option<PathBuf> {
    let asked = if wanted.is_empty() { INDEX.to_owned() } else { wanted.to_owned() };
    let found = apex_core::files::resolve(root, &asked).ok()?;
    if !found.is_dir() {
        return Some(found);
    }
    apex_core::files::resolve(root, &format!("{}/{INDEX}", asked.trim_end_matches('/'))).ok()
}

fn split_target(target: &str) -> Option<(String, String)> {
    let path = target.split(['?', '#']).next().unwrap_or_default();
    let mut parts = path.trim_start_matches('/').splitn(2, '/');
    let token = parts.next().filter(|token| !token.is_empty())?;
    let rest = parts.next().unwrap_or_default();
    Some((token.to_owned(), percent_decode_str(rest).decode_utf8_lossy().into_owned()))
}

struct Request {
    method: String,
    target: String,
    host: String,
}

async fn read_head(stream: &mut TcpStream) -> Result<Request> {
    let mut raw = Vec::new();
    let mut chunk = [0u8; 2048];
    loop {
        let read = stream.read(&mut chunk).await?;
        if read == 0 {
            anyhow::bail!("the caller hung up before sending a request")
        }
        raw.extend_from_slice(&chunk[..read]);
        if raw.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
        if raw.len() > HEAD_CAP {
            anyhow::bail!("the request headers are too long")
        }
    }

    let head = String::from_utf8_lossy(&raw).into_owned();
    let mut lines = head.lines();
    let mut opening = lines.next().unwrap_or_default().split_whitespace();
    let method = opening.next().unwrap_or_default().to_owned();
    let target = opening.next().unwrap_or_default().to_owned();
    let host = lines
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("host").then(|| value.trim().to_owned())
        })
        .unwrap_or_default();
    Ok(Request { method, target, host })
}

async fn send(stream: &mut TcpStream, status: &str, body: &[u8], head_only: bool) -> Result<()> {
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Length: {}\r\nCache-Control: no-store\r\n\
         X-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes()).await?;
    if !head_only {
        stream.write_all(body).await?;
    }
    stream.flush().await?;
    Ok(())
}

#[cfg(test)]
#[path = "preview_tests.rs"]
mod tests;
