use std::collections::BTreeMap;

use crate::{QuotaReport, QuotaWindow, get_json, home, percent};

const USAGE: &str = "https://api.anthropic.com/api/oauth/usage";
const BETA: &str = "oauth-2025-04-20";
const KEYCHAIN_SERVICE: &str = "Claude Code-credentials";

pub async fn read(agent: &str, env: &BTreeMap<String, String>) -> Option<QuotaReport> {
    let token = token(env).await?;
    let payload = get_json(
        USAGE,
        &[("authorization", format!("Bearer {token}")), ("anthropic-beta", BETA.to_string())],
    )
    .await?;
    parse(agent, &payload)
}

async fn token(env: &BTreeMap<String, String>) -> Option<String> {
    let stored = match home(env)
        .and_then(|dir| std::fs::read_to_string(dir.join(".claude").join(".credentials.json")).ok())
    {
        Some(raw) => raw,
        None => keychain().await?,
    };
    let parsed: serde_json::Value = serde_json::from_str(&stored).ok()?;
    parsed.get("claudeAiOauth")?.get("accessToken")?.as_str().map(str::to_string)
}

async fn keychain() -> Option<String> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let output = tokio::process::Command::new("security")
        .args(["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"])
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn parse(agent: &str, payload: &serde_json::Value) -> Option<QuotaReport> {
    let lanes = [("five_hour", "5h"), ("seven_day", "1w"), ("seven_day_opus", "1w opus")];
    let windows: Vec<QuotaWindow> =
        lanes.iter().filter_map(|(key, label)| read_window(payload.get(*key)?, label)).collect();

    if windows.is_empty() {
        return None;
    }
    Some(QuotaReport { agent: agent.to_string(), windows, updated_at: None })
}

fn read_window(value: &serde_json::Value, label: &str) -> Option<QuotaWindow> {
    let used = ["utilization", "used_percent", "usedPercent"]
        .iter()
        .find_map(|key| value.get(*key).and_then(serde_json::Value::as_f64))?;
    Some(QuotaWindow {
        label: Some(label.to_string()),
        used_percent: percent(used),
        expected_percent: None,
        lasts_to_reset: None,
        eta_seconds: None,
        resets_at: value.get("resets_at").and_then(serde_json::Value::as_str).map(str::to_string),
        reset_description: None,
    })
}

#[cfg(test)]
#[path = "claude_tests.rs"]
mod tests;
