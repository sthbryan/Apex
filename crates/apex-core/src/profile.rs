use std::collections::BTreeMap;
use std::path::Path;

use anyhow::{Context, Result};
use apex_proto::{AgentMode, AgentSummary};
use serde::{Deserialize, Serialize};

use crate::discovery::BinaryResolver;

const BUILTIN_PROFILES: &[(&str, &str)] = &[
    ("claude", include_str!("../../../agents/claude.toml")),
    ("codex", include_str!("../../../agents/codex.toml")),
    ("gemini", include_str!("../../../agents/gemini.toml")),
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
    },
    Project { path: String, format: McpFormat },
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
    pub mode: AgentMode,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotaSource {
    Command,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotaFormat {
    Codexbar,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuotaConfig {
    pub source: QuotaSource,
    pub format: QuotaFormat,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
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

    pub fn supports_resume(&self) -> bool {
        self.history.as_ref().is_some_and(|history| !history.resume_args.is_empty())
    }

    pub fn summarize(&self, resolver: &mut BinaryResolver) -> AgentSummary {
        AgentSummary {
            name: self.name.clone(),
            command: self.command.clone(),
            resolved_path: resolver
                .resolve(&self.command)
                .map(|path| path.display().to_string()),
            mode: self.mode,
            supports_resume: self.supports_resume(),
            speaks_acp: self.acp_command.is_some(),
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
