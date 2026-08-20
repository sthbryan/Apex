use apex_proto::{Command, ContextEntry, Reply};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn context_list(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<ContextEntry>> {
    match state.daemon()?.request(Command::ContextList { project }).await.map_err(failed)? {
        Reply::Context { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn context_read(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    key: String,
) -> Answer<String> {
    match state.daemon()?.request(Command::ContextRead { project, key }).await.map_err(failed)? {
        Reply::Text { text } => Ok(text),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn context_write(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    key: String,
    contents: String,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::ContextWrite { project, key, contents })
        .await
        .map_err(failed)?;
    Ok(())
}
