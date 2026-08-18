use std::collections::BTreeMap;
use std::path::PathBuf;

use crate::{QuotaReport, QuotaWindow, get_json, home, iso_from_epoch, percent};

const BILLING: &str = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";

pub async fn read(agent: &str, env: &BTreeMap<String, String>) -> Option<QuotaReport> {
    let token = token(env)?;
    let payload = get_json(
        BILLING,
        &[
            ("authorization", format!("Bearer {token}")),
            ("x-xai-token-auth", "xai-grok-cli".to_string()),
        ],
    )
    .await?;
    parse(agent, &payload)
}

fn auth_path(env: &BTreeMap<String, String>) -> Option<PathBuf> {
    let base = match env.get("GROK_HOME") {
        Some(custom) => PathBuf::from(custom),
        None => home(env)?.join(".grok"),
    };
    Some(base.join("auth.json"))
}

fn token(env: &BTreeMap<String, String>) -> Option<String> {
    if let Some(direct) = env.get("GROK_OAUTH_TOKEN") {
        return Some(direct.clone());
    }
    let raw = std::fs::read_to_string(auth_path(env)?).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    read_token(&parsed)
}

fn read_token(value: &serde_json::Value) -> Option<String> {
    for key in ["key", "access_token", "accessToken", "token"] {
        if let Some(found) = value.get(key).and_then(serde_json::Value::as_str) {
            return Some(found.to_string());
        }
    }
    value.as_object()?.values().find_map(read_token)
}

fn parse(agent: &str, payload: &serde_json::Value) -> Option<QuotaReport> {
    let config = payload.get("config").unwrap_or(payload);
    let used = config.get("creditUsagePercent")?.as_f64()?;
    let window = QuotaWindow {
        label: None,
        used_percent: percent(used),
        expected_percent: None,
        lasts_to_reset: None,
        eta_seconds: None,
        resets_at: config
            .get("currentPeriod")
            .and_then(|period| period.get("end"))
            .and_then(reset_time),
        reset_description: None,
    };
    Some(QuotaReport { agent: agent.to_string(), windows: vec![window], updated_at: None })
}

fn reset_time(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) => Some(text.clone()),
        serde_json::Value::Number(number) => iso_from_epoch(number.as_i64()?),
        _ => None,
    }
}

#[cfg(test)]
#[path = "grok_tests.rs"]
mod tests;
