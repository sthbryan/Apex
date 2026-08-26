use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

const OWN: &str = "settings.toml";
const WARN_AT: u8 = 50;
const COMPACT_AT: u8 = 80;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub warn_at: u8,
    pub compact_at: u8,
    pub windows: BTreeMap<String, u32>,
}

impl Default for Settings {
    fn default() -> Self {
        Self { warn_at: WARN_AT, compact_at: COMPACT_AT, windows: BTreeMap::new() }
    }
}

impl Settings {
    pub fn warns_at(&self) -> Option<u8> {
        (self.warn_at > 0 && self.warn_at <= 100).then_some(self.warn_at)
    }

    pub fn compacts_at(&self) -> Option<u8> {
        (self.compact_at > 0 && self.compact_at <= 100).then_some(self.compact_at)
    }

    pub fn window_for(&self, model: &str) -> Option<u32> {
        self.windows.get(model).copied()
    }
}

pub fn read(agent_dir: &Path) -> Settings {
    let Ok(raw) = std::fs::read_to_string(agent_dir.join(OWN)) else {
        return Settings::default();
    };
    match toml::from_str(&raw) {
        Ok(settings) => settings,
        Err(cause) => {
            tracing::warn!(%cause, "the agent settings are broken, using the usual ones");
            Settings::default()
        }
    }
}

#[cfg(test)]
#[path = "settings_tests.rs"]
mod tests;
