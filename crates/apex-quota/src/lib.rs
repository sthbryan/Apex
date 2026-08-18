mod claude;
mod codex;
mod codexbar;

use std::collections::BTreeMap;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use apex_core::QuotaFormat;
use tokio::process::Command;
use tokio::time::timeout;

pub use codexbar::parse;

const RUN_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuotaWindow {
    pub label: Option<String>,
    pub used_percent: u8,
    pub expected_percent: Option<u8>,
    pub lasts_to_reset: Option<bool>,
    pub eta_seconds: Option<u64>,
    pub resets_at: Option<String>,
    pub reset_description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuotaReport {
    pub agent: String,
    pub windows: Vec<QuotaWindow>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Prepared {
    Command { format: QuotaFormat, binary: PathBuf, args: Vec<String> },
    CodexAppServer { binary: PathBuf },
    ClaudeOauth,
}

#[derive(Default)]
pub struct QuotaCache {
    entries: HashMap<String, (Instant, Option<QuotaReport>)>,
}

impl QuotaCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn peek(&self, name: &str, ttl: Duration) -> Option<Option<QuotaReport>> {
        let (taken, cached) = self.entries.get(name)?;
        if taken.elapsed() < ttl { Some(cached.clone()) } else { None }
    }

    pub fn store(&mut self, name: &str, report: Option<QuotaReport>) {
        self.entries.insert(name.to_string(), (Instant::now(), report));
    }

    pub fn invalidate(&mut self) {
        self.entries.clear();
    }
}

pub async fn read_first(
    agent: &str,
    sources: &[Prepared],
    env: &BTreeMap<String, String>,
) -> Option<QuotaReport> {
    for source in sources {
        let report = match source {
            Prepared::Command { format, binary, args } => run_command(binary, args, env)
                .await
                .and_then(|raw| codexbar::parse(*format, agent, &raw)),
            Prepared::CodexAppServer { binary } => codex::read(agent, binary, env).await,
            Prepared::ClaudeOauth => claude::read(agent, env).await,
        };
        if report.is_some() {
            return report;
        }
    }
    None
}

async fn run_command(
    binary: &Path,
    args: &[String],
    env: &BTreeMap<String, String>,
) -> Option<String> {
    let mut command = Command::new(binary);
    command.args(args);
    command.env_clear();
    command.envs(env);
    command.stdin(std::process::Stdio::null());
    command.kill_on_drop(true);

    let output = match timeout(RUN_TIMEOUT, command.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(error)) => {
            tracing::debug!(binary = %binary.display(), %error, "failed to read quota");
            return None;
        }
        Err(_) => {
            tracing::debug!(binary = %binary.display(), "quota read timed out");
            return None;
        }
    };

    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

pub(crate) fn window_label(minutes: Option<u64>) -> Option<String> {
    let value = minutes?;
    Some(match value {
        value if value % 10080 == 0 => format!("{}w", value / 10080),
        value if value % 1440 == 0 => format!("{}d", value / 1440),
        value if value % 60 == 0 => format!("{}h", value / 60),
        value => format!("{value}m"),
    })
}

pub(crate) async fn get_json(url: &str, headers: &[(&str, String)]) -> Option<serde_json::Value> {
    let client = reqwest::Client::builder().timeout(RUN_TIMEOUT).build().ok()?;
    let mut request = client.get(url);
    for (name, value) in headers {
        request = request.header(*name, value);
    }
    let response = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            tracing::debug!(url, %error, "quota request failed");
            return None;
        }
    };
    if !response.status().is_success() {
        tracing::debug!(url, status = %response.status(), "quota request rejected");
        return None;
    }
    response.json().await.ok()
}

pub(crate) fn home(env: &BTreeMap<String, String>) -> Option<PathBuf> {
    env.get("HOME").map(PathBuf::from)
}

pub(crate) fn iso_from_epoch(seconds: i64) -> Option<String> {
    chrono::DateTime::from_timestamp(seconds, 0).map(|when| when.to_rfc3339())
}

pub(crate) fn percent(value: f64) -> u8 {
    value.clamp(0.0, 100.0).round() as u8
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
