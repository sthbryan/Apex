use std::collections::BTreeMap;
use std::path::Path;

use anyhow::{Context, Result};
use apex_proto::{AgentMode, AgentSummary};
use serde::{Deserialize, Serialize};

use crate::discovery::BinaryResolver;

const BUILTIN_PROFILES: &[(&str, &str)] = &[
    ("claude", include_str!("../../../agents/claude.toml")),
    ("codex", include_str!("../../../agents/codex.toml")),
    ("antigravity", include_str!("../../../agents/antigravity.toml")),
    ("grok", include_str!("../../../agents/grok.toml")),
    ("copilot", include_str!("../../../agents/copilot.toml")),
    ("opencode", include_str!("../../../agents/opencode.toml")),
    ("pi", include_str!("../../../agents/pi.toml")),
    ("shell", include_str!("../../../agents/shell.toml")),
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum McpDelivery {
    Flag {
        flag: String,
        #[serde(default)]
        merge_from: Option<String>,
        #[serde(default)]
        prefix: Option<String>,
        #[serde(default)]
        requires_path: Option<String>,
        #[serde(default)]
        requires_package: Option<String>,
        #[serde(default)]
        requires_package_in: Option<String>,
    },
    Project {
        path: String,
        format: McpFormat,
    },
    Overrides {
        flag: String,
        key: String,
    },
    Shared {
        path: String,
    },
}

impl McpDelivery {
    pub fn available(&self, home: &Path) -> bool {
        let Self::Flag { requires_path, requires_package, requires_package_in, .. } = self else {
            return true;
        };
        if requires_path.as_deref().is_some_and(|path| under_home(path, home).exists()) {
            return true;
        }
        if let Some(package) = requires_package.as_deref()
            && let Some(listing) = requires_package_in.as_deref()
        {
            return packages_in(&under_home(listing, home)).iter().any(|found| found == package);
        }
        requires_path.is_none()
    }
}

fn under_home(path: &str, home: &Path) -> std::path::PathBuf {
    match path.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None => std::path::PathBuf::from(path),
    }
}

fn packages_in(listing: &Path) -> Vec<String> {
    let Ok(raw) = std::fs::read(listing) else { return Vec::new() };
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&raw) else { return Vec::new() };
    let Some(entries) = value.get("packages").and_then(|found| found.as_array()) else {
        return Vec::new();
    };
    entries
        .iter()
        .filter_map(|entry| {
            entry.as_str().or_else(|| entry.get("source").and_then(|found| found.as_str()))
        })
        .map(str::to_owned)
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum McpFormat {
    Claude,
    Opencode,
    Grok,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentProfile {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub auto_args: Vec<String>,
    #[serde(default)]
    pub mode: AgentMode,
    #[serde(default = "agentic_by_default")]
    pub agentic: bool,
    #[serde(default)]
    pub acp_command: Option<String>,
    #[serde(default)]
    pub acp_args: Vec<String>,
    #[serde(default)]
    pub mcp: Option<McpDelivery>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    #[serde(default)]
    pub state_patterns: StatePatterns,
    #[serde(default)]
    pub history: Option<HistoryConfig>,
    #[serde(default)]
    pub quota: Option<QuotaConfig>,
    #[serde(default)]
    pub notify: Option<NotifyConfig>,
}

fn expand_env(raw: &str) -> String {
    let Some(rest) = raw.strip_prefix("${").and_then(|rest| rest.strip_suffix('}')) else {
        return match raw.strip_prefix('$') {
            Some(name) => std::env::var(name).unwrap_or_default(),
            None => raw.to_owned(),
        };
    };
    let (name, fallback) = match rest.split_once(":-") {
        Some((name, fallback)) => (name, fallback),
        None => (rest, ""),
    };
    match std::env::var(name) {
        Ok(value) if !value.is_empty() => value,
        _ => fallback.to_owned(),
    }
}

fn agentic_by_default() -> bool {
    true
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct NotifyConfig {
    #[serde(default)]
    pub bell: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct StatePatterns {
    #[serde(default)]
    pub blocked: Vec<String>,
    #[serde(default)]
    pub done: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HistorySource {
    Dir,
    Command,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HistoryEntries {
    #[default]
    Files,
    Dirs,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HistoryConfig {
    pub source: HistorySource,
    pub path: String,
    #[serde(default)]
    pub entries: HistoryEntries,
    #[serde(default = "default_label_key")]
    pub label_key: String,
    #[serde(default)]
    pub label_file: Option<String>,
    #[serde(default)]
    pub label_id_key: Option<String>,
    #[serde(default)]
    pub resume_args: Vec<String>,
}

fn default_label_key() -> String {
    "content".to_string()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum QuotaSource {
    Native,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuotaConfig {
    pub sources: Vec<QuotaSource>,
    #[serde(default = "default_quota_ttl")]
    pub cache_ttl_secs: u64,
}

fn default_quota_ttl() -> u64 {
    900
}

impl AgentProfile {
    pub fn parse(raw: &str) -> Result<Self> {
        toml::from_str(raw).context("invalid agent profile")
    }

    pub fn launch_command(&self) -> String {
        expand_env(&self.command)
    }

    pub fn mcp_blocked(&self, home: &Path) -> bool {
        self.mcp.as_ref().is_some_and(|delivery| !delivery.available(home))
    }

    pub fn supports_resume(&self) -> bool {
        self.history.as_ref().is_some_and(|history| !history.resume_args.is_empty())
    }

    pub fn summarize(&self, resolver: &mut BinaryResolver) -> AgentSummary {
        AgentSummary {
            name: self.name.clone(),
            command: self.launch_command(),
            resolved_path: resolver
                .resolve(&self.launch_command())
                .map(|path| path.display().to_string()),
            mode: self.mode,
            agentic: self.agentic,
            supports_resume: self.supports_resume(),
            speaks_acp: self.acp_command.is_some(),
            shares_config: matches!(self.mcp, Some(McpDelivery::Flag { merge_from: Some(_), .. })),
            mcp_blocked: false,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct ProfileSet {
    profiles: Vec<AgentProfile>,
}

impl ProfileSet {
    pub fn builtin() -> Result<Self> {
        let mut profiles = Vec::with_capacity(BUILTIN_PROFILES.len());
        for (name, raw) in BUILTIN_PROFILES {
            profiles.push(
                AgentProfile::parse(raw)
                    .with_context(|| format!("invalid builtin profile {name}"))?,
            );
        }
        Ok(Self { profiles })
    }

    pub fn load(agents_dir: &Path) -> Result<Self> {
        let mut set = Self::builtin()?;
        set.merge_dir(agents_dir)?;
        Ok(set)
    }

    pub fn merge_dir(&mut self, agents_dir: &Path) -> Result<()> {
        let Ok(entries) = std::fs::read_dir(agents_dir) else {
            return Ok(());
        };
        let mut paths: Vec<_> = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "toml"))
            .collect();
        paths.sort();

        for path in paths {
            let raw = std::fs::read_to_string(&path)
                .with_context(|| format!("reading {}", path.display()))?;
            let profile = AgentProfile::parse(&raw)
                .with_context(|| format!("invalid profile in {}", path.display()))?;
            self.upsert(profile);
        }
        Ok(())
    }

    pub fn upsert(&mut self, profile: AgentProfile) {
        match self.profiles.iter_mut().find(|existing| existing.name == profile.name) {
            Some(existing) => *existing = profile,
            None => self.profiles.push(profile),
        }
    }

    pub fn get(&self, name: &str) -> Option<&AgentProfile> {
        self.profiles.iter().find(|profile| profile.name == name)
    }

    pub fn iter(&self) -> impl Iterator<Item = &AgentProfile> {
        self.profiles.iter()
    }

    pub fn len(&self) -> usize {
        self.profiles.len()
    }

    pub fn is_empty(&self) -> bool {
        self.profiles.is_empty()
    }

    pub fn summarize(&self, resolver: &mut BinaryResolver) -> Vec<AgentSummary> {
        self.profiles.iter().map(|profile| profile.summarize(resolver)).collect()
    }
}

#[cfg(test)]
#[path = "profile_tests.rs"]
mod tests;
