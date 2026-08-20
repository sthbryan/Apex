use std::collections::BTreeMap;
use std::path::PathBuf;

use crate::{QuotaReport, QuotaWindow, RUN_TIMEOUT, home, percent};

const USAGE: &str = "https://api.anthropic.com/api/oauth/usage";
const REFRESH: &str = "https://console.anthropic.com/v1/oauth/token";
const CLIENT_ID: &str = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const BETA: &str = "oauth-2025-04-20";
const KEYCHAIN_SERVICE: &str = "Claude Code-credentials";
const SKEW_MILLIS: i64 = 60_000;

enum Store {
    File(PathBuf),
    Keychain { account: String },
}

struct Credentials {
    raw: serde_json::Value,
    store: Store,
}

enum Answer {
    Payload(serde_json::Value),
    Unauthorized,
    Failed,
}

pub async fn read(agent: &str, env: &BTreeMap<String, String>) -> Option<QuotaReport> {
    let mut credentials = load(env).await?;
    if credentials.expired() {
        refresh(&mut credentials).await?;
    }
    let payload = match fetch(&credentials.access()?).await {
        Answer::Payload(payload) => payload,
        Answer::Failed => return None,
        Answer::Unauthorized => {
            refresh(&mut credentials).await?;
            match fetch(&credentials.access()?).await {
                Answer::Payload(payload) => payload,
                _ => return None,
            }
        }
    };
    parse(agent, &payload)
}

async fn fetch(token: &str) -> Answer {
    let Some(client) = reqwest::Client::builder().timeout(RUN_TIMEOUT).build().ok() else {
        return Answer::Failed;
    };
    let response = client
        .get(USAGE)
        .header("authorization", format!("Bearer {token}"))
        .header("anthropic-beta", BETA)
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            tracing::debug!(%error, "claude usage request failed");
            return Answer::Failed;
        }
    };
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Answer::Unauthorized;
    }
    if !response.status().is_success() {
        tracing::debug!(status = %response.status(), "claude usage request rejected");
        return Answer::Failed;
    }
    match response.json().await {
        Ok(payload) => Answer::Payload(payload),
        Err(error) => {
            tracing::debug!(%error, "claude usage answer unreadable");
            Answer::Failed
        }
    }
}

async fn refresh(credentials: &mut Credentials) -> Option<()> {
    let token = credentials.refresh_token()?;
    let client = reqwest::Client::builder().timeout(RUN_TIMEOUT).build().ok()?;
    let body = serde_json::json!({
        "grant_type": "refresh_token",
        "refresh_token": token,
        "client_id": CLIENT_ID,
    });
    let response = match client.post(REFRESH).json(&body).send().await {
        Ok(response) => response,
        Err(error) => {
            tracing::debug!(%error, "claude refresh failed");
            return None;
        }
    };
    if !response.status().is_success() {
        tracing::debug!(status = %response.status(), "claude refresh rejected");
        return None;
    }
    let granted: serde_json::Value = response.json().await.ok()?;
    credentials.adopt(&granted)?;
    credentials.save().await;
    Some(())
}

async fn load(env: &BTreeMap<String, String>) -> Option<Credentials> {
    if let Some(path) = home(env).map(|dir| dir.join(".claude").join(".credentials.json"))
        && let Ok(stored) = std::fs::read_to_string(&path)
        && let Ok(raw) = serde_json::from_str(&stored)
    {
        return Some(Credentials { raw, store: Store::File(path) });
    }
    let stored = keychain(&["-w"]).await?;
    let raw = serde_json::from_str(&stored).ok()?;
    let account = keychain_account().await?;
    Some(Credentials { raw, store: Store::Keychain { account } })
}

async fn keychain(extra: &[&str]) -> Option<String> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let mut args = vec!["find-generic-password", "-s", KEYCHAIN_SERVICE];
    args.extend_from_slice(extra);
    let output = tokio::process::Command::new("security").args(args).output().await.ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

async fn keychain_account() -> Option<String> {
    let described = keychain(&[]).await?;
    described.lines().find_map(|line| {
        let rest = line.trim().strip_prefix("\"acct\"<blob>=\"")?;
        rest.strip_suffix('"').map(str::to_string)
    })
}

impl Credentials {
    fn oauth(&self) -> Option<&serde_json::Value> {
        self.raw.get("claudeAiOauth")
    }

    fn access(&self) -> Option<String> {
        self.oauth()?.get("accessToken")?.as_str().map(str::to_string)
    }

    fn refresh_token(&self) -> Option<String> {
        self.oauth()?.get("refreshToken")?.as_str().map(str::to_string)
    }

    fn expired(&self) -> bool {
        let Some(expires_at) = self.oauth().and_then(|oauth| oauth.get("expiresAt")) else {
            return false;
        };
        let Some(expires_at) = expires_at.as_i64() else {
            return false;
        };
        expires_at - SKEW_MILLIS <= chrono::Utc::now().timestamp_millis()
    }

    fn adopt(&mut self, granted: &serde_json::Value) -> Option<()> {
        let access = granted.get("access_token")?.as_str()?.to_string();
        let oauth = self.raw.get_mut("claudeAiOauth")?.as_object_mut()?;
        oauth.insert("accessToken".to_string(), access.into());
        if let Some(refreshed) = granted.get("refresh_token").and_then(serde_json::Value::as_str) {
            oauth.insert("refreshToken".to_string(), refreshed.into());
        }
        if let Some(lifetime) = granted.get("expires_in").and_then(serde_json::Value::as_i64) {
            let expires_at = chrono::Utc::now().timestamp_millis() + lifetime * 1_000;
            oauth.insert("expiresAt".to_string(), expires_at.into());
        }
        Some(())
    }

    async fn save(&self) {
        let raw = self.raw.to_string();
        let saved = match &self.store {
            Store::File(path) => std::fs::write(path, raw).is_ok(),
            Store::Keychain { account } => tokio::process::Command::new("security")
                .args([
                    "add-generic-password",
                    "-U",
                    "-s",
                    KEYCHAIN_SERVICE,
                    "-a",
                    account,
                    "-w",
                    &raw,
                ])
                .output()
                .await
                .is_ok_and(|output| output.status.success()),
        };
        if !saved {
            tracing::debug!("claude credentials could not be stored");
        }
    }
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
