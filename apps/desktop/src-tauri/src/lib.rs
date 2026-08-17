mod client;

use std::path::PathBuf;
use std::sync::Arc;

use apex_core::ApexPaths;
use apex_proto::{
    AcpSnapshot, AgentSummary, Command, ContextEntry, DiffScope, EditorSummary, Event, FileContents,
    FileEntry,
    GitCommit,
    GitStatus, GitTarget, HistoryEntry, TaskSummary, Isolation, MergeReport, MetricsSnapshot, ProjectSummary,
    Reply, SessionSummary, TerminalSize, WorktreeDisposal, WorktreeInfo,
};
use client::DaemonClient;
use tauri::Manager;
use tauri::ipc::{Channel, InvokeResponseBody};
use uuid::Uuid;

struct AppState {
    daemon: std::sync::Mutex<Option<Arc<DaemonClient>>>,
    socket: PathBuf,
}

impl AppState {
    fn daemon(&self) -> Answer<Arc<DaemonClient>> {
        self.daemon
            .lock()
            .map_err(|_| "the daemon handle is poisoned".to_owned())?
            .clone()
            .ok_or_else(|| "apexd is not connected".to_owned())
    }

    async fn connect(&self) -> Answer<Arc<DaemonClient>> {
        if let Ok(existing) = self.daemon() {
            return Ok(existing);
        }
        let client = DaemonClient::attach(&self.socket).await.map_err(failed)?;
        if let Ok(mut slot) = self.daemon.lock() {
            *slot = Some(Arc::clone(&client));
        }
        Ok(client)
    }
}

type Answer<T> = Result<T, String>;

fn failed(error: anyhow::Error) -> String {
    format!("{error:#}")
}

#[tauri::command]
async fn daemon_version(state: tauri::State<'_, AppState>) -> Answer<String> {
    let daemon = state.connect().await?;
    Ok(daemon.daemon_version().to_string())
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
    state.daemon()?.set_output_channel(channel).await;
    Ok(())
}

#[tauri::command]
async fn subscribe_events(
    state: tauri::State<'_, AppState>,
    channel: Channel<Event>,
) -> Answer<()> {
    state.daemon()?.set_event_channel(channel).await;
    Ok(())
}

#[tauri::command]
async fn list_agents(state: tauri::State<'_, AppState>) -> Answer<Vec<AgentSummary>> {
    match state.daemon()?.request(Command::ListAgents).await.map_err(failed)? {
        Reply::Agents { agents } => Ok(agents),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_sessions(state: tauri::State<'_, AppState>) -> Answer<Vec<SessionSummary>> {
    match state.daemon()?.request(Command::ListSessions).await.map_err(failed)? {
        Reply::Sessions { sessions } => Ok(sessions),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_projects(state: tauri::State<'_, AppState>) -> Answer<Vec<ProjectSummary>> {
    match state.daemon()?.request(Command::ListProjects).await.map_err(failed)? {
        Reply::Projects { projects } => Ok(projects),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn open_project(state: tauri::State<'_, AppState>, root: String) -> Answer<ProjectSummary> {
    match state.daemon()?.request(Command::ProjectOpen { root }).await.map_err(failed)? {
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
    state.daemon()?.request(Command::LayoutSave { project, payload }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn load_layout(state: tauri::State<'_, AppState>, project: Uuid) -> Answer<Option<String>> {
    match state.daemon()?.request(Command::LayoutLoad { project }).await.map_err(failed)? {
        Reply::Layout { payload } => Ok(payload),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn read_metrics(
    state: tauri::State<'_, AppState>,
    refresh_quota: bool,
) -> Answer<MetricsSnapshot> {
    match state.daemon()?.request(Command::ReadMetrics { refresh_quota }).await.map_err(failed)? {
        Reply::Metrics { snapshot } => Ok(snapshot),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn kill_process(state: tauri::State<'_, AppState>, pid: u32) -> Answer<()> {
    state.daemon()?.request(Command::KillProcess { pid }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn list_history(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<HistoryEntry>> {
    match state.daemon()?.request(Command::ListHistory { project }).await.map_err(failed)? {
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
    match state.daemon()?.request(Command::DirList { project, path }).await.map_err(failed)? {
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
    match state.daemon()?.request(Command::FileRead { project, path }).await.map_err(failed)? {
        Reply::File { contents } => Ok(contents),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_editors(state: tauri::State<'_, AppState>) -> Answer<Vec<EditorSummary>> {
    match state.daemon()?.request(Command::ListEditors).await.map_err(failed)? {
        Reply::Editors { editors } => Ok(editors),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn open_externally(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
    editor: Option<String>,
) -> Answer<()> {
    state.daemon()?.request(Command::FileOpenExternal { project, path, editor })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn search_files(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    query: String,
    limit: u32,
) -> Answer<Vec<FileEntry>> {
    match state.daemon()?.request(Command::FileSearch { project, query, limit }).await.map_err(failed)?
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
    match state.daemon()?.request(Command::SessionResume { project, agent, session_id, size })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn create_session(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    agent: String,
    cwd: Option<String>,
    size: TerminalSize,
    isolation: Isolation,
    slug: Option<String>,
    mode: Option<apex_proto::AgentMode>,
) -> Answer<SessionSummary> {
    match state.daemon()?.request(Command::SessionCreate { project, agent, cwd, size, isolation, slug, mode })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn attach_session(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<()> {
    state.daemon()?.request(Command::SessionAttach { id }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn send_input(state: tauri::State<'_, AppState>, id: Uuid, data: String) -> Answer<()> {
    state.daemon()?.request(Command::SessionInput { id, data }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn resize_session(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    size: TerminalSize,
) -> Answer<()> {
    state.daemon()?.request(Command::SessionResize { id, size }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn close_session(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    worktree: WorktreeDisposal,
) -> Answer<()> {
    state.daemon()?.request(Command::SessionClose { id, worktree }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn git_status(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
) -> Answer<GitStatus> {
    match state.daemon()?.request(Command::GitRead { project, target }).await.map_err(failed)? {
        Reply::Git { status } => Ok(status),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn git_diff(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    path: String,
    commit: Option<String>,
    scope: DiffScope,
) -> Answer<String> {
    match state.daemon()?.request(Command::GitDiff { project, target, path, commit, scope })
        .await
        .map_err(failed)?
    {
        Reply::Diff { patch } => Ok(patch),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn git_log(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    limit: u32,
) -> Answer<Vec<GitCommit>> {
    match state.daemon()?.request(Command::GitLog { project, target, limit })
        .await
        .map_err(failed)?
    {
        Reply::Log { commits } => Ok(commits),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_worktrees(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<WorktreeInfo>> {
    match state.daemon()?.request(Command::WorktreeList { project }).await.map_err(failed)? {
        Reply::Worktrees { worktrees } => Ok(worktrees),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn git_hunks(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    path: String,
    scope: DiffScope,
) -> Answer<Vec<String>> {
    match state.daemon()?.request(Command::GitHunks { project, target, path, scope })
        .await
        .map_err(failed)?
    {
        Reply::Hunks { patches } => Ok(patches),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn git_stage(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    paths: Vec<String>,
    staged: bool,
) -> Answer<()> {
    state.daemon()?.request(Command::GitStage { project, target, paths, staged })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn git_stage_hunk(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    patch: String,
    staged: bool,
) -> Answer<()> {
    state.daemon()?.request(Command::GitStageHunk { project, target, patch, staged })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn git_commit(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    message: String,
) -> Answer<GitCommit> {
    match state.daemon()?.request(Command::GitCommitStaged { project, target, message })
        .await
        .map_err(failed)?
    {
        Reply::Committed { commit } => Ok(commit),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn list_tasks(state: tauri::State<'_, AppState>, project: Uuid) -> Answer<Vec<TaskSummary>> {
    match state.daemon()?.request(Command::ListTasks { project }).await.map_err(failed)? {
        Reply::Tasks { tasks } => Ok(tasks),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn run_task(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    task: String,
    command: String,
    size: TerminalSize,
) -> Answer<SessionSummary> {
    match state.daemon()?.request(Command::TaskRun { project, task, command, size })
        .await
        .map_err(failed)?
    {
        Reply::Session { session } => Ok(session),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn session_transcript(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    tail: u32,
) -> Answer<String> {
    match state.daemon()?.request(Command::SessionTranscript { id, tail, plain: false }).await.map_err(failed)? {
        Reply::Text { text } => Ok(text),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn acp_transcript(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<AcpSnapshot> {
    match state.daemon()?.request(Command::AcpTranscript { id }).await.map_err(failed)? {
        Reply::Acp { snapshot } => Ok(snapshot),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn acp_prompt(state: tauri::State<'_, AppState>, id: Uuid, text: String) -> Answer<()> {
    state.daemon()?.request(Command::AcpPrompt { id, text }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn acp_cancel(state: tauri::State<'_, AppState>, id: Uuid) -> Answer<()> {
    state.daemon()?.request(Command::AcpCancel { id }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn acp_decide(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    request: u32,
    option: Option<String>,
) -> Answer<()> {
    state.daemon()?.request(Command::AcpDecide { id, request, option }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn acp_choose(
    state: tauri::State<'_, AppState>,
    id: Uuid,
    model: Option<String>,
    mode: Option<String>,
) -> Answer<()> {
    state.daemon()?.request(Command::AcpChoose { id, model, mode }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn mcp_adopt(
    state: tauri::State<'_, AppState>,
    agent: String,
    enabled: bool,
) -> Answer<String> {
    match state.daemon()?.request(Command::McpAdopt { agent, enabled }).await.map_err(failed)? {
        Reply::Text { text } => Ok(text),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn context_list(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<ContextEntry>> {
    match state.daemon()?.request(Command::ContextList { project }).await.map_err(failed)? {
        Reply::Context { entries } => Ok(entries),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn context_read(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    key: String,
) -> Answer<String> {
    match state.daemon()?.request(Command::ContextRead { project, key }).await.map_err(failed)? {
        Reply::Text { text } => Ok(text),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn context_write(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    key: String,
    contents: String,
) -> Answer<()> {
    state.daemon()?.request(Command::ContextWrite { project, key, contents })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn merge_worktree(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
) -> Answer<MergeReport> {
    match state.daemon()?.request(Command::WorktreeMerge { project, target }).await.map_err(failed)? {
        Reply::Merge { report } => Ok(report),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
async fn remove_worktree(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
    branch: Option<String>,
) -> Answer<()> {
    state.daemon()?.request(Command::WorktreeRemove { project, path, branch })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
async fn set_idle_grace(
    state: tauri::State<'_, AppState>,
    seconds: u32,
) -> Answer<()> {
    let daemon = state
        .daemon
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    if let Some(daemon) = daemon {
        let _ = daemon.request(Command::SetIdleGrace { seconds }).await;
    }
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
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let paths = ApexPaths::discover()?;
            let daemon = tauri::async_runtime::block_on(DaemonClient::attach(&paths.socket));
            if let Err(error) = &daemon {
                tracing::warn!(%error, "could not reach apexd at startup");
            }
            app.manage(AppState {
                daemon: std::sync::Mutex::new(daemon.ok()),
                socket: paths.socket,
            });
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
            list_editors,
            open_externally,
            resume_session,
            create_session,
            attach_session,
            send_input,
            resize_session,
            close_session,
            git_status,
            git_diff,
            git_log,
            git_hunks,
            list_worktrees,
            git_stage,
            git_stage_hunk,
            git_commit,
            merge_worktree,
            remove_worktree,
            list_tasks,
            run_task,
            session_transcript,
            acp_transcript,
            acp_prompt,
            acp_cancel,
            acp_decide,
            acp_choose,
            mcp_adopt,
            context_list,
            context_read,
            context_write,
            set_idle_grace,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Apex");
}
