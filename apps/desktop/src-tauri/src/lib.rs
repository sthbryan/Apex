mod client;

use std::sync::Arc;

use apex_core::ApexPaths;
use apex_proto::{AgentSummary, Command, Event, Reply, SessionSummary, TerminalSize};
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
        other => Err(format!("respuesta inesperada: {other:?}")),
    }
}

#[tauri::command]
async fn list_sessions(state: tauri::State<'_, AppState>) -> Answer<Vec<SessionSummary>> {
    match state.daemon.request(Command::ListSessions).await.map_err(failed)? {
        Reply::Sessions { sessions } => Ok(sessions),
        other => Err(format!("respuesta inesperada: {other:?}")),
    }
}

#[tauri::command]
async fn create_session(
    state: tauri::State<'_, AppState>,
    agent: String,
    cwd: Option<String>,
    size: TerminalSize,
) -> Answer<SessionSummary> {
    match state
        .daemon
        .request(Command::SessionCreate { agent, cwd, size })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("respuesta inesperada: {other:?}")),
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
        .setup(|app| {
            let paths = ApexPaths::discover()?;
            let daemon = tauri::async_runtime::block_on(DaemonClient::attach(&paths.socket))?;
            app.manage(AppState { daemon });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            daemon_version,
            host_platform,
            subscribe_output,
            subscribe_events,
            list_agents,
            list_sessions,
            create_session,
            attach_session,
            send_input,
            resize_session,
            close_session
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo arrancar Apex");
}
