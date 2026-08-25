use std::path::{Path, PathBuf};

use apex_core::{ApexPaths, ShellEnvironment};

use crate::state::Answer;

const LINK_NAME: &str = "apex";

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct CliState {
    pub path: String,
    pub linked: bool,
    pub occupied: bool,
    pub on_path: bool,
}

#[tauri::command]
pub async fn cli_state() -> Answer<CliState> {
    let (link, target) = places()?;
    Ok(look(&link, &target, reachable(&link).await))
}

#[tauri::command]
pub async fn link_cli() -> Answer<CliState> {
    let (link, target) = places()?;
    plant(&link, &target)?;
    Ok(look(&link, &target, reachable(&link).await))
}

#[tauri::command]
pub async fn unlink_cli() -> Answer<CliState> {
    let (link, target) = places()?;
    pull(&link, &target)?;
    Ok(look(&link, &target, reachable(&link).await))
}

pub fn look(link: &Path, target: &Path, on_path: bool) -> CliState {
    let linked = aims_at(link, target);
    CliState {
        path: link.display().to_string(),
        linked,
        occupied: !linked && link.symlink_metadata().is_ok(),
        on_path: linked && on_path,
    }
}

pub fn plant(link: &Path, target: &Path) -> Answer<()> {
    if let Some(parent) = link.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if link.symlink_metadata().is_ok() {
        if !aims_at(link, target) {
            return Err(format!("{} is already taken", link.display()));
        }
        std::fs::remove_file(link).map_err(|error| error.to_string())?;
    }
    weave(target, link)
}

pub fn pull(link: &Path, target: &Path) -> Answer<()> {
    if aims_at(link, target) {
        std::fs::remove_file(link).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn aims_at(link: &Path, target: &Path) -> bool {
    std::fs::read_link(link).is_ok_and(|aimed| aimed == target)
}

fn places() -> Answer<(PathBuf, PathBuf)> {
    let paths = ApexPaths::discover().map_err(|error| format!("{error:#}"))?;
    let link = paths.home.join(".local").join("bin").join(LINK_NAME);
    let binary = crate::client::daemon_binary().map_err(|error| format!("{error:#}"))?;
    let target = std::fs::canonicalize(&binary).unwrap_or(binary);
    Ok((link, target))
}

async fn reachable(link: &Path) -> bool {
    ShellEnvironment::probe().await.lookup(LINK_NAME).is_some_and(|found| found == link)
}

#[cfg(unix)]
fn weave(target: &Path, link: &Path) -> Answer<()> {
    std::os::unix::fs::symlink(target, link).map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn weave(_target: &Path, _link: &Path) -> Answer<()> {
    Err("the apex command is not available on this platform yet".to_string())
}
