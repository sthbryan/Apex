use apex_proto::{Command, Reply, SessionSummary, TaskSummary, TerminalSize};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn list_tasks(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<TaskSummary>> {
    match state.daemon()?.request(Command::ListTasks { project }).await.map_err(failed)? {
        Reply::Tasks { tasks } => Ok(tasks),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn run_task(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    task: String,
    command: String,
    size: TerminalSize,
) -> Answer<SessionSummary> {
    match state
        .daemon()?
        .request(Command::TaskRun { project, task, command, size })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}
