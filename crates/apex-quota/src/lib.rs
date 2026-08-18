mod antigravity;
mod claude;
mod codex;
mod grok;

use std::collections::BTreeMap;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};

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
    CodexAppServer { binary: PathBuf },
    AntigravityLanguageServer { binary: PathBuf },
    GrokBilling,
    ClaudeOauth,
}

impl Prepared {
    pub fn native(agent: &str, binary: PathBuf) -> Option<Self> {
        match agent {
            "codex" => Some(Self::CodexAppServer { binary }),
            "antigravity" => Some(Self::AntigravityLanguageServer { binary }),
            "grok" => Some(Self::GrokBilling),
            "claude" => Some(Self::ClaudeOauth),
            _ => None,
        }
    }
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
            Prepared::CodexAppServer { binary } => codex::read(agent, binary, env).await,
            Prepared::AntigravityLanguageServer { binary } => {
                antigravity::read(agent, binary, env).await
            }
            Prepared::GrokBilling => grok::read(agent, env).await,
            Prepared::ClaudeOauth => claude::read(agent, env).await,
        };
        if report.is_some() {
            return report;
        }
    }
    None
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

pub(crate) fn loopback_client() -> Option<reqwest::Client> {
    reqwest::Client::builder().danger_accept_invalid_certs(true).timeout(RUN_TIMEOUT).build().ok()
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
