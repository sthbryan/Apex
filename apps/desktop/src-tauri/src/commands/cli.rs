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

#[derive(Debug, PartialEq, Eq)]
pub struct Spot {
    pub link: PathBuf,
    pub target: PathBuf,
    pub copied_from: Option<PathBuf>,
}

#[tauri::command]
pub async fn cli_state() -> Answer<CliState> {
    let spot = spot()?;
    Ok(look(&spot, reachable(&spot.link).await))
}

#[tauri::command]
pub async fn link_cli() -> Answer<CliState> {
    let spot = spot()?;
    plant(&spot)?;
    Ok(look(&spot, reachable(&spot.link).await))
}

#[tauri::command]
pub async fn unlink_cli() -> Answer<CliState> {
    let spot = spot()?;
    pull(&spot)?;
    Ok(look(&spot, reachable(&spot.link).await))
}

#[tauri::command]
pub fn refresh_cli() -> Answer<()> {
    let spot = spot()?;
    if aims_at(&spot.link, &spot.target) {
        stock(&spot)?;
    }
    Ok(())
}

pub fn plan(home: &Path, binary: &Path, ephemeral: bool) -> Spot {
    let link = home.join(".local").join("bin").join(LINK_NAME);
    if ephemeral {
        return Spot {
            link,
            target: home.join(".local").join("share").join("apex").join("apexd"),
            copied_from: Some(binary.to_path_buf()),
        };
    }
    Spot { link, target: binary.to_path_buf(), copied_from: None }
}

pub fn look(spot: &Spot, on_path: bool) -> CliState {
    let linked = aims_at(&spot.link, &spot.target);
    CliState {
        path: spot.link.display().to_string(),
        linked,
        occupied: !linked && spot.link.symlink_metadata().is_ok(),
        on_path: linked && on_path,
    }
}

pub fn plant(spot: &Spot) -> Answer<()> {
    if let Some(parent) = spot.link.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if spot.link.symlink_metadata().is_ok() {
        if !aims_at(&spot.link, &spot.target) {
            return Err(format!("{} is already taken", spot.link.display()));
        }
        std::fs::remove_file(&spot.link).map_err(|error| error.to_string())?;
    }
    stock(spot)?;
    weave(&spot.target, &spot.link)
}

pub fn pull(spot: &Spot) -> Answer<()> {
    if !aims_at(&spot.link, &spot.target) {
        return Ok(());
    }
    std::fs::remove_file(&spot.link).map_err(|error| error.to_string())?;
    if spot.copied_from.is_some() && spot.target.is_file() {
        std::fs::remove_file(&spot.target).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn stock(spot: &Spot) -> Answer<()> {
    let Some(source) = &spot.copied_from else {
        return Ok(());
    };
    if fresh(source, &spot.target) {
        return Ok(());
    }
    if let Some(parent) = spot.target.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::copy(source, &spot.target).map_err(|error| error.to_string())?;
    mark_runnable(&spot.target)
}

fn fresh(source: &Path, target: &Path) -> bool {
    let Ok(from) = source.metadata() else {
        return false;
    };
    let Ok(to) = target.metadata() else {
        return false;
    };
    from.len() == to.len() && from.modified().ok() == to.modified().ok()
}

fn aims_at(link: &Path, target: &Path) -> bool {
    std::fs::read_link(link).is_ok_and(|aimed| aimed == target)
}

fn spot() -> Answer<Spot> {
    let paths = ApexPaths::discover().map_err(|error| format!("{error:#}"))?;
    let binary = crate::client::daemon_binary().map_err(|error| format!("{error:#}"))?;
    let binary = std::fs::canonicalize(&binary).unwrap_or(binary);
    Ok(plan(&paths.home, &binary, std::env::var_os("APPIMAGE").is_some()))
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

#[cfg(unix)]
fn mark_runnable(path: &Path) -> Answer<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
        .map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn mark_runnable(_path: &Path) -> Answer<()> {
    Ok(())
}
