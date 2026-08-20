use apex_proto::{Command, EditorSummary, FileContents, FileEntry, Reply};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn list_directory(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
) -> Answer<Vec<FileEntry>> {
    match state.daemon()?.request(Command::DirList { project, path }).await.map_err(failed)? {
        Reply::Directory { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn read_file(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
) -> Answer<FileContents> {
    match state.daemon()?.request(Command::FileRead { project, path }).await.map_err(failed)? {
        Reply::File { contents } => Ok(contents),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn write_file(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
    text: String,
    revision: Option<String>,
) -> Answer<String> {
    match state
        .daemon()?
        .request(Command::FileWrite { project, path, text, revision })
        .await
        .map_err(failed)?
    {
        Reply::Wrote { revision } => Ok(revision),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn search_files(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    query: String,
    limit: u32,
) -> Answer<Vec<FileEntry>> {
    match state
        .daemon()?
        .request(Command::FileSearch { project, query, limit })
        .await
        .map_err(failed)?
    {
        Reply::Directory { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn list_editors(state: tauri::State<'_, AppState>) -> Answer<Vec<EditorSummary>> {
    match state.daemon()?.request(Command::ListEditors).await.map_err(failed)? {
        Reply::Editors { editors } => Ok(editors),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn browser_report(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    url: String,
    title: Option<String>,
    text: Option<String>,
    logs: Vec<apex_proto::BrowserLog>,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::BrowserReport { project, url, title, text, logs })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn browser_forget(state: tauri::State<'_, AppState>, project: Uuid) -> Answer<()> {
    state.daemon()?.request(Command::BrowserForget { project }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn open_url(state: tauri::State<'_, AppState>, url: String) -> Answer<()> {
    state.daemon()?.request(Command::UrlOpen { url }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn open_externally(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
    editor: Option<String>,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::FileOpenExternal { project, path, editor })
        .await
        .map_err(failed)?;
    Ok(())
}
