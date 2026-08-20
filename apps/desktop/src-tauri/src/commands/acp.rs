use apex_proto::{AcpSnapshot, Command, Reply};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn acp_transcript(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<AcpSnapshot> {
    match state.daemon()?.request(Command::AcpTranscript { id }).await.map_err(failed)? {
        Reply::Acp { snapshot } => Ok(snapshot),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn acp_prompt(state: tauri::State<'_, AppState>, id: Uuid, text: String) -> Answer<()> {
    state.daemon()?.request(Command::AcpPrompt { id, text }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn acp_cancel(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<()> {
    state.daemon()?.request(Command::AcpCancel { id }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn acp_decide(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    request: u32,
    option: Option<String>,
) -> Answer<()> {
    state.daemon()?.request(Command::AcpDecide { id, request, option }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn acp_choose(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    model: Option<String>,
    mode: Option<String>,
) -> Answer<()> {
    state.daemon()?.request(Command::AcpChoose { id, model, mode }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn mcp_adopt(
    state: tauri::State<'_, AppState>,
    agent: String,
    enabled: bool,
) -> Answer<String> {
    match state.daemon()?.request(Command::McpAdopt { agent, enabled }).await.map_err(failed)? {
        Reply::Text { text } => Ok(text),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}
