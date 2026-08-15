use std::collections::HashMap;
use std::sync::Arc;

use apex_proto::{
    ClientMessage, Command, Connection, ConnectionReader, ErrorCode, Frame, Hello,
    PROTOCOL_VERSION, ProtocolError, Reply, RequestId, Scope, ServerMessage, TransportError,
    Welcome,
};
use tokio::sync::{Mutex, mpsc};
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::sessions::SessionManager;

const DAEMON_VERSION: &str = env!("CARGO_PKG_VERSION");
const CLIENT_QUEUE_DEPTH: usize = 1024;

type Outbox = mpsc::Sender<Frame>;

pub async fn serve(manager: Arc<SessionManager>, mut connection: Connection) {
    let peer = connection.peer().clone();
    match handshake(&mut connection).await {
        Ok(Some(_)) => tracing::info!(peer = %peer.label, "client connected"),
        Ok(None) => {
            tracing::debug!(peer = %peer.label, "availability probe");
            return;
        }
        Err(error) => {
            tracing::warn!(peer = %peer.label, %error, "handshake failed");
            return;
        }
    }

    let (mut writer, reader) = connection.split();
    let (outbox, mut queue) = mpsc::channel::<Frame>(CLIENT_QUEUE_DEPTH);

    let pump = tokio::spawn(async move {
        while let Some(frame) = queue.recv().await {
            if writer.send(frame).await.is_err() {
                return;
            }
        }
    });

    let events = spawn_event_forwarder(manager.clone(), outbox.clone());
    let mut client = Client::new(manager, outbox, peer.scope);
    client.run(reader).await;

    events.abort();
    client.subscriptions.detach_all().await;
    drop(client);
    let _ = pump.await;
    tracing::info!(peer = %peer.label, "client disconnected");
}

#[derive(Clone)]
struct Client {
    manager: Arc<SessionManager>,
    outbox: Outbox,
    scope: Scope,
    subscriptions: Subscriptions,
}

impl Client {
    fn new(manager: Arc<SessionManager>, outbox: Outbox, scope: Scope) -> Self {
        let subscriptions = Subscriptions::new(Arc::clone(&manager), outbox.clone());
        Self { manager, outbox, scope, subscriptions }
    }

    async fn run(&mut self, mut reader: ConnectionReader) {
        while let Some(frame) = reader.recv().await {
            let frame = match frame {
                Ok(frame) => frame,
                Err(error) => {
                    tracing::warn!(%error, "invalid frame");
                    return;
                }
            };

            let message: ClientMessage = match frame.parse_control() {
                Ok(message) => message,
                Err(error) => {
                    tracing::warn!(%error, "unreadable message");
                    let refused = ServerMessage::err(
                        frame.request_id().unwrap_or(RequestId(0)),
                        ProtocolError::new(ErrorCode::MalformedRequest, error.to_string()),
                    );
                    if let Ok(frame) = Frame::control(&refused)
                        && self.outbox.send(frame).await.is_err()
                    {
                        return;
                    }
                    continue;
                }
            };

            let response = match message {
                ClientMessage::Hello(_) => ServerMessage::err(
                    RequestId(0),
                    ProtocolError::new(ErrorCode::MalformedRequest, "hello duplicado"),
                ),
                ClientMessage::Request { id, command } if runs_detached(&command) => {
                    let client = self.clone();
                    tokio::spawn(async move {
                        let response = client.dispatch(id, command).await;
                        if let Ok(frame) = Frame::control(&response) {
                            let _ = client.outbox.send(frame).await;
                        }
                    });
                    continue;
                }
                ClientMessage::Request { id, command } => self.dispatch(id, command).await,
            };

            let Ok(frame) = Frame::control(&response) else {
                continue;
            };
            if self.outbox.send(frame).await.is_err() {
                return;
            }
        }
    }

    async fn dispatch(&self, id: RequestId, command: Command) -> ServerMessage {
        if !scope_allows(self.scope, &command) {
            return ServerMessage::err(
                id,
                ProtocolError::unauthorized("command not allowed for remote clients"),
            );
        }

        match self.execute(command).await {
            Ok(reply) => ServerMessage::ok(id, reply),
            Err(error) => ServerMessage::err(id, error),
        }
    }

    async fn execute(&self, command: Command) -> Result<Reply, ProtocolError> {
        match command {
            Command::Ping => Ok(Reply::Pong),
            Command::ListAgents => Ok(Reply::Agents { agents: self.manager.list_agents().await }),
            Command::ListSessions => {
                Ok(Reply::Sessions { sessions: self.manager.list_sessions().await })
            }
            Command::ListProjects => Ok(Reply::Projects {
                projects: self.manager.list_projects().await.map_err(internal_error)?,
            }),
            Command::ReadMetrics { refresh_quota } => Ok(Reply::Metrics {
                snapshot: self.manager.read_metrics(refresh_quota).await,
            }),
            Command::KillProcess { pid } => {
                self.manager.kill_process(pid).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::ListHistory { project } => Ok(Reply::History {
                entries: self.manager.list_history(project).await.map_err(not_found_error)?,
            }),
            Command::DirList { project, path } => Ok(Reply::Directory {
                entries: self
                    .manager
                    .list_directory(project, &path)
                    .await
                    .map_err(not_found_error)?,
            }),
            Command::FileRead { project, path } => Ok(Reply::File {
                contents: self.manager.read_file(project, &path).await.map_err(not_found_error)?,
            }),
            Command::FileSearch { project, query, limit } => Ok(Reply::Directory {
                entries: self
                    .manager
                    .search_files(project, &query, limit as usize)
                    .await
                    .map_err(not_found_error)?,
            }),
            Command::GitRead { project, target } => Ok(Reply::Git {
                status: self.manager.git_status(project, target).await.map_err(not_found_error)?,
            }),
            Command::WorktreeList { project } => Ok(Reply::Worktrees {
                worktrees: self.manager.list_worktrees(project).await.map_err(not_found_error)?,
            }),
            Command::GitDiff { project, target, path, commit, scope } => Ok(Reply::Diff {
                patch: self
                    .manager
                    .git_diff(project, target, &path, commit, scope)
                    .await
                    .map_err(not_found_error)?,
            }),
            Command::GitHunks { project, target, path, scope } => Ok(Reply::Hunks {
                patches: self
                    .manager
                    .git_hunks(project, target, &path, scope)
                    .await
                    .map_err(not_found_error)?,
            }),
            Command::GitStage { project, target, paths, staged } => {
                self.manager
                    .git_stage(project, target, paths, staged)
                    .await
                    .map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::GitStageHunk { project, target, patch, staged } => {
                self.manager
                    .git_stage_hunk(project, target, patch, staged)
                    .await
                    .map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::GitCommitStaged { project, target, message } => Ok(Reply::Committed {
                commit: self
                    .manager
                    .git_commit(project, target, message)
                    .await
                    .map_err(not_found_error)?,
            }),
            Command::GitLog { project, target, limit } => Ok(Reply::Log {
                commits: self
                    .manager
                    .git_log(project, target, limit as usize)
                    .await
                    .map_err(not_found_error)?,
            }),
            Command::WorktreeMerge { project, target } => Ok(Reply::Merge {
                report: self
                    .manager
                    .merge_worktree(project, target)
                    .await
                    .map_err(not_found_error)?,
            }),
            Command::ListTasks { project } => Ok(Reply::Tasks {
                tasks: self.manager.list_tasks(project).await.map_err(not_found_error)?,
            }),
            Command::TaskRun { project, task, command, size } => {
                let session = self
                    .manager
                    .run_task(project, &task, &command, size)
                    .await
                    .map_err(internal_error)?;
                self.subscriptions.attach(session.id).await?;
                Ok(Reply::Session { session })
            }
            Command::ContextList { project } => Ok(Reply::Context {
                entries: self.manager.context_list(project).await.map_err(not_found_error)?,
            }),
            Command::ContextRead { project, key } => Ok(Reply::Text {
                text: self.manager.context_read(project, &key).await.map_err(not_found_error)?,
            }),
            Command::ContextWrite { project, key, contents } => {
                self.manager
                    .context_write(project, &key, &contents)
                    .await
                    .map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::ContextNote { project, from, to, message } => {
                self.manager
                    .context_note(project, &from, to.as_deref(), &message)
                    .await
                    .map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::SessionTranscript { id, tail } => Ok(Reply::Text {
                text: self.manager.transcript(id, tail as usize).await.map_err(not_found_error)?,
            }),
            Command::ListEditors => {
                Ok(Reply::Editors { editors: self.manager.list_editors().await })
            }
            Command::FileOpenExternal { project, path, editor } => {
                self.manager
                    .open_externally(project, &path, editor.as_deref())
                    .await
                    .map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::SessionResume { project, agent, session_id, size } => {
                let session = self
                    .manager
                    .resume(project, &agent, &session_id, size)
                    .await
                    .map_err(internal_error)?;
                self.subscriptions.attach(session.id).await?;
                Ok(Reply::Session { session })
            }
            Command::ProjectOpen { root } => Ok(Reply::Project {
                project: self.manager.open_project(&root).await.map_err(not_found_error)?,
            }),
            Command::LayoutSave { project, payload } => {
                self.manager.save_layout(project, &payload).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::LayoutLoad { project } => Ok(Reply::Layout {
                payload: self.manager.load_layout(project).await.map_err(not_found_error)?,
            }),
            Command::SessionCreate { project, agent, cwd, size, isolation, slug, mode } => {
                let session = self
                    .manager
                    .create(crate::sessions::NewSession {
                        project,
                        agent,
                        cwd,
                        size,
                        isolation,
                        slug,
                        mode,
                    })
                    .await
                    .map_err(internal_error)?;
                if session.mode == apex_proto::AgentMode::Pty {
                    self.subscriptions.attach(session.id).await?;
                }
                Ok(Reply::Session { session })
            }
            Command::SessionAttach { id } => {
                self.subscriptions.attach(id).await?;
                Ok(Reply::Done)
            }
            Command::SessionDetach { id } => {
                self.subscriptions.detach(id).await;
                Ok(Reply::Done)
            }
            Command::SessionInput { id, data } => {
                self.manager.write(id, &data).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::SessionResize { id, size } => {
                self.manager.resize(id, size).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::AcpTranscript { id } => Ok(Reply::Acp {
                entries: self.manager.acp_entries(id).await.map_err(not_found_error)?,
            }),
            Command::AcpPrompt { id, text } => {
                self.manager.acp_prompt(id, text).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::AcpCancel { id } => {
                self.manager.acp_cancel(id).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::AcpDecide { id, request, option } => {
                self.manager.acp_decide(id, request, option).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
            Command::SessionClose { id, worktree } => {
                self.subscriptions.detach(id).await;
                self.manager.close(id, worktree).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
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

fn runs_detached(command: &Command) -> bool {
    matches!(
        command,
        Command::ReadMetrics { .. }
            | Command::ListHistory { .. }
            | Command::ListEditors
            | Command::DirList { .. }
            | Command::FileRead { .. }
            | Command::FileSearch { .. }
            | Command::FileOpenExternal { .. }
            | Command::GitRead { .. }
            | Command::GitDiff { .. }
            | Command::GitLog { .. }
            | Command::GitHunks { .. }
            | Command::WorktreeList { .. }
            | Command::ListTasks { .. }
            | Command::ContextList { .. }
            | Command::ContextRead { .. }
            | Command::ContextWrite { .. }
            | Command::ContextNote { .. }
            | Command::SessionTranscript { .. }
            | Command::GitStage { .. }
            | Command::GitStageHunk { .. }
            | Command::GitCommitStaged { .. }
            | Command::WorktreeMerge { .. }
    )
}

fn spawn_event_forwarder(manager: Arc<SessionManager>, outbox: Outbox) -> JoinHandle<()> {
    let mut events = manager.subscribe();
    tokio::spawn(async move {
        loop {
            match events.recv().await {
                Ok(event) => {
                    let Ok(frame) = Frame::control(&ServerMessage::Event(event)) else {
                        continue;
                    };
                    if outbox.send(frame).await.is_err() {
                        return;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => return,
            }
        }
    })
}

fn internal_error(error: anyhow::Error) -> ProtocolError {
    ProtocolError::internal(format!("{error:#}"))
}

fn not_found_error(error: anyhow::Error) -> ProtocolError {
    ProtocolError::new(ErrorCode::NotFound, format!("{error:#}"))
}

async fn handshake(connection: &mut Connection) -> Result<Option<Hello>, TransportError> {
    let Some(frame) = connection.recv().await else {
        return Ok(None);
    };
    let hello = match frame?.parse_control::<ClientMessage>()? {
        ClientMessage::Hello(hello) => hello,
        ClientMessage::Request { .. } => {
            return Err(TransportError::MalformedFrame("expected hello".into()));
        }
    };

    if hello.protocol_version != PROTOCOL_VERSION {
        let error = ProtocolError::unsupported_version(format!(
            "daemon speaks v{PROTOCOL_VERSION}, client speaks v{}",
            hello.protocol_version
        ));
        let _ = connection.send(Frame::control(&ServerMessage::err(RequestId(0), error))?).await;
        return Err(TransportError::MalformedFrame("version incompatible".into()));
    }

    connection
        .send_control(&ServerMessage::Welcome(Welcome {
            protocol_version: PROTOCOL_VERSION,
            daemon_version: DAEMON_VERSION.to_string(),
            scope: connection.peer().scope,
        }))
        .await?;
    Ok(Some(hello))
}

fn scope_allows(scope: Scope, command: &Command) -> bool {
    match scope {
        Scope::Local => true,
        Scope::Remote => !matches!(command, Command::SessionCreate { .. }),
    }
}

