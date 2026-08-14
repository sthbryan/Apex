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
    pub label: String,
    pub used_percent: u8,
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

    pub fn invalidate(&mut self) {
        self.entries.clear();
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
            tracing::debug!(binary = %binary.display(), %error, "no se pudo leer la quota");
            return None;
        }
        Err(_) => {
            tracing::debug!(binary = %binary.display(), "la lectura de quota expiro");
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

    let windows: Vec<QuotaWindow> = ["primary", "secondary", "tertiary"]
        .iter()
        .filter_map(|key| read_window(usage.get(*key)?))
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

fn read_window(value: &serde_json::Value) -> Option<QuotaWindow> {
    let used = value.get("usedPercent")?.as_f64()?;
    Some(QuotaWindow {
        label: window_label(value.get("windowMinutes").and_then(serde_json::Value::as_u64)),
        used_percent: used.clamp(0.0, 100.0).round() as u8,
        resets_at: value.get("resetsAt").and_then(|entry| entry.as_str()).map(str::to_string),
        reset_description: value
            .get("resetDescription")
            .and_then(|entry| entry.as_str())
            .map(str::to_string),
    })
}

fn window_label(minutes: Option<u64>) -> String {
    match minutes {
        Some(value) if value % 10080 == 0 => format!("{}w", value / 10080),
        Some(value) if value % 1440 == 0 => format!("{}d", value / 1440),
        Some(value) if value % 60 == 0 => format!("{}h", value / 60),
        Some(value) => format!("{value}m"),
        None => "ventana".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"[{"provider":"claude","usage":{
        "primary":{"windowMinutes":300,"usedPercent":65,"resetsAt":"2026-08-14T05:40:00Z","resetDescription":"Resets 11:40pm"},
        "secondary":{"windowMinutes":10080,"usedPercent":50,"resetsAt":"2026-08-18T03:00:00Z"},
        "tertiary":null,
        "updatedAt":"2026-08-14T01:54:46Z"}}]"#;

    #[test]
    fn a_codexbar_report_yields_its_windows() {
        let report = parse(QuotaFormat::Codexbar, "claude", SAMPLE).expect("reporte");
        assert_eq!(report.agent, "claude");
        assert_eq!(report.windows.len(), 2);

        assert_eq!(report.windows[0].label, "5h");
        assert_eq!(report.windows[0].used_percent, 65);
        assert_eq!(report.windows[0].reset_description.as_deref(), Some("Resets 11:40pm"));

        assert_eq!(report.windows[1].label, "1w");
        assert_eq!(report.windows[1].used_percent, 50);
        assert_eq!(report.updated_at.as_deref(), Some("2026-08-14T01:54:46Z"));
    }

    #[test]
    fn garbage_input_is_ignored_instead_of_panicking() {
        assert!(parse(QuotaFormat::Codexbar, "claude", "no soy json").is_none());
        assert!(parse(QuotaFormat::Codexbar, "claude", "[]").is_none());
        assert!(parse(QuotaFormat::Codexbar, "claude", "{}").is_none());
    }

    #[test]
    fn a_report_without_usable_windows_is_discarded() {
        let empty = r#"[{"provider":"x","usage":{"primary":null,"secondary":null}}]"#;
        assert!(parse(QuotaFormat::Codexbar, "x", empty).is_none());
    }

    #[test]
    fn percentages_are_clamped_and_rounded() {
        let odd = r#"[{"usage":{"primary":{"windowMinutes":60,"usedPercent":150.7}}}]"#;
        let report = parse(QuotaFormat::Codexbar, "x", odd).expect("reporte");
        assert_eq!(report.windows[0].used_percent, 100);

        let low = r#"[{"usage":{"primary":{"windowMinutes":60,"usedPercent":-5}}}]"#;
        let report = parse(QuotaFormat::Codexbar, "x", low).expect("reporte");
        assert_eq!(report.windows[0].used_percent, 0);
    }

    #[test]
    fn window_labels_read_naturally() {
        assert_eq!(window_label(Some(300)), "5h");
        assert_eq!(window_label(Some(1440)), "1d");
        assert_eq!(window_label(Some(10080)), "1w");
        assert_eq!(window_label(Some(45)), "45m");
        assert_eq!(window_label(None), "ventana");
    }

    #[tokio::test]
    async fn a_profile_without_quota_reads_nothing() {
        let bare = AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("perfil");
        let mut cache = QuotaCache::new();
        assert!(
            cache
                .read(&bare, PathBuf::from("/bin/true"), &BTreeMap::new(), false)
                .await
                .is_none()
        );
    }

    #[tokio::test]
    async fn a_failing_command_is_cached_as_no_data() {
        let profile = AgentProfile::parse(
            "name = \"x\"\ncommand = \"x\"\n[quota]\nsource = \"command\"\nformat = \"codexbar\"\ncommand = \"false\"\ncache_ttl_secs = 60\n",
        )
        .expect("perfil");

        let mut cache = QuotaCache::new();
        assert!(
            cache
                .read(&profile, PathBuf::from("/usr/bin/false"), &BTreeMap::new(), false)
                .await
                .is_none()
        );
        assert_eq!(cache.entries.len(), 1);
    }

    #[tokio::test]
    async fn a_command_that_prints_a_report_is_parsed() {
        let profile = AgentProfile::parse(&format!(
            "name = \"claude\"\ncommand = \"x\"\n[quota]\nsource = \"command\"\nformat = \"codexbar\"\ncommand = \"echo\"\nargs = [{:?}]\ncache_ttl_secs = 60\n",
            SAMPLE.replace('\n', "")
        ))
        .expect("perfil");

        let mut cache = QuotaCache::new();
        let report = cache
            .read(&profile, PathBuf::from("/bin/echo"), &BTreeMap::new(), false)
            .await
            .expect("reporte");
        assert_eq!(report.windows.len(), 2);
    }
}
