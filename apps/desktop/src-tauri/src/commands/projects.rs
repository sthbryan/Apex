use apex_proto::{Command, ProjectSummary, Reply};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn list_projects(state: tauri::State<'_, AppState>) -> Answer<Vec<ProjectSummary>> {
    match state.daemon()?.request(Command::ListProjects).await.map_err(failed)? {
        Reply::Projects { projects } => Ok(projects),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn open_project(state: tauri::State<'_, AppState>, root: String) -> Answer<ProjectSummary> {
    match state.daemon()?.request(Command::ProjectOpen { root }).await.map_err(failed)? {
        Reply::Project { project } => Ok(project),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn remove_project(state: tauri::State<'_, AppState>, project: Uuid) -> Answer<()> {
    state.daemon()?.request(Command::ProjectRemove { project }).await.map_err(failed)?;
    Ok(())
}
