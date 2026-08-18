use std::collections::BTreeMap;
use std::path::Path;
use std::time::Duration;

use apex_pty::{PtyProcess, PtySpec};
use tokio::time::sleep;

use crate::{QuotaReport, QuotaWindow, percent};

const QUOTA_PATH: &str = "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary";
const SPAWN_ATTEMPTS: u8 = 12;
const SPAWN_WAIT: Duration = Duration::from_millis(700);

pub async fn read(
    agent: &str,
    binary: &Path,
    env: &BTreeMap<String, String>,
) -> Option<QuotaReport> {
    if let Some(report) = ask_ports(agent, &running_ports(binary, env)).await {
        return Some(report);
    }

    let mut spec = PtySpec::new(binary, std::env::temp_dir());
    spec.env = env.clone();
    let child = PtyProcess::spawn(spec).ok()?;
    let pid = child.pid()?;

    let mut report = None;
    for _ in 0..SPAWN_ATTEMPTS {
        sleep(SPAWN_WAIT).await;
        report = ask_ports(agent, &listening_ports(pid)).await;
        if report.is_some() {
            break;
        }
    }
    let _ = child.kill();
    report
}

fn running_ports(binary: &Path, env: &BTreeMap<String, String>) -> Vec<u16> {
    let name = binary.file_name().and_then(|name| name.to_str()).unwrap_or("agy");
    let mut command = std::process::Command::new("pgrep");
    if let Some(user) = env.get("USER") {
        command.args(["-u", user]);
    }
    let Ok(found) = command.args(["-x", name]).output() else {
        return Vec::new();
    };
    String::from_utf8_lossy(&found.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .flat_map(listening_ports)
        .collect()
}

fn listening_ports(pid: u32) -> Vec<u16> {
    let Ok(output) = std::process::Command::new("lsof")
        .args(["-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", &pid.to_string()])
        .output()
    else {
        return Vec::new();
    };
    listening_ports_from(&String::from_utf8_lossy(&output.stdout))
}

fn listening_ports_from(output: &str) -> Vec<u16> {
    output
        .lines()
        .filter_map(|line| line.rsplit_once("127.0.0.1:"))
        .filter_map(|(_, tail)| tail.split_whitespace().next())
        .filter_map(|port| port.parse::<u16>().ok())
        .collect()
}

async fn ask_ports(agent: &str, ports: &[u16]) -> Option<QuotaReport> {
    for port in ports {
        if let Some(report) = ask(agent, *port).await {
            return Some(report);
        }
    }
    None
}

async fn ask(agent: &str, port: u16) -> Option<QuotaReport> {
    let client = crate::loopback_client()?;
    let response = client
        .post(format!("https://127.0.0.1:{port}{QUOTA_PATH}"))
        .header("content-type", "application/json")
        .body("{}")
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    parse(agent, &response.json().await.ok()?)
}

fn parse(agent: &str, payload: &serde_json::Value) -> Option<QuotaReport> {
    let groups = payload.get("response")?.get("groups")?.as_array()?;
    let windows: Vec<QuotaWindow> = groups.iter().filter_map(read_group).collect();

    if windows.is_empty() {
        return None;
    }
    Some(QuotaReport { agent: agent.to_string(), windows, updated_at: None })
}

fn read_group(group: &serde_json::Value) -> Option<QuotaWindow> {
    let bucket = group
        .get("buckets")?
        .as_array()?
        .iter()
        .min_by(|left, right| remaining(left).total_cmp(&remaining(right)))?;
    Some(QuotaWindow {
        label: bucket.get("window").and_then(serde_json::Value::as_str).map(window_label),
        used_percent: percent((1.0 - remaining(bucket)) * 100.0),
        expected_percent: None,
        lasts_to_reset: None,
        eta_seconds: None,
        resets_at: bucket.get("resetTime").and_then(serde_json::Value::as_str).map(str::to_string),
        reset_description: group
            .get("displayName")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
    })
}

fn remaining(bucket: &serde_json::Value) -> f64 {
    bucket.get("remainingFraction").and_then(serde_json::Value::as_f64).unwrap_or(1.0)
}

fn window_label(window: &str) -> String {
    match window {
        "weekly" => "1w".to_string(),
        "daily" => "1d".to_string(),
        "monthly" => "30d".to_string(),
        other => other.to_string(),
    }
}

#[cfg(test)]
#[path = "antigravity_tests.rs"]
mod tests;
