use apex_core::QuotaFormat;

use crate::{QuotaReport, QuotaWindow, window_label};

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
