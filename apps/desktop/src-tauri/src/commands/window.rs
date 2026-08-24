use tauri::Manager;

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

pub async fn halt<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    let daemon = app.try_state::<AppState>().and_then(|state| state.daemon().ok());
    if let Some(client) = daemon {
        let _ = client.request(apex_proto::Command::DaemonShutdown).await;
    }
    app.exit(0);
}

#[tauri::command]
pub async fn stop_daemon(app: tauri::AppHandle) -> Answer<()> {
    halt(app).await;
    Ok(())
}

#[tauri::command]
pub fn set_keep_alive(state: tauri::State<'_, AppState>, keep: bool) {
    state.keep_alive.store(keep, std::sync::atomic::Ordering::Relaxed);
}

#[tauri::command]
pub fn self_updating() -> bool {
    if cfg!(target_os = "linux") {
        return std::env::var_os("APPIMAGE").is_some();
    }
    true
}

#[cfg(target_os = "macos")]
fn material_of(frost: &str) -> Option<window_vibrancy::NSVisualEffectMaterial> {
    use window_vibrancy::NSVisualEffectMaterial::{
        FullScreenUI, HudWindow, Sidebar, UnderWindowBackground,
    };
    match frost {
        "soft" => Some(Sidebar),
        "glare" => Some(HudWindow),
        "bright" => Some(FullScreenUI),
        "deep" => Some(UnderWindowBackground),
        _ => None,
    }
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub fn set_window_material(window: tauri::Window, frost: String) -> Answer<()> {
    #[cfg(target_os = "macos")]
    {
        window_vibrancy::clear_vibrancy(&window).map_err(|error| error.to_string())?;
        if let Some(effect) = material_of(&frost) {
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
pub fn set_badge(window: tauri::Window, count: u32) -> Answer<()> {
    let value = (count > 0).then_some(i64::from(count));
    window.set_badge_count(value).map_err(|error| error.to_string())
}
