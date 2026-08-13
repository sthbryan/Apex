mod client;

use anyhow::Result;
use apex_core::ApexPaths;
use apex_proto::{AgentSummary, Command, Reply};
use client::DaemonClient;
use tauri::Manager;

struct AppState {
    daemon: DaemonClient,
}

#[tauri::command]
fn daemon_version(state: tauri::State<'_, AppState>) -> String {
    state.daemon.daemon_version().to_string()
}

#[tauri::command]
async fn list_agents(state: tauri::State<'_, AppState>) -> Result<Vec<AgentSummary>, String> {
    match state.daemon.request(Command::ListAgents).await {
        Ok(Reply::Agents { agents }) => Ok(agents),
        Ok(other) => Err(format!("respuesta inesperada: {other:?}")),
        Err(error) => Err(format!("{error:#}")),
    }
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
        .invoke_handler(tauri::generate_handler![daemon_version, list_agents])
        .run(tauri::generate_context!())
        .expect("no se pudo arrancar Apex");
}
