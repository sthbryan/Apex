use std::collections::BTreeMap;
use std::path::Path;

use anyhow::{Context, Result, bail};
use rig_core::providers::{anthropic, gemini, openai};
use serde::{Deserialize, Serialize};

const BUILTIN: &str = include_str!("../providers.toml");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    Openai,
    Compatible,
    Anthropic,
    Gemini,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Provider {
    pub name: String,
    pub label: String,
    pub kind: ProviderKind,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub env: Option<String>,
    #[serde(default)]
    pub keyless: bool,
}

#[derive(Deserialize)]
struct Listing {
    provider: Vec<Provider>,
}

pub enum Wire {
    Openai(openai::Client),
    Compatible(openai::CompletionsClient),
    Anthropic(anthropic::Client),
    Gemini(gemini::Client),
}

macro_rules! dial {
    ($client:ty, $key:expr, $url:expr) => {{
        let builder = <$client>::builder().api_key($key);
        match $url {
            Some(url) => builder.base_url(url).build(),
            None => builder.build(),
        }?
    }};
}

impl Provider {
    pub fn parse(raw: &str) -> Result<Self> {
        let provider: Self = toml::from_str(raw)?;
        provider.check()?;
        Ok(provider)
    }

    pub fn check(&self) -> Result<()> {
        if self.name.trim().is_empty() {
            bail!("a provider needs a name")
        }
        if self.kind == ProviderKind::Compatible && self.base_url.is_none() {
            bail!("{} is openai compatible, so it needs a base_url", self.name)
        }
        Ok(())
    }

    pub fn key_from_env(&self) -> Option<String> {
        let name = self.env.as_deref()?;
        usable(std::env::var(name).ok())
    }

    pub fn dial(&self, key: &str) -> Result<Wire> {
        if key.trim().is_empty() && !self.keyless {
            bail!("{} has no key yet", self.name)
        }
        let url = self.base_url.as_deref();
        Ok(match self.kind {
            ProviderKind::Openai => Wire::Openai(dial!(openai::Client, key, url)),
            ProviderKind::Compatible => {
                Wire::Compatible(dial!(openai::CompletionsClient, key, url))
            }
            ProviderKind::Anthropic => Wire::Anthropic(dial!(anthropic::Client, key, url)),
            ProviderKind::Gemini => Wire::Gemini(dial!(gemini::Client, key, url)),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderSet {
    known: BTreeMap<String, Provider>,
}

impl ProviderSet {
    pub fn builtin() -> Result<Self> {
        let listing: Listing =
            toml::from_str(BUILTIN).context("the builtin provider list is broken")?;
        let mut known = BTreeMap::new();
        for provider in listing.provider {
            provider.check().context("the builtin provider list is broken")?;
            known.insert(provider.name.clone(), provider);
        }
        Ok(Self { known })
    }

    pub fn load(providers_dir: &Path) -> Result<Self> {
        let mut set = Self::builtin()?;
        set.merge_dir(providers_dir)?;
        Ok(set)
    }

    pub fn merge_dir(&mut self, providers_dir: &Path) -> Result<()> {
        let Ok(entries) = std::fs::read_dir(providers_dir) else {
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
            let provider = Provider::parse(&raw)
                .with_context(|| format!("invalid provider in {}", path.display()))?;
            self.upsert(provider);
        }
        Ok(())
    }

    pub fn upsert(&mut self, provider: Provider) {
        self.known.insert(provider.name.clone(), provider);
    }

    pub fn get(&self, name: &str) -> Option<&Provider> {
        self.known.get(name)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Provider> {
        self.known.values()
    }

    pub fn len(&self) -> usize {
        self.known.len()
    }

    pub fn is_empty(&self) -> bool {
        self.known.is_empty()
    }
}

fn usable(key: Option<String>) -> Option<String> {
    key.filter(|key| !key.trim().is_empty())
}

#[cfg(test)]
#[path = "provider_tests.rs"]
mod tests;
