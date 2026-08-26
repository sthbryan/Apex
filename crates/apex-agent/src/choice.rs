use std::path::Path;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

const LAST: &str = "last.toml";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Choice {
    pub provider: String,
    pub model: String,
}

pub fn read(agent_dir: &Path) -> Option<Choice> {
    let raw = std::fs::read_to_string(agent_dir.join(LAST)).ok()?;
    let choice: Choice = toml::from_str(&raw).ok()?;
    match choice.provider.trim().is_empty() || choice.model.trim().is_empty() {
        true => None,
        false => Some(choice),
    }
}

pub fn write(agent_dir: &Path, choice: &Choice) -> Result<()> {
    std::fs::create_dir_all(agent_dir)
        .with_context(|| format!("making {}", agent_dir.display()))?;
    let raw = toml::to_string(choice)?;
    std::fs::write(agent_dir.join(LAST), raw)
        .with_context(|| format!("writing {}", agent_dir.join(LAST).display()))
}

#[cfg(test)]
#[path = "choice_tests.rs"]
mod tests;
