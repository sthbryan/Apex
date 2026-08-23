use apex_proto::{
    AgentSummary, AgentMode, Command, HistoryEntry, Isolation, Reply, SessionSummary, TerminalSize,
    WorktreeDisposal,
};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn list_agents(state: tauri::State<'_, AppState>) -> Answer<Vec<AgentSummary>> {
    match state.daemon()?.request(Command::ListAgents).await.map_err(failed)? {
        Reply::Agents { agents } => Ok(agents),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn list_sessions(state: tauri::State<'_, AppState>) -> Answer<Vec<SessionSummary>> {
    match state.daemon()?.request(Command::ListSessions).await.map_err(failed)? {
        Reply::Sessions { sessions } => Ok(sessions),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn list_history(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<HistoryEntry>> {
    match state.daemon()?.request(Command::ListHistory { project }).await.map_err(failed)? {
        Reply::History { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn resume_session(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    agent: String,
    session_id: String,
    size: TerminalSize,
) -> Answer<SessionSummary> {
    match state
        .daemon()?
        .request(Command::SessionResume { project, agent, session_id, size })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_session(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    agent: String,
    cwd: Option<String>,
    size: TerminalSize,
    isolation: Isolation,
    slug: Option<String>,
    mode: Option<AgentMode>,
) -> Answer<SessionSummary> {
    match state
        .daemon()?
        .request(Command::SessionCreate { project, agent, cwd, size, isolation, slug, mode })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn race_session(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    agents: Vec<String>,
    task: String,
    unattended: Vec<String>,
) -> Answer<Vec<SessionSummary>> {
    match state
        .daemon()?
        .request(Command::SessionRace { project, agents, task, unattended })
        .await
        .map_err(failed)?
    {
        Reply::Spawned { sessions } => Ok(sessions),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn attach_session(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<()> {
    state.daemon()?.request(Command::SessionAttach { id }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn send_input(state: tauri::State<'_, AppState>, id: Uuid, data: String) -> Answer<()> {
    state.daemon()?.request(Command::SessionInput { id, data }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn detach_session(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<()> {
    state.daemon()?.request(Command::SessionDetach { id }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn tell_session(state: tauri::State<'_, AppState>, id: Uuid, text: String) -> Answer<()> {
    state.daemon()?.request(Command::SessionTell { id, text }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn resize_session(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    size: TerminalSize,
) -> Answer<()> {
    state.daemon()?.request(Command::SessionResize { id, size }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn close_session(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    worktree: WorktreeDisposal,
) -> Answer<()> {
    state.daemon()?.request(Command::SessionClose { id, worktree }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn session_transcript(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    tail: u32,
) -> Answer<String> {
    match state
        .daemon()?
        .request(Command::SessionTranscript { id, tail, plain: false })
        .await
        .map_err(failed)?
    {
        Reply::Text { text } => Ok(text),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}
