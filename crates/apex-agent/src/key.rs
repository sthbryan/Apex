use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use apex_core::ApexPaths;

use crate::provider::Provider;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Stored,
    Environment,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Kept {
    pub key: String,
    pub from: Source,
}

pub fn keep(provider: &str, key: &str) -> Result<()> {
    keep_at(&store_path()?, provider, key)
}

pub fn forget(provider: &str) -> Result<()> {
    forget_at(&store_path()?, provider)
}

pub fn find(provider: &Provider) -> Result<Option<Kept>> {
    find_at(&store_path()?, provider)
}

fn store_path() -> Result<PathBuf> {
    Ok(ApexPaths::discover()?.agent_dir().join("keys.json"))
}

fn keep_at(path: &Path, provider: &str, key: &str) -> Result<()> {
    if key.trim().is_empty() {
        bail!("there is no key to keep")
    }
    let mut keys = read(path)?;
    keys.insert(provider.to_owned(), key.to_owned());
    write(path, &keys)
}

fn forget_at(path: &Path, provider: &str) -> Result<()> {
    let mut keys = read(path)?;
    if keys.remove(provider).is_some() {
        write(path, &keys)?;
    }
    Ok(())
}

fn find_at(path: &Path, provider: &Provider) -> Result<Option<Kept>> {
    if let Some(key) = read(path)?.remove(&provider.name) {
        return Ok(Some(Kept { key, from: Source::Stored }));
    }
    Ok(provider.key_from_env().map(|key| Kept { key, from: Source::Environment }))
}

fn read(path: &Path) -> Result<BTreeMap<String, String>> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Ok(BTreeMap::new());
    };
    serde_json::from_str(&text).with_context(|| format!("reading {}", path.display()))
}

fn write(path: &Path, keys: &BTreeMap<String, String>) -> Result<()> {
    let parent = path.parent().context("the key store has no parent directory")?;
    std::fs::create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, serde_json::to_vec(keys)?)
        .with_context(|| format!("writing {}", temporary.display()))?;
    private(&temporary)?;
    std::fs::rename(&temporary, path).with_context(|| format!("saving {}", path.display()))
}

#[cfg(unix)]
fn private(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn private(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
#[path = "key_tests.rs"]
mod tests;
