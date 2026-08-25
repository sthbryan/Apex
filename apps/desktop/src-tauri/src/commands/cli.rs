use std::path::PathBuf;

use apex_core::{ApexPaths, ShellEnvironment};

use crate::state::Answer;

const LINK_NAME: &str = "apex";

#[derive(serde::Serialize)]
pub struct CliState {
    pub path: String,
    pub linked: bool,
    pub occupied: bool,
    pub on_path: bool,
}

#[tauri::command]
pub async fn cli_state() -> Answer<CliState> {
    read_state().await
}

#[tauri::command]
pub async fn link_cli() -> Answer<CliState> {
    let link = link_path()?;
    let target = daemon_target()?;

    if let Some(parent) = link.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if link.symlink_metadata().is_ok() {
        if !points_at_us(&link, &target) {
            return Err(format!("{} is already taken", link.display()));
        }
        std::fs::remove_file(&link).map_err(|error| error.to_string())?;
    }
    plant(&target, &link)?;
    read_state().await
}

#[tauri::command]
pub async fn unlink_cli() -> Answer<CliState> {
    let link = link_path()?;
    let target = daemon_target()?;

    if link.symlink_metadata().is_ok() && points_at_us(&link, &target) {
        std::fs::remove_file(&link).map_err(|error| error.to_string())?;
    }
    read_state().await
}

async fn read_state() -> Answer<CliState> {
    let link = link_path()?;
    let target = daemon_target()?;
    let linked = points_at_us(&link, &target);
    let occupied = !linked && link.symlink_metadata().is_ok();
    let on_path = linked && ShellEnvironment::probe().await.lookup(LINK_NAME) == Some(link.clone());

    Ok(CliState { path: link.display().to_string(), linked, occupied, on_path })
}

fn link_path() -> Answer<PathBuf> {
    let paths = ApexPaths::discover().map_err(|error| format!("{error:#}"))?;
    Ok(paths.home.join(".local").join("bin").join(LINK_NAME))
}

fn daemon_target() -> Answer<PathBuf> {
    let binary = crate::client::daemon_binary().map_err(|error| format!("{error:#}"))?;
    Ok(std::fs::canonicalize(&binary).unwrap_or(binary))
}

fn points_at_us(link: &std::path::Path, target: &std::path::Path) -> bool {
    std::fs::read_link(link).is_ok_and(|aimed| aimed == target)
}

#[cfg(unix)]
fn plant(target: &std::path::Path, link: &std::path::Path) -> Answer<()> {
    std::os::unix::fs::symlink(target, link).map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn plant(_target: &std::path::Path, _link: &std::path::Path) -> Answer<()> {
    Err("the apex command is not available on this platform yet".to_string())
}
