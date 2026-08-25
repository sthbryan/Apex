use apex_proto::{ApiRequest, ApiRun, Command, Reply};
use serde::Serialize;
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[derive(Serialize)]
pub struct Collection {
    requests: Vec<String>,
    environments: Vec<String>,
}

#[derive(Serialize)]
pub struct Saved {
    request: ApiRequest,
    last: Option<ApiRun>,
}

#[tauri::command]
pub async fn api_list(state: tauri::State<'_, AppState>, project: Uuid) -> Answer<Collection> {
    match state.daemon()?.request(Command::ApiList { project }).await.map_err(failed)? {
        Reply::ApiCollection { requests, environments } => {
            Ok(Collection { requests, environments })
        }
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn api_read(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    name: String,
) -> Answer<Saved> {
    match state.daemon()?.request(Command::ApiRead { project, name }).await.map_err(failed)? {
        Reply::ApiRequest { request, last } => Ok(Saved { request, last }),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn api_write(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    name: String,
    request: ApiRequest,
) -> Answer<()> {
    state.daemon()?.request(Command::ApiWrite { project, name, request }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn api_remove(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    name: String,
) -> Answer<()> {
    state.daemon()?.request(Command::ApiRemove { project, name }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn api_send(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    name: String,
    environment: Option<String>,
) -> Answer<ApiRun> {
    match state
        .daemon()?
        .request(Command::ApiSend { project, name, environment })
        .await
        .map_err(failed)?
    {
        Reply::ApiRun { run } => Ok(run),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}
