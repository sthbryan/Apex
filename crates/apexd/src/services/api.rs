use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use apex_core::api;
use apex_proto::ApiRun;

const TIMEOUT: Duration = Duration::from_secs(30);
const BODY_CAP: usize = 256 * 1024;

#[derive(Default)]
pub struct ApiService {
    client: tokio::sync::OnceCell<reqwest::Client>,
}

impl ApiService {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn send(&self, root: &Path, name: &str, environment: Option<&str>) -> Result<ApiRun> {
        let saved = api::load(root, name)?;
        let ready = api::apply(&saved, &api::variables(root, environment)?)?;
        let method = reqwest::Method::from_bytes(ready.method.as_bytes())
            .with_context(|| format!("{} is not an http method", ready.method))?;
        let url = reqwest::Url::parse(&ready.url)
            .with_context(|| format!("{} is not an address", ready.url))?;

        let client = self.client.get_or_try_init(build).await?;
        let mut asking = client.request(method, url);
        for (key, value) in &ready.headers {
            asking = asking.header(key, value);
        }
        if let Some(body) = ready.body.clone() {
            asking = asking.body(body);
        }

        let started = Instant::now();
        let answer = asking.send().await.map_err(explain)?;
        let status = answer.status().as_u16();
        let headers = answer
            .headers()
            .iter()
            .map(|(key, value)| (key.as_str().to_owned(), value.to_str().unwrap_or("").to_owned()))
            .collect();
        let full = answer.bytes().await.map_err(explain)?;
        let millis = started.elapsed().as_millis() as u64;

        let truncated = full.len() > BODY_CAP;
        let kept = if truncated { &full[..BODY_CAP] } else { &full[..] };
        let run = ApiRun {
            name: name.to_owned(),
            method: ready.method,
            url: ready.url,
            status,
            millis,
            at: now(),
            headers,
            body: String::from_utf8_lossy(kept).into_owned(),
            truncated,
            size: full.len() as u64,
        };
        keep(root, &run);
        Ok(run)
    }

    pub fn last(&self, root: &Path, name: &str) -> Option<ApiRun> {
        let path = api::run_path(root, name).ok()?;
        let text = std::fs::read_to_string(path).ok()?;
        serde_json::from_str(&text).ok()
    }
}

async fn build() -> Result<reqwest::Client> {
    reqwest::Client::builder().timeout(TIMEOUT).build().context("could not start an http client")
}

fn keep(root: &Path, run: &ApiRun) {
    let Ok(path) = api::run_path(root, &run.name) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(text) = serde_json::to_string(run) {
        let _ = std::fs::write(path, text);
    }
}

fn explain(error: reqwest::Error) -> anyhow::Error {
    if error.is_timeout() {
        return anyhow::anyhow!("the request timed out after {} seconds", TIMEOUT.as_secs());
    }
    if error.is_connect() {
        return anyhow::anyhow!("nothing answered at that address");
    }
    anyhow::anyhow!("{error}")
}

fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_secs() as i64)
        .unwrap_or_default()
}
