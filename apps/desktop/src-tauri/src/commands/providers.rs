use apex_proto::{AgentChoice, AgentModel, Command, ProviderStatus, Reply};

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn list_providers(state: tauri::State<'_, AppState>) -> Answer<Vec<ProviderStatus>> {
    match state.daemon()?.request(Command::ProvidersList).await.map_err(failed)? {
        Reply::Providers { providers } => Ok(providers),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn keep_provider_key(
    state: tauri::State<'_, AppState>,
    provider: String,
    key: String,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::ProviderKeep { provider, key })
        .await
        .map_err(failed)
        .map(|_| ())
}

#[tauri::command]
pub async fn forget_provider_key(
    state: tauri::State<'_, AppState>,
    provider: String,
) -> Answer<()> {
    state.daemon()?.request(Command::ProviderForget { provider }).await.map_err(failed).map(|_| ())
}

#[tauri::command]
pub async fn list_provider_models(
    state: tauri::State<'_, AppState>,
    provider: String,
) -> Answer<Vec<AgentModel>> {
    match state.daemon()?.request(Command::ProviderModels { provider }).await.map_err(failed)? {
        Reply::AgentModels { models } => Ok(models),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn agent_chosen(state: tauri::State<'_, AppState>) -> Answer<Option<AgentChoice>> {
    match state.daemon()?.request(Command::AgentChosen).await.map_err(failed)? {
        Reply::AgentChoice { choice } => Ok(choice),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn choose_agent(
    state: tauri::State<'_, AppState>,
    provider: String,
    model: String,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::AgentChoose { provider, model })
        .await
        .map_err(failed)
        .map(|_| ())
}
