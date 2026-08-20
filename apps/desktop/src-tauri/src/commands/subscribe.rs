use apex_proto::Event;
use tauri::ipc::{Channel, InvokeResponseBody};

use crate::state::{Answer, AppState};

#[tauri::command]
pub async fn subscribe_output(
    state: tauri::State<'_, AppState>,
    channel: Channel<InvokeResponseBody>,
) -> Answer<()> {
    state.daemon()?.set_output_channel(channel).await;
    Ok(())
}

#[tauri::command]
pub async fn subscribe_events(
    state: tauri::State<'_, AppState>,
    channel: Channel<Event>,
) -> Answer<()> {
    state.daemon()?.set_event_channel(channel).await;
    Ok(())
}
