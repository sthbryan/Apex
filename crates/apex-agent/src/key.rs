use anyhow::Result;
use apex_core::keychain;

use crate::provider::Provider;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Keychain,
    Environment,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Kept {
    pub key: String,
    pub from: Source,
}

pub fn keep(provider: &str, key: &str) -> Result<()> {
    keychain::remember(&account(provider), key)
}

pub fn forget(provider: &str) -> Result<()> {
    keychain::forget(&account(provider))
}

pub fn find(provider: &Provider) -> Result<Option<Kept>> {
    if let Some(key) = provider.key_from_env() {
        return Ok(Some(Kept { key, from: Source::Environment }));
    }
    let kept = keychain::recall(&account(&provider.name))?;
    Ok(kept.map(|key| Kept { key, from: Source::Keychain }))
}

fn account(provider: &str) -> String {
    format!("provider:{provider}")
}

#[cfg(test)]
#[path = "key_tests.rs"]
mod tests;
