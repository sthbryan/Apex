use std::collections::BTreeMap;
use std::path::PathBuf;

use crate::{QuotaReport, QuotaWindow, get_json, home, iso_from_epoch, percent};

const CREDITS: &str = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const BILLING: &str = "https://cli-chat-proxy.grok.com/v1/billing";

pub async fn read(agent: &str, env: &BTreeMap<String, String>) -> Option<QuotaReport> {
    let token = token(env)?;
    let headers = [
        ("authorization", format!("Bearer {token}")),
        ("x-xai-token-auth", "xai-grok-cli".to_string()),
    ];
    if let Some(report) =
        get_json(CREDITS, &headers).await.and_then(|payload| parse(agent, &payload))
    {
        return Some(report);
    }
    let payload = get_json(BILLING, &headers).await?;
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
    let used = used_percent(config)?;
    let window = QuotaWindow {
        label: None,
        used_percent: percent(used),
        expected_percent: None,
        lasts_to_reset: None,
        eta_seconds: None,
        resets_at: config
            .get("currentPeriod")
            .and_then(|period| period.get("end"))
            .or_else(|| config.get("billingPeriodEnd"))
            .and_then(reset_time),
        reset_description: None,
    };
    Some(QuotaReport { agent: agent.to_string(), windows: vec![window], updated_at: None })
}

fn used_percent(config: &serde_json::Value) -> Option<f64> {
    if let Some(direct) = config.get("creditUsagePercent").and_then(serde_json::Value::as_f64) {
        return Some(direct);
    }
    if let Some(product) =
        config.get("productUsage").and_then(serde_json::Value::as_array).and_then(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry.get("usagePercent").and_then(serde_json::Value::as_f64))
                .max_by(f64::total_cmp)
        })
    {
        return Some(product);
    }
    if config.get("currentPeriod").is_some() {
        return Some(0.0);
    }
    let limit = amount(config.get("monthlyLimit")?)?;
    if limit <= 0.0 {
        return None;
    }
    let used = config.get("used").or_else(|| config.get("totalUsed")).and_then(amount)?;
    Some(used / limit * 100.0)
}

fn amount(value: &serde_json::Value) -> Option<f64> {
    value.get("val").and_then(serde_json::Value::as_f64)
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
