use apex_proto::{Command, Reply};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn save_layout(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    payload: String,
) -> Answer<()> {
    state.daemon()?.request(Command::LayoutSave { project, payload }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn load_layout(state: tauri::State<'_, AppState>, project: Uuid) -> Answer<Option<String>> {
    match state.daemon()?.request(Command::LayoutLoad { project }).await.map_err(failed)? {
        Reply::Layout { payload } => Ok(payload),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}
