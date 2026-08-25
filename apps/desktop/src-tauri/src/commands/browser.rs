use tauri::Manager;

use crate::state::Answer;

pub const PROBE: &str = include_str!("probe.js");
const HOST: &str = "main";

#[derive(serde::Deserialize, Clone, Copy)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[tauri::command]
pub async fn browser_shot(
    app: tauri::AppHandle,
    label: String,
    bounds: Option<Bounds>,
) -> Answer<String> {
    let window = app.get_webview_window(HOST).ok_or("no main window")?;
    let dir = apex_core::ApexPaths::discover().map_err(|error| error.to_string())?.shots_dir();
    apex_core::prune_shots(&dir);
    let at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?;
    let path = dir.join(format!("{label}-{}.png", at.as_millis()));
    crate::commands::shot::take(window, bounds, path.clone()).await?;
    Ok(path.to_string_lossy().into_owned())
}
