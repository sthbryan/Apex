use std::collections::BTreeMap;
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use apex_core::{AgentProfile, QuotaFormat, QuotaSource};
use tokio::process::Command;
use tokio::time::timeout;

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

#[derive(Default)]
pub struct QuotaCache {
    entries: HashMap<String, (Instant, Option<QuotaReport>)>,
}

impl QuotaCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn read(
        &mut self,
        profile: &AgentProfile,
        binary: PathBuf,
        env: &BTreeMap<String, String>,
        force: bool,
    ) -> Option<QuotaReport> {
        let config = profile.quota.as_ref()?;
        let ttl = Duration::from_secs(config.cache_ttl_secs.max(1));

        if !force
            && let Some((taken, cached)) = self.entries.get(&profile.name)
            && taken.elapsed() < ttl
        {
            return cached.clone();
        }

        let fresh = match config.source {
            QuotaSource::Command => {
                run_command(&binary, &config.args, env)
                    .await
                    .and_then(|raw| parse(config.format, &profile.name, &raw))
            }
        };

        self.entries.insert(profile.name.clone(), (Instant::now(), fresh.clone()));
        fresh
    }

    pub fn peek(&self, name: &str, ttl: Duration) -> Option<Option<QuotaReport>> {
        let (taken, cached) = self.entries.get(name)?;
        if taken.elapsed() < ttl {
            Some(cached.clone())
        } else {
            None
        }
    }

    pub fn store(&mut self, name: &str, report: Option<QuotaReport>) {
        self.entries.insert(name.to_string(), (Instant::now(), report));
    }

    pub fn invalidate(&mut self) {
        self.entries.clear();
    }
}

pub async fn read_quota_command(
    profile: &AgentProfile,
    binary: PathBuf,
    env: &BTreeMap<String, String>,
) -> Option<QuotaReport> {
    let config = profile.quota.as_ref()?;
    match config.source {
        QuotaSource::Command => {
            run_command(&binary, &config.args, env)
                .await
                .and_then(|raw| parse(config.format, &profile.name, &raw))
        }
    }
}

async fn run_command(
    binary: &PathBuf,
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

pub fn parse(format: QuotaFormat, agent: &str, raw: &str) -> Option<QuotaReport> {
    match format {
        QuotaFormat::Codexbar => parse_codexbar(agent, raw),
    }
}

fn parse_codexbar(agent: &str, raw: &str) -> Option<QuotaReport> {
    let parsed: serde_json::Value = serde_json::from_str(raw.trim()).ok()?;
    let first = parsed.as_array()?.first()?;
    let usage = first.get("usage")?;
    let pace = first.get("pace");

    let windows: Vec<QuotaWindow> = ["primary", "secondary", "tertiary"]
        .iter()
        .filter_map(|key| read_window(usage.get(*key)?, pace.and_then(|entry| entry.get(*key))))
        .collect();

    if windows.is_empty() {
        return None;
    }
    Some(QuotaReport {
        agent: agent.to_string(),
        windows,
        updated_at: usage.get("updatedAt").and_then(|value| value.as_str()).map(str::to_string),
    })
}

fn read_window(value: &serde_json::Value, pace: Option<&serde_json::Value>) -> Option<QuotaWindow> {
    let used = value.get("usedPercent")?.as_f64()?;
    Some(QuotaWindow {
        label: window_label(value.get("windowMinutes").and_then(serde_json::Value::as_u64)),
        used_percent: used.clamp(0.0, 100.0).round() as u8,
        expected_percent: pace
            .and_then(|entry| entry.get("expectedUsedPercent"))
            .and_then(serde_json::Value::as_f64)
            .map(|value| value.clamp(0.0, 100.0).round() as u8),
        lasts_to_reset: pace
            .and_then(|entry| entry.get("willLastToReset"))
            .and_then(serde_json::Value::as_bool),
        eta_seconds: pace
            .and_then(|entry| entry.get("etaSeconds"))
            .and_then(serde_json::Value::as_u64),
        resets_at: value.get("resetsAt").and_then(|entry| entry.as_str()).map(str::to_string),
        reset_description: value
            .get("resetDescription")
            .and_then(|entry| entry.as_str())
            .map(str::to_string),
    })
}

fn window_label(minutes: Option<u64>) -> Option<String> {
    let value = minutes?;
    Some(match value {
        value if value % 10080 == 0 => format!("{}w", value / 10080),
        value if value % 1440 == 0 => format!("{}d", value / 1440),
        value if value % 60 == 0 => format!("{}h", value / 60),
        value => format!("{value}m"),
    })
}

#[cfg(test)]
#[path = "lib_tests.rs"]
mod tests;
