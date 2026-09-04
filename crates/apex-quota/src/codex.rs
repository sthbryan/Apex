use std::collections::BTreeMap;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use serde_json::json;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::time::timeout;

use crate::{QuotaReport, QuotaWindow, iso_from_epoch, percent, window_label};

const READ_TIMEOUT: Duration = Duration::from_secs(20);
const RATE_LIMITS_ID: u64 = 2;
const APP_SERVER_ARGS: [&str; 5] = ["-s", "read-only", "-a", "never", "app-server"];

pub async fn read(
    agent: &str,
    binary: &Path,
    env: &BTreeMap<String, String>,
) -> Option<QuotaReport> {
    let raw = timeout(READ_TIMEOUT, ask(binary, env)).await.ok().flatten()?;
    parse(agent, &raw)
}

async fn ask(binary: &Path, env: &BTreeMap<String, String>) -> Option<String> {
    let mut child = Command::new(binary)
        .args(APP_SERVER_ARGS)
        .env_clear()
        .envs(env)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .ok()?;

    let mut stdin = child.stdin.take()?;
    let requests = [
        json!({"jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"clientInfo": {"name": "apex", "title": "Apex", "version": env!("CARGO_PKG_VERSION")}}}),
        json!({"jsonrpc": "2.0", "method": "initialized", "params": {}}),
        json!({"jsonrpc": "2.0", "id": RATE_LIMITS_ID, "method": "account/rateLimits/read", "params": {}}),
    ];
    for request in requests {
        stdin.write_all(format!("{request}\n").as_bytes()).await.ok()?;
    }
    stdin.flush().await.ok()?;

    let mut lines = BufReader::new(child.stdout.take()?).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let parsed: serde_json::Value = match serde_json::from_str(&line) {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };
        if parsed.get("id").and_then(serde_json::Value::as_u64) == Some(RATE_LIMITS_ID) {
            return Some(line);
        }
    }
    None
}

fn parse(agent: &str, raw: &str) -> Option<QuotaReport> {
    let parsed: serde_json::Value = serde_json::from_str(raw.trim()).ok()?;
    let limits = parsed.get("result")?.get("rateLimits")?;

    let windows: Vec<QuotaWindow> =
        ["primary", "secondary"].iter().filter_map(|key| read_window(limits.get(*key)?)).collect();

    if windows.is_empty() {
        return None;
    }
    Some(QuotaReport { agent: agent.to_string(), windows, updated_at: None })
}

fn read_window(value: &serde_json::Value) -> Option<QuotaWindow> {
    let used = value.get("usedPercent")?.as_f64()?;
    Some(QuotaWindow {
        label: window_label(value.get("windowDurationMins").and_then(serde_json::Value::as_u64)),
        used_percent: percent(used),
        expected_percent: None,
        lasts_to_reset: None,
        eta_seconds: None,
        resets_at: value
            .get("resetsAt")
            .and_then(serde_json::Value::as_i64)
            .and_then(iso_from_epoch),
        reset_description: None,
    })
}

#[cfg(test)]
#[path = "codex_tests.rs"]
mod tests;
