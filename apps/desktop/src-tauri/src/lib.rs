mod client;

use std::sync::Arc;

use apex_core::ApexPaths;
use apex_proto::{
    AgentSummary, Command, Event, FileContents, FileEntry, HistoryEntry, MetricsSnapshot,
    ProjectSummary, Reply, SessionSummary, TerminalSize,
};
use client::DaemonClient;
use tauri::Manager;
use tauri::ipc::{Channel, InvokeResponseBody};
use uuid::Uuid;

struct AppState {
    daemon: Arc<DaemonClient>,
}

type Answer<T> = Result<T, String>;

fn failed(error: anyhow::Error) -> String {
    format!("{error:#}")
}

#[tauri::command]
fn daemon_version(state: tauri::State<'_, AppState>) -> String {
    state.daemon.daemon_version().to_string()
}

#[tauri::command]
fn host_platform() -> &'static str {
    std::env::consts::OS
}

#[tauri::command]
fn set_badge(window: tauri::WebviewWindow, count: u32) -> Answer<()> {
    let value = (count > 0).then_some(i64::from(count));
    window.set_badge_count(value).map_err(|error| error.to_string())
}

#[tauri::command]
async fn subscribe_output(
    state: tauri::State<'_, AppState>,
    channel: Channel<InvokeResponseBody>,
) -> Answer<()> {
    state.daemon.set_output_channel(channel).await;
    Ok(())
}

#[tauri::command]
async fn subscribe_events(
    state: tauri::State<'_, AppState>,
    channel: Channel<Event>,
) -> Answer<()> {
    state.daemon.set_event_channel(channel).await;
    Ok(())
}

#[tauri::command]
async fn list_agents(state: tauri::State<'_, AppState>) -> Answer<Vec<AgentSummary>> {
    match state.daemon.request(Command::ListAgents).await.map_err(failed)? {
        Reply::Agents { agents } => Ok(agents),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_sessions(state: tauri::State<'_, AppState>) -> Answer<Vec<SessionSummary>> {
    match state.daemon.request(Command::ListSessions).await.map_err(failed)? {
        Reply::Sessions { sessions } => Ok(sessions),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_projects(state: tauri::State<'_, AppState>) -> Answer<Vec<ProjectSummary>> {
    match state.daemon.request(Command::ListProjects).await.map_err(failed)? {
        Reply::Projects { projects } => Ok(projects),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn open_project(state: tauri::State<'_, AppState>, root: String) -> Answer<ProjectSummary> {
    match state.daemon.request(Command::ProjectOpen { root }).await.map_err(failed)? {
        Reply::Project { project } => Ok(project),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn save_layout(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    payload: String,
) -> Answer<()> {
    state.daemon.request(Command::LayoutSave { project, payload }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn load_layout(state: tauri::State<'_, AppState>, project: Uuid) -> Answer<Option<String>> {
    match state.daemon.request(Command::LayoutLoad { project }).await.map_err(failed)? {
        Reply::Layout { payload } => Ok(payload),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn read_metrics(
    state: tauri::State<'_, AppState>,
    refresh_quota: bool,
) -> Answer<MetricsSnapshot> {
    match state.daemon.request(Command::ReadMetrics { refresh_quota }).await.map_err(failed)? {
        Reply::Metrics { snapshot } => Ok(snapshot),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn kill_process(state: tauri::State<'_, AppState>, pid: u32) -> Answer<()> {
    state.daemon.request(Command::KillProcess { pid }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn list_history(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<HistoryEntry>> {
    match state.daemon.request(Command::ListHistory { project }).await.map_err(failed)? {
        Reply::History { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_directory(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
) -> Answer<Vec<FileEntry>> {
    match state.daemon.request(Command::DirList { project, path }).await.map_err(failed)? {
        Reply::Directory { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn read_file(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
) -> Answer<FileContents> {
    match state.daemon.request(Command::FileRead { project, path }).await.map_err(failed)? {
        Reply::File { contents } => Ok(contents),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn search_files(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    query: String,
    limit: u32,
) -> Answer<Vec<FileEntry>> {
    match state.daemon.request(Command::FileSearch { project, query, limit }).await.map_err(failed)?
    {
        Reply::Directory { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn resume_session(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    agent: String,
    session_id: String,
    size: TerminalSize,
) -> Answer<SessionSummary> {
    match state
        .daemon
        .request(Command::SessionResume { project, agent, session_id, size })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn create_session(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    agent: String,
    cwd: Option<String>,
    size: TerminalSize,
) -> Answer<SessionSummary> {
    match state
        .daemon
        .request(Command::SessionCreate { project, agent, cwd, size })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn attach_session(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<()> {
    state.daemon.request(Command::SessionAttach { id }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn send_input(state: tauri::State<'_, AppState>, id: Uuid, data: String) -> Answer<()> {
    state.daemon.request(Command::SessionInput { id, data }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn resize_session(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    size: TerminalSize,
) -> Answer<()> {
    state.daemon.request(Command::SessionResize { id, size }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn close_session(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<()> {
    state.daemon.request(Command::SessionClose { id }).await.map_err(failed)?;
    Ok(())
}

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "apex_desktop_lib=info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let paths = ApexPaths::discover()?;
            let daemon = tauri::async_runtime::block_on(DaemonClient::attach(&paths.socket))?;
            app.manage(AppState { daemon });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            daemon_version,
            host_platform,
            set_badge,
            subscribe_output,
            subscribe_events,
            list_agents,
            list_sessions,
            list_projects,
            open_project,
            save_layout,
            load_layout,
            read_metrics,
            kill_process,
            list_history,
            list_directory,
            read_file,
            search_files,
            resume_session,
            create_session,
            attach_session,
            send_input,
            resize_session,
            close_session
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Apex");
}
