use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use apex_core::{ApexPaths, McpDelivery, McpFormat};
use uuid::Uuid;

pub fn offer(
    session: Uuid,
    delivery: &McpDelivery,
    cwd: &Path,
    isolated: bool,
    paths: &ApexPaths,
) -> Result<Option<Vec<String>>> {
    let binary = locate()?;
    let launcher = binary.display().to_string();

    match delivery {
        McpDelivery::Flag { flag, merge_from, prefix, requires_path } => {
            if let Some(required) = requires_path.as_deref()
                && !expand_home(required, &paths.home).exists()
            {
                return Ok(None);
            }
            let dir = paths.mcp_dir();
            std::fs::create_dir_all(&dir).with_context(|| format!("creating {}", dir.display()))?;
            let args = vec!["mcp".to_owned(), "--session".to_owned(), session.to_string()];
            let path = dir.join(format!("{session}.json"));
            let existing = merge_from
                .as_deref()
                .map(|source| expand_home(source, &paths.home))
                .and_then(|source| std::fs::read(source).ok())
                .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok());

            std::fs::write(&path, render(McpFormat::Claude, &launcher, &args, existing)?)
                .with_context(|| format!("writing {}", path.display()))?;
            let value = format!("{}{}", prefix.as_deref().unwrap_or_default(), path.display());
            Ok(Some(vec![flag.clone(), value]))
        }
        McpDelivery::Overrides { flag, key } => {
            let args = vec!["mcp".to_owned(), "--session".to_owned(), session.to_string()];
            Ok(Some(vec![
                flag.clone(),
                format!("{key}.command={}", serde_json::to_string(&launcher)?),
                flag.clone(),
                format!("{key}.args={}", serde_json::to_string(&args)?),
            ]))
        }
        McpDelivery::Shared { path } => {
            let target = expand_home(path, &paths.home);
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("creating {}", parent.display()))?;
            }
            let existing = std::fs::read(&target)
                .ok()
                .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok());
            let args = vec!["mcp".to_owned()];
            std::fs::write(&target, render(McpFormat::Claude, &launcher, &args, existing)?)
                .with_context(|| format!("writing {}", target.display()))?;
            Ok(None)
        }
        McpDelivery::Project { path, format } => {
            let args = vec!["mcp".to_owned()];
            let target = cwd.join(path);
            if target.exists() && !isolated {
                tracing::info!(
                    target = %target.display(),
                    "left the existing config alone, so this agent gets no MCP"
                );
                return Ok(None);
            }
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("creating {}", parent.display()))?;
            }
            std::fs::write(&target, render(*format, &launcher, &args, None)?)
                .with_context(|| format!("writing {}", target.display()))?;
            if !isolated {
                let _ = apex_git::exclude(cwd, path);
            }
            Ok(None)
        }
    }
}

pub fn withdraw(delivery: &McpDelivery, home: &Path) -> Result<()> {
    let McpDelivery::Shared { path } = delivery else {
        return Ok(());
    };
    let target = expand_home(path, home);
    let Some(mut config) = std::fs::read(&target)
        .ok()
        .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok())
    else {
        return Ok(());
    };
    let Some(servers) = config.get_mut("mcpServers").and_then(|servers| servers.as_object_mut())
    else {
        return Ok(());
    };
    if servers.remove("apex").is_none() {
        return Ok(());
    }
    std::fs::write(&target, serde_json::to_string_pretty(&config)?)
        .with_context(|| format!("writing {}", target.display()))
}

pub fn launcher() -> Result<String> {
    Ok(locate()?.display().to_string())
}

pub fn adopt(delivery: &McpDelivery, home: &Path, wanted: bool) -> Result<PathBuf> {
    let McpDelivery::Flag { merge_from: Some(source), .. } = delivery else {
        anyhow::bail!("this agent has no config of its own to share")
    };
    let path = expand_home(source, home);
    let existing = std::fs::read(&path)
        .ok()
        .and_then(|raw| serde_json::from_slice::<serde_json::Value>(&raw).ok());

    if path.exists() {
        let backup = path.with_extension("apex-backup");
        if !backup.exists() {
            std::fs::copy(&path, &backup)
                .with_context(|| format!("backing up {}", path.display()))?;
        }
    }

    let mut servers = existing
        .and_then(|config| config.get("mcpServers").cloned())
        .and_then(|servers| servers.as_object().cloned())
        .unwrap_or_default();

    if wanted {
        let launcher = locate()?.display().to_string();
        servers
            .insert("apex".to_owned(), serde_json::json!({ "command": launcher, "args": ["mcp"] }));
    } else {
        servers.remove("apex");
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    let body = serde_json::to_string_pretty(&serde_json::json!({ "mcpServers": servers }))?;
    std::fs::write(&path, body).with_context(|| format!("writing {}", path.display()))?;
    Ok(path)
}

fn locate() -> Result<PathBuf> {
    if let Some(path) = std::env::var_os("CARGO_BIN_EXE_apexd") {
        return Ok(PathBuf::from(path));
    }
    std::env::current_exe().context("locating apexd")
}

fn render(
    format: McpFormat,
    launcher: &str,
    args: &[String],
    existing: Option<serde_json::Value>,
) -> Result<String> {
    Ok(match format {
        McpFormat::Claude => {
            let ours = serde_json::json!({ "command": launcher, "args": args });
            let mut servers = existing
                .and_then(|config| config.get("mcpServers").cloned())
                .and_then(|servers| servers.as_object().cloned())
                .unwrap_or_default();
            servers.insert("apex".to_owned(), ours);
            serde_json::to_string_pretty(&serde_json::json!({ "mcpServers": servers }))?
        }
        McpFormat::Opencode => serde_json::to_string_pretty(&serde_json::json!({
            "$schema": "https://opencode.ai/config.json",
            "mcp": {
                "apex": {
                    "type": "local",
                    "command": std::iter::once(launcher.to_owned())
                        .chain(args.iter().cloned())
                        .collect::<Vec<_>>(),
                    "enabled": true,
                }
            }
        }))?,
        McpFormat::Grok => format!(
            "[mcp_servers.apex]\ncommand = {}\nargs = {}\nenabled = true\n",
            serde_json::to_string(launcher)?,
            serde_json::to_string(args)?
        ),
    })
}

pub fn expand_home(path: &str, home: &Path) -> PathBuf {
    match path.strip_prefix("~/") {
        Some(rest) => home.join(rest),
        None => PathBuf::from(path),
    }
}
