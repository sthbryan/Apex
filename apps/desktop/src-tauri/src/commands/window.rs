use crate::state::{Answer, AppState};

#[cfg(target_os = "macos")]
const WINDOW_RADIUS: f64 = 10.0;

#[tauri::command]
pub async fn daemon_version(state: tauri::State<'_, AppState>) -> Answer<String> {
    let daemon = state.connect().await?;
    Ok(daemon.daemon_version().to_string())
}

#[tauri::command]
pub fn host_platform() -> &'static str {
    std::env::consts::OS
}

#[cfg(target_os = "macos")]
fn material_of(level: u8) -> Option<window_vibrancy::NSVisualEffectMaterial> {
    use window_vibrancy::NSVisualEffectMaterial::{FullScreenUI, HudWindow, Sidebar, UnderWindowBackground};
    match level {
        1 => Some(Sidebar),
        2 => Some(HudWindow),
        3 => Some(FullScreenUI),
        4 => Some(UnderWindowBackground),
        _ => None,
    }
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn set_window_material(window: tauri::WebviewWindow, blur: u8) -> Answer<()> {
    #[cfg(target_os = "macos")]
    {
        window_vibrancy::clear_vibrancy(&window).map_err(|error| error.to_string())?;
        if let Some(effect) = material_of(blur) {
            window_vibrancy::apply_vibrancy(
                &window,
                effect,
                Some(window_vibrancy::NSVisualEffectState::Active),
                Some(WINDOW_RADIUS),
            )
            .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_badge(window: tauri::WebviewWindow, count: u32) -> Answer<()> {
    let value = (count > 0).then_some(i64::from(count));
    window.set_badge_count(value).map_err(|error| error.to_string())
}
