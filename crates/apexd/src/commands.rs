use std::collections::HashMap;
use std::sync::Arc;

use apex_core::files;
use apex_proto::{Command, ErrorCode, Frame, ProtocolError, Reply, Scope};
use tokio::sync::{Mutex, mpsc};
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::sessions::SessionManager;

pub type Outbox = mpsc::Sender<Frame>;

pub type Dispatched<'a> =
    std::pin::Pin<Box<dyn std::future::Future<Output = Result<Reply, ProtocolError>> + Send + 'a>>;

pub trait Dispatch: Send + Sync {
    fn dispatch(&self, command: Command) -> Dispatched<'_>;
}

impl Dispatch for SessionManager {
    fn dispatch(&self, command: Command) -> Dispatched<'_> {
        Box::pin(execute(self, None, command))
    }
}

pub struct Remote(pub Arc<dyn Dispatch>);

impl apex_mcp::Daemon for Remote {
    async fn request(&mut self, command: Command) -> anyhow::Result<Reply> {
        self.0.dispatch(command).await.map_err(|error| anyhow::anyhow!("{error}"))
    }
}

#[derive(Clone)]
pub struct Executor {
    manager: Arc<SessionManager>,
    subscriptions: Option<Subscriptions>,
}

impl Executor {
    pub fn attached(manager: Arc<SessionManager>, outbox: Outbox) -> Self {
        let subscriptions = Subscriptions::new(Arc::clone(&manager), outbox);
        Self { manager, subscriptions: Some(subscriptions) }
    }

    pub fn detached(manager: Arc<SessionManager>) -> Self {
        Self { manager, subscriptions: None }
    }

    pub async fn detach_all(&self) {
        if let Some(subscriptions) = &self.subscriptions {
            subscriptions.detach_all().await;
        }
    }

    pub async fn execute(&self, command: Command) -> Result<Reply, ProtocolError> {
        execute(&self.manager, self.subscriptions.as_ref(), command).await
    }
}

async fn attach(subscriptions: Option<&Subscriptions>, id: Uuid) -> Result<(), ProtocolError> {
    match subscriptions {
        Some(subscriptions) => subscriptions.attach(id).await,
        None => Ok(()),
    }
}

async fn detach(subscriptions: Option<&Subscriptions>, id: Uuid) {
    if let Some(subscriptions) = subscriptions {
        subscriptions.detach(id).await;
    }
}

async fn execute(
    manager: &SessionManager,
    subscriptions: Option<&Subscriptions>,
    command: Command,
) -> Result<Reply, ProtocolError> {
    match command {
        Command::Ping => Ok(Reply::Pong),
        Command::DaemonShutdown => {
            manager.quit();
            Ok(Reply::Done)
        }
        Command::DaemonStatus => Ok(Reply::Daemon { report: manager.daemon_report().await }),
        Command::Notify { title, body } => {
            manager.notify(title, body);
            Ok(Reply::Done)
        }
        Command::ListAgents => Ok(Reply::Agents { agents: manager.list_agents().await }),
        Command::ListToolGroups => {
            Ok(Reply::ToolGroups { tools_off: manager.tool_groups_off().await })
        }
        Command::SetToolGroups { tools_off } => {
            manager.set_tool_groups(&tools_off).await.map_err(internal_error)?;
            Ok(Reply::Done)
        }
        Command::ListSessions => Ok(Reply::Sessions { sessions: manager.list_sessions().await }),
        Command::ListProjects => {
            Ok(Reply::Projects { projects: manager.list_projects().await.map_err(internal_error)? })
        }
        Command::ReadMetrics { refresh_quota } => {
            Ok(Reply::Metrics { snapshot: manager.read_metrics(refresh_quota).await })
        }
        Command::KillProcess { pid } => {
            manager.kill_process(pid).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::ListHistory { project } => Ok(Reply::History {
            entries: manager.list_history(project).await.map_err(not_found_error)?,
        }),
        Command::DirList { project, path } => Ok(Reply::Directory {
            entries: manager.list_directory(project, &path).await.map_err(not_found_error)?,
        }),
        Command::FileRead { project, path } => Ok(Reply::File {
            contents: manager.read_file(project, &path).await.map_err(not_found_error)?,
        }),
        Command::FileWrite { project, path, text, revision } => Ok(Reply::Wrote {
            revision: manager
                .write_file(project, &path, text, revision)
                .await
                .map_err(write_error)?,
        }),
        Command::FileSearch { project, query, limit } => Ok(Reply::Directory {
            entries: manager
                .search_files(project, &query, limit as usize)
                .await
                .map_err(not_found_error)?,
        }),
        Command::GitRead { project, target } => Ok(Reply::Git {
            status: manager.git_status(project, target).await.map_err(not_found_error)?,
        }),
        Command::GitBranches { project, target } => Ok(Reply::Branches {
            branches: manager.git_branches(project, target).await.map_err(not_found_error)?,
        }),
        Command::GitCheckout { project, target, branch } => {
            manager.git_checkout(project, target, branch).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::WorktreeList { project } => Ok(Reply::Worktrees {
            worktrees: manager.list_worktrees(project).await.map_err(not_found_error)?,
        }),
        Command::GitDiff { project, target, path, commit, scope } => Ok(Reply::Diff {
            patch: manager
                .git_diff(project, target, &path, commit, scope)
                .await
                .map_err(not_found_error)?,
        }),
        Command::GitPending { project } => Ok(Reply::Pending {
            reviews: manager.git_pending(project).await.map_err(not_found_error)?,
        }),
        Command::GitRejectHunk { project, target, patch } => {
            manager.git_reject_hunk(project, target, patch).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::GitRejects { project, target } => Ok(Reply::Rejects {
            rejects: manager.git_rejects(project, target).await.map_err(not_found_error)?,
        }),
        Command::GitRestoreReject { project, target, id } => {
            manager.git_restore_reject(project, target, &id).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::GitClearRejects { project, target } => {
            manager.git_clear_rejects(project, target).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::GitHunks { project, target, path, scope } => Ok(Reply::Hunks {
            patches: manager
                .git_hunks(project, target, &path, scope)
                .await
                .map_err(not_found_error)?,
        }),
        Command::GitImages { project, target, path, commit } => Ok(Reply::Images {
            pair: manager
                .git_images(project, target, &path, commit)
                .await
                .map_err(not_found_error)?,
        }),
        Command::GitStage { project, target, paths, staged } => {
            manager.git_stage(project, target, paths, staged).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::GitStageHunk { project, target, patch, staged } => {
            manager
                .git_stage_hunk(project, target, patch, staged)
                .await
                .map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::GitCommitStaged { project, target, message } => Ok(Reply::Committed {
            commit: manager.git_commit(project, target, message).await.map_err(not_found_error)?,
        }),
        Command::GitSync { project, target, op } => {
            manager.git_sync(project, target, op).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::GitLog { project, target, limit } => Ok(Reply::Log {
            commits: manager
                .git_log(project, target, limit as usize)
                .await
                .map_err(not_found_error)?,
        }),
        Command::WorktreeMerge { project, target } => Ok(Reply::Merge {
            report: manager.merge_worktree(project, target).await.map_err(not_found_error)?,
        }),
        Command::WorktreePrune { project } => Ok(Reply::Pruned {
            removed: manager.prune_worktrees(project).await.map_err(not_found_error)?,
        }),
        Command::WorktreeRemove { project, path, branch } => {
            manager.remove_worktree(project, path, branch).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::ListTasks { project } => {
            Ok(Reply::Tasks { tasks: manager.list_tasks(project).await.map_err(not_found_error)? })
        }
        Command::TaskRun { project, task, command, size } => {
            let session =
                manager.run_task(project, &task, &command, size).await.map_err(internal_error)?;
            attach(subscriptions, session.id).await?;
            Ok(Reply::Session { session })
        }
        Command::ContextList { project } => Ok(Reply::Context {
            entries: manager.context_list(project).await.map_err(not_found_error)?,
        }),
        Command::ContextRead { project, key } => Ok(Reply::Text {
            text: manager.context_read(project, &key).await.map_err(not_found_error)?,
        }),
        Command::ContextWrite { project, key, contents } => {
            manager.context_write(project, &key, &contents).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::ContextNote { project, from, to, message } => {
            manager
                .context_note(project, &from, to.as_deref(), &message)
                .await
                .map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::SessionTranscript { id, tail, plain } => Ok(Reply::Text {
            text: manager.transcript(id, tail as usize, plain).await.map_err(not_found_error)?,
        }),
        Command::ListEditors => Ok(Reply::Editors { editors: manager.list_editors().await }),
        Command::BrowserReport { project, pane, url } => {
            manager.browser_report(project, pane, url).await;
            Ok(Reply::Done)
        }
        Command::BrowserForget { pane } => {
            manager.browser_forget(&pane).await;
            Ok(Reply::Done)
        }
        Command::BrowserPage { project } => {
            Ok(Reply::Text { text: manager.browser_page(project).await })
        }
        Command::ApiList { project } => {
            let (requests, environments) = manager.api_list(project);
            Ok(Reply::ApiCollection { requests, environments })
        }
        Command::ApiRead { project, name } => {
            let (request, last) = manager.api_read(project, &name).map_err(not_found_error)?;
            Ok(Reply::ApiRequest { request, last })
        }
        Command::ApiWrite { project, name, request } => {
            manager.api_write(project, &name, &request).map_err(write_error)?;
            Ok(Reply::Done)
        }
        Command::ApiRemove { project, name } => {
            manager.api_remove(project, &name).map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::ApiEnvRead { project, name } => Ok(Reply::ApiEnvironment {
            variables: manager.api_env_read(project, &name).map_err(not_found_error)?,
        }),
        Command::ApiEnvWrite { project, name, variables } => {
            manager.api_env_write(project, &name, &variables).map_err(write_error)?;
            Ok(Reply::Done)
        }
        Command::ApiEnvRemove { project, name } => {
            manager.api_env_remove(project, &name).map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::ApiSend { project, name, environment } => Ok(Reply::ApiRun {
            run: manager
                .api_send(project, &name, environment.as_deref())
                .await
                .map_err(not_found_error)?,
        }),
        Command::BrowserLogs { project } => {
            Ok(Reply::Text { text: manager.browser_logs(project).await.map_err(internal_error)? })
        }
        Command::UrlOpen { url } => {
            manager.open_url(&url).map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::FileOpenExternal { project, path, editor } => {
            manager
                .open_externally(project, &path, editor.as_deref())
                .await
                .map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::SessionResume { project, agent, session_id, size } => {
            let session =
                manager.resume(project, &agent, &session_id, size).await.map_err(internal_error)?;
            attach(subscriptions, session.id).await?;
            Ok(Reply::Session { session })
        }
        Command::ProjectOpen { root } => Ok(Reply::Project {
            project: manager.open_project(&root).await.map_err(not_found_error)?,
        }),
        Command::ProjectRemove { project } => {
            manager.remove_project(project).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::LayoutSave { project, payload } => {
            manager.save_layout(project, &payload).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::LayoutLoad { project } => Ok(Reply::Layout {
            payload: manager.load_layout(project).await.map_err(not_found_error)?,
        }),
        Command::SessionCreate { project, agent, cwd, size, isolation, slug, mode } => {
            let session = manager
                .create(crate::sessions::NewSession {
                    project,
                    agent,
                    cwd,
                    size,
                    isolation,
                    slug,
                    mode,
                    parent: None,
                    run: None,
                    unattended: false,
                })
                .await
                .map_err(internal_error)?;
            if session.mode == apex_proto::AgentMode::Pty {
                attach(subscriptions, session.id).await?;
            }
            Ok(Reply::Session { session })
        }
        Command::OpenView { asked_by, target } => {
            manager.open_view(asked_by, target).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::BrowserShot { project } => {
            Ok(Reply::Text { text: manager.browser_shot(project).await.map_err(internal_error)? })
        }
        Command::ShotDone { request, path, error } => {
            manager.pane_answered(request, path, error).await;
            Ok(Reply::Done)
        }
        Command::PageDone { request, page, error } => {
            manager.pane_answered(request, page, error).await;
            Ok(Reply::Done)
        }
        Command::Preview { asked_by, path } => Ok(Reply::Text {
            text: manager.preview(asked_by, &path).await.map_err(not_found_error)?,
        }),
        Command::CloseView { asked_by, target } => {
            manager.close_view(asked_by, target).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::SessionTell { id, text } => {
            manager.tell(id, text).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::SessionDone { id, summary } => {
            manager.call_it_done(id, summary).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::SessionDismiss { asked_by, id } => {
            detach(subscriptions, id).await;
            manager.dismiss(asked_by, id).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::SessionRace { project, agents, task, unattended } => {
            let sessions =
                manager.race(project, agents, task, unattended).await.map_err(internal_error)?;
            Ok(Reply::Spawned { sessions })
        }
        Command::SessionBroadcast { parent, agents, task, isolation } => {
            let sessions =
                manager.broadcast(parent, agents, task, isolation).await.map_err(internal_error)?;
            Ok(Reply::Spawned { sessions })
        }
        Command::SessionSpawn { parent, agent, task, isolation } => {
            let session =
                manager.spawn(parent, &agent, task, isolation).await.map_err(internal_error)?;
            Ok(Reply::Session { session })
        }
        Command::SessionAttach { id } => {
            attach(subscriptions, id).await?;
            Ok(Reply::Done)
        }
        Command::SessionDetach { id } => {
            detach(subscriptions, id).await;
            Ok(Reply::Done)
        }
        Command::SessionInput { id, data } => {
            manager.write(id, &data).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::SessionResize { id, size } => {
            manager.resize(id, size).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::AcpTranscript { id } => {
            Ok(Reply::Acp { snapshot: manager.acp_snapshot(id).await.map_err(not_found_error)? })
        }
        Command::AcpPrompt { id, text } => {
            manager.acp_prompt(id, text).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::AcpCancel { id } => {
            manager.acp_cancel(id).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::AcpDecide { id, request, option } => {
            manager.acp_decide(id, request, option).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::AcpChoose { id, model, mode } => {
            manager.acp_choose(id, model, mode).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
        Command::McpAdopt { agent, enabled } => Ok(Reply::Text {
            text: manager.mcp_adopt(&agent, enabled).await.map_err(internal_error)?,
        }),
        Command::SetIdleGrace { seconds } => {
            manager.set_idle_grace(seconds);
            Ok(Reply::Done)
        }
        Command::SessionClose { id, worktree } => {
            detach(subscriptions, id).await;
            manager.close(id, worktree).await.map_err(not_found_error)?;
            Ok(Reply::Done)
        }
    }
}

#[derive(Clone)]
struct Subscriptions {
    manager: Arc<SessionManager>,
    outbox: Outbox,
    attached: Arc<Mutex<HashMap<Uuid, JoinHandle<()>>>>,
}

impl Subscriptions {
    fn new(manager: Arc<SessionManager>, outbox: Outbox) -> Self {
        Self { manager, outbox, attached: Arc::new(Mutex::new(HashMap::new())) }
    }

    async fn attach(&self, id: Uuid) -> Result<(), ProtocolError> {
        if self.attached.lock().await.contains_key(&id) {
            return Ok(());
        }
        let session = self
            .manager
            .get(id)
            .await
            .ok_or_else(|| ProtocolError::new(ErrorCode::NotFound, format!("session {id}")))?;

        let outbox = self.outbox.clone();
        let mut stream = session.process.subscribe();
        let replay = session.process.snapshot();

        let handle = tokio::spawn(async move {
            if !replay.is_empty()
                && outbox.send(Frame::Output { session: id, data: replay }).await.is_err()
            {
                return;
            }
            loop {
                match stream.recv().await {
                    Ok(data) => {
                        if outbox.send(Frame::Output { session: id, data }).await.is_err() {
                            return;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                        tracing::warn!(%id, skipped, "client fell behind");
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => return,
                }
            }
        });

        self.attached.lock().await.insert(id, handle);
        Ok(())
    }

    async fn detach(&self, id: Uuid) {
        if let Some(handle) = self.attached.lock().await.remove(&id) {
            handle.abort();
        }
    }

    async fn detach_all(&self) {
        for (_, handle) in self.attached.lock().await.drain() {
            handle.abort();
        }
    }
}

pub fn runs_detached(command: &Command) -> bool {
    matches!(
        command,
        Command::ReadMetrics { .. }
            | Command::ListHistory { .. }
            | Command::ListEditors
            | Command::DirList { .. }
            | Command::FileRead { .. }
            | Command::FileWrite { .. }
            | Command::FileSearch { .. }
            | Command::FileOpenExternal { .. }
            | Command::UrlOpen { .. }
            | Command::BrowserReport { .. }
            | Command::BrowserForget { .. }
            | Command::BrowserPage { .. }
            | Command::ApiSend { .. }
            | Command::ApiList { .. }
            | Command::ApiRead { .. }
            | Command::ApiWrite { .. }
            | Command::ApiRemove { .. }
            | Command::ApiEnvRead { .. }
            | Command::ApiEnvWrite { .. }
            | Command::ApiEnvRemove { .. }
            | Command::BrowserLogs { .. }
            | Command::GitRead { .. }
            | Command::GitDiff { .. }
            | Command::GitLog { .. }
            | Command::GitHunks { .. }
            | Command::GitPending { .. }
            | Command::GitRejectHunk { .. }
            | Command::GitRejects { .. }
            | Command::GitRestoreReject { .. }
            | Command::GitClearRejects { .. }
            | Command::GitImages { .. }
            | Command::WorktreeList { .. }
            | Command::GitBranches { .. }
            | Command::GitCheckout { .. }
            | Command::ListTasks { .. }
            | Command::ContextList { .. }
            | Command::ContextRead { .. }
            | Command::ContextWrite { .. }
            | Command::ContextNote { .. }
            | Command::SessionTranscript { .. }
            | Command::GitStage { .. }
            | Command::GitStageHunk { .. }
            | Command::GitCommitStaged { .. }
            | Command::GitSync { .. }
            | Command::WorktreeMerge { .. }
            | Command::WorktreeRemove { .. }
            | Command::WorktreePrune { .. }
            | Command::SessionCreate { .. }
            | Command::OpenView { .. }
            | Command::Preview { .. }
            | Command::CloseView { .. }
            | Command::BrowserShot { .. }
            | Command::SessionTell { .. }
            | Command::SessionDone { .. }
            | Command::SessionDismiss { .. }
            | Command::SessionBroadcast { .. }
            | Command::SessionRace { .. }
            | Command::SessionSpawn { .. }
            | Command::SessionResume { .. }
            | Command::SessionClose { .. }
            | Command::TaskRun { .. }
            | Command::AcpTranscript { .. }
            | Command::AcpPrompt { .. }
            | Command::AcpCancel { .. }
            | Command::AcpDecide { .. }
            | Command::AcpChoose { .. }
            | Command::McpAdopt { .. }
    )
}

pub fn scope_allows(scope: Scope, command: &Command) -> bool {
    match scope {
        Scope::Local => true,
        Scope::Remote => {
            !matches!(command, Command::SessionCreate { .. } | Command::SetIdleGrace { .. })
        }
    }
}

fn internal_error(error: anyhow::Error) -> ProtocolError {
    ProtocolError::internal(format!("{error:#}"))
}

fn write_error(error: anyhow::Error) -> ProtocolError {
    if error.downcast_ref::<files::StaleWrite>().is_some() {
        return ProtocolError::conflict(format!("{error:#}"));
    }
    not_found_error(error)
}

fn not_found_error(error: anyhow::Error) -> ProtocolError {
    ProtocolError::new(ErrorCode::NotFound, format!("{error:#}"))
}
