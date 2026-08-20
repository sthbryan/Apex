use apex_proto::{Command, MetricsSnapshot, Reply};

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn read_metrics(
    state: tauri::State<'_, AppState>,
    refresh_quota: bool,
) -> Answer<MetricsSnapshot> {
    match state.daemon()?.request(Command::ReadMetrics { refresh_quota }).await.map_err(failed)? {
        Reply::Metrics { snapshot } => Ok(snapshot),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn kill_process(state: tauri::State<'_, AppState>, pid: u32) -> Answer<()> {
    state.daemon()?.request(Command::KillProcess { pid }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn set_idle_grace(state: tauri::State<'_, AppState>, seconds: u32) -> Answer<()> {
    let daemon = state.daemon.lock().map_err(|e| e.to_string())?.clone();
    if let Some(daemon) = daemon {
        let _ = daemon.request(Command::SetIdleGrace { seconds }).await;
    }
    Ok(())
}
