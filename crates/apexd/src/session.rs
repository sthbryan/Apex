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
    client.detach_all().await;
    drop(client);
    let _ = pump.await;
    tracing::info!(peer = %peer.label, "client disconnected");
}

#[derive(Clone)]
struct Client {
    manager: Arc<SessionManager>,
    outbox: Outbox,
    scope: Scope,
    attached: Arc<Mutex<HashMap<Uuid, JoinHandle<()>>>>,
}

impl Client {
    fn new(manager: Arc<SessionManager>, outbox: Outbox, scope: Scope) -> Self {
        Self { manager, outbox, scope, attached: Arc::new(Mutex::new(HashMap::new())) }
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
                self.attach(session.id).await?;
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
            Command::SessionCreate { project, agent, cwd, size, isolation, slug } => {
                let session = self
                    .manager
                    .create(project, &agent, cwd, size, isolation, slug)
                    .await
                    .map_err(internal_error)?;
                self.attach(session.id).await?;
                Ok(Reply::Session { session })
            }
            Command::SessionAttach { id } => {
                self.attach(id).await?;
                Ok(Reply::Done)
            }
            Command::SessionDetach { id } => {
                self.detach(id).await;
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
            Command::SessionClose { id, worktree } => {
                self.detach(id).await;
                self.manager.close(id, worktree).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use apex_core::{AgentProfile, ApexPaths, BinaryResolver, ProfileSet, ShellEnvironment, Store};
    use apex_proto::{
        CommandOutcome, DiffScope, GitTarget, Isolation, Listener, SessionSummary, TerminalSize,
        UnixTransport, WorktreeDisposal, connect_unix,
    };
    use std::path::PathBuf;
    use std::time::Duration;
    use tokio::time::timeout;

    const QUOTA_SAMPLE: &str =
        r#"[{"provider":"answering","usage":{"primary":{"windowMinutes":300,"usedPercent":42}}}]"#;

    fn manager() -> Arc<SessionManager> {
        manager_at(&ApexPaths::rooted_at(&std::env::temp_dir().join("apex-test-home")))
    }

    fn manager_at(paths: &ApexPaths) -> Arc<SessionManager> {
        let mut profiles = ProfileSet::builtin().expect("profiles");
        profiles.upsert(
            AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("sh profile"),
        );
        profiles.upsert(
            AgentProfile::parse(
                "name = \"prompted\"\n\
                 command = \"sh\"\n\
                 args = [\"-c\", \"echo 'Seguir? (y/n)'; sleep 30\"]\n\
                 [state_patterns]\n\
                 blocked = [\"\\\\(y/n\\\\)\"]\n",
            )
            .expect("prompted profile"),
        );
        let resolver = BinaryResolver::with_environment(ShellEnvironment::from_search_path(vec![
            PathBuf::from("/bin"),
            PathBuf::from("/usr/bin"),
        ]));
        let answering = format!(
            "name = \"answering\"\n\
             command = \"sh\"\n\
             [quota]\n\
             source = \"command\"\n\
             format = \"codexbar\"\n\
             command = \"echo\"\n\
             args = ['{QUOTA_SAMPLE}']\n\
             cache_ttl_secs = 60\n"
        );
        profiles.upsert(AgentProfile::parse(&answering).expect("answering profile"));
        profiles.upsert(
            AgentProfile::parse(
                "name = \"mcp-project\"\n\
                 command = \"echo\"\n\
                 [mcp]\n\
                 kind = \"project\"\n\
                 path = \"opencode.json\"\n\
                 format = \"opencode\"\n",
            )
            .expect("project mcp profile"),
        );
        profiles.upsert(
            AgentProfile::parse(
                "name = \"mcp-aware\"\n\
                 command = \"echo\"\n\
                 [mcp]\n\
                 kind = \"flag\"\n\
                 flag = \"--mcp-config\"\n\
                 merge_from = \"~/.apex-test-mcp.json\"\n",
            )
            .expect("mcp profile"),
        );
        profiles.upsert(
            AgentProfile::parse(
                "name = \"unreachable\"\n\
                 command = \"sh\"\n\
                 [quota]\n\
                 source = \"command\"\n\
                 format = \"codexbar\"\n\
                 command = \"false\"\n\
                 cache_ttl_secs = 60\n",
            )
            .expect("unreachable profile"),
        );

        Arc::new(SessionManager::new(
            paths.clone(),
            profiles,
            resolver,
            Store::in_memory().expect("store"),
        ))
    }

    struct Harness {
        socket: PathBuf,
        manager: Arc<SessionManager>,
        project: Uuid,
        root: tempfile::TempDir,
    }

    impl Harness {
        async fn start() -> Self {
            let manager = manager();
            let root = tempfile::tempdir().expect("tempdir");
            let project = manager
                .open_project(&root.path().display().to_string())
                .await
                .expect("project")
                .id;
            let id = Uuid::new_v4().simple().to_string();
            let socket = PathBuf::from("/tmp").join(format!("apexd-s-{}.sock", &id[..8]));
            let mut transport = UnixTransport::bind(&socket).expect("bind");

            let served = manager.clone();
            tokio::spawn(async move {
                while let Ok((stream, peer)) = transport.accept().await {
                    tokio::spawn(serve(served.clone(), Connection::new(stream, peer)));
                }
            });
            Self { socket, manager, project, root }
        }

        async fn client(&self) -> TestClient {
            let mut connection = connect_unix(&self.socket).await.expect("connect");
            connection
                .send_control(&ClientMessage::Hello(Hello {
                    protocol_version: PROTOCOL_VERSION,
                    client_name: "test".into(),
                    identity: None,
                }))
                .await
                .expect("hello");
            let welcome = connection.recv().await.expect("frame").expect("no error");
            assert!(matches!(
                welcome.parse_control::<ServerMessage>().expect("parse"),
                ServerMessage::Welcome(_)
            ));
            TestClient { connection, next: 0 }
        }
    }

    struct TestClient {
        connection: Connection,
        next: u64,
    }

    impl TestClient {
        async fn request(&mut self, command: Command) -> Reply {
            self.next += 1;
            let id = RequestId(self.next);
            self.connection
                .send_control(&ClientMessage::Request { id, command })
                .await
                .expect("request");

            let deadline = timeout(Duration::from_secs(10), async {
                loop {
                    let frame =
                        self.connection.recv().await.expect("frame").expect("no error");
                    if matches!(frame, Frame::Control(_))
                        && let ServerMessage::Response { id: got, outcome } =
                            frame.parse_control::<ServerMessage>().expect("parse")
                        && got == id
                    {
                        return match outcome {
                            CommandOutcome::Ok { reply } => reply,
                            CommandOutcome::Err { error } => panic!("error: {error}"),
                        };
                    }
                }
            })
            .await;
            deadline.expect("no reply in time")
        }

        async fn create_shell(&mut self, project: Uuid) -> SessionSummary {
            let reply = self
                .request(Command::SessionCreate {
                    isolation: Isolation::Directory,
                    slug: None,
                    project,
                    agent: "sh".into(),
                    cwd: Some("/tmp".into()),
                    size: TerminalSize { rows: 24, cols: 80 },
                })
                .await;
            match reply {
                Reply::Session { session } => session,
                other => panic!("expected a session, got {other:?}"),
            }
        }

        async fn collect_output(&mut self, id: Uuid, needle: &str) -> String {
            let found = timeout(Duration::from_secs(10), async {
                let mut seen = Vec::new();
                loop {
                    let frame =
                        self.connection.recv().await.expect("frame").expect("no error");
                    if let Frame::Output { session, data } = frame
                        && session == id
                    {
                        seen.extend_from_slice(&data);
                        let text = String::from_utf8_lossy(&seen).to_string();
                        if text.contains(needle) {
                            return text;
                        }
                    }
                }
            })
            .await;
            found.unwrap_or_else(|_| panic!("never received {needle:?}"))
        }
    }

    #[tokio::test]
    async fn ping_still_works_alongside_sessions() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        assert_eq!(client.request(Command::Ping).await, Reply::Pong);
    }

    #[tokio::test]
    async fn creating_a_session_streams_its_output() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;

        client
            .request(Command::SessionInput {
                id: session.id,
                data: "echo marca-de-salida\n".into(),
            })
            .await;
        let text = client.collect_output(session.id, "marca-de-salida").await;
        assert!(text.contains("marca-de-salida"));
    }

    #[tokio::test]
    async fn sessions_appear_in_the_listing() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;

        let Reply::Sessions { sessions } = client.request(Command::ListSessions).await else {
            panic!("expected session list");
        };
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);
        assert!(sessions[0].is_alive());
    }

    #[tokio::test]
    async fn resizing_updates_the_stored_size() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;

        client
            .request(Command::SessionResize {
                id: session.id,
                size: TerminalSize { rows: 40, cols: 120 },
            })
            .await;
        client
            .request(Command::SessionInput { id: session.id, data: "stty size\n".into() })
            .await;

        let text = client.collect_output(session.id, "40 120").await;
        assert!(text.contains("40 120"));
    }

    #[tokio::test]
    async fn a_session_survives_the_client_disconnecting() {
        let harness = Harness::start().await;

        let session = {
            let mut client = harness.client().await;
            let session = client.create_shell(harness.project).await;
            client
                .request(Command::SessionInput {
                    id: session.id,
                    data: "echo before-close\n".into(),
                })
                .await;
            client.collect_output(session.id, "before-close").await;
            session
        };

        assert_eq!(harness.manager.list_sessions().await.len(), 1);

        let mut reconnected = harness.client().await;
        reconnected.request(Command::SessionAttach { id: session.id }).await;
        let replayed = reconnected.collect_output(session.id, "before-close").await;
        assert!(replayed.contains("before-close"));

        reconnected
            .request(Command::SessionInput {
                id: session.id,
                data: "echo still-alive\n".into(),
            })
            .await;
        let text = reconnected.collect_output(session.id, "still-alive").await;
        assert!(text.contains("still-alive"));
    }

    async fn wait_for_state(
        manager: &Arc<SessionManager>,
        id: Uuid,
        wanted: apex_proto::SessionState,
    ) {
        let settled = timeout(Duration::from_secs(10), async {
            loop {
                let sessions = manager.list_sessions().await;
                let session = sessions.iter().find(|candidate| candidate.id == id);
                if session.map(|session| session.state) == Some(wanted) {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
        .await;
        assert!(settled.is_ok(), "session never reached {wanted:?}");
    }

    #[tokio::test]
    async fn a_prompt_moves_the_session_to_blocked() {
        let harness = Harness::start().await;
        let session = harness
            .manager
            .create(
                harness.project,
                "prompted",
                Some("/tmp".into()),
                TerminalSize::default(),
                Isolation::Directory,
                None,
            )
            .await
            .expect("create");

        wait_for_state(&harness.manager, session.id, apex_proto::SessionState::Blocked).await;
    }

    #[tokio::test]
    async fn a_state_change_is_announced_as_an_event() {
        let harness = Harness::start().await;
        let mut events = harness.manager.subscribe();

        let session = harness
            .manager
            .create(
                harness.project,
                "prompted",
                Some("/tmp".into()),
                TerminalSize::default(),
                Isolation::Directory,
                None,
            )
            .await
            .expect("create");

        let announced = timeout(Duration::from_secs(10), async {
            loop {
                match events.recv().await {
                    Ok(apex_proto::Event::SessionStateChanged { id, state })
                        if id == session.id && state == apex_proto::SessionState::Blocked =>
                    {
                        return true;
                    }
                    Ok(_) => continue,
                    Err(_) => return false,
                }
            }
        })
        .await;
        assert_eq!(announced, Ok(true), "state change was never announced");
    }

    #[tokio::test]
    async fn a_quiet_session_without_patterns_settles_on_idle() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;
        client
            .request(Command::SessionInput { id: session.id, data: "echo quiet\n".into() })
            .await;

        wait_for_state(&harness.manager, session.id, apex_proto::SessionState::Idle).await;
    }

    #[tokio::test]
    async fn answering_the_prompt_moves_the_session_back_to_working() {
        let harness = Harness::start().await;
        let session = harness
            .manager
            .create(
                harness.project,
                "prompted",
                Some("/tmp".into()),
                TerminalSize::default(),
                Isolation::Directory,
                None,
            )
            .await
            .expect("create");
        wait_for_state(&harness.manager, session.id, apex_proto::SessionState::Blocked).await;

        harness.manager.write(session.id, "still writing\n").await.expect("input");
        wait_for_state(&harness.manager, session.id, apex_proto::SessionState::Working).await;
    }

    #[tokio::test]
    async fn a_project_is_opened_and_listed() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;

        let Reply::Projects { projects } = client.request(Command::ListProjects).await else {
            panic!("expected project list");
        };
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, harness.project);
        assert!(!projects[0].is_git);
    }

    #[tokio::test]
    async fn opening_a_folder_that_is_not_a_directory_fails() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        client.next += 1;
        let id = RequestId(client.next);
        client
            .connection
            .send_control(&ClientMessage::Request {
                id,
                command: Command::ProjectOpen { root: "/no/such/folder".into() },
            })
            .await
            .expect("request");

        let frame = client.connection.recv().await.expect("frame").expect("no error");
        match frame.parse_control::<ServerMessage>().expect("parse") {
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                assert_eq!(error.code, ErrorCode::NotFound);
            }
            other => panic!("expected an error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn a_command_the_daemon_cannot_read_is_refused_not_dropped() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        client.next += 1;
        let id = RequestId(client.next);
        client
            .connection
            .send(Frame::Control(
                serde_json::json!({
                    "kind": "request",
                    "id": id,
                    "command": { "type": "from_the_future" },
                })
                .to_string()
                .into(),
            ))
            .await
            .expect("request");

        let frame = client.connection.recv().await.expect("frame").expect("no error");
        match frame.parse_control::<ServerMessage>().expect("parse") {
            ServerMessage::Response { id: answered, outcome: CommandOutcome::Err { error } } => {
                assert_eq!(answered, id);
                assert_eq!(error.code, ErrorCode::MalformedRequest);
            }
            other => panic!("expected an error, got {other:?}"),
        }
    }

    fn init_repo(root: &std::path::Path) {
        for args in [
            &["init", "--initial-branch=main"][..],
            &["config", "user.email", "test@apex.dev"][..],
            &["config", "user.name", "Apex Test"][..],
        ] {
            std::process::Command::new("git")
                .args(args)
                .current_dir(root)
                .output()
                .expect("git");
        }
        std::fs::write(root.join("README.md"), "# sample\n").expect("readme");
        for args in [&["add", "."][..], &["commit", "-m", "first"][..]] {
            std::process::Command::new("git")
                .args(args)
                .current_dir(root)
                .output()
                .expect("git");
        }
    }

    #[tokio::test]
    async fn an_isolated_session_runs_in_its_own_worktree() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());

        let session = harness
            .manager
            .create(
                harness.project,
                "sh",
                None,
                TerminalSize::default(),
                Isolation::Worktree,
                None,
            )
            .await
            .expect("session");

        let tree = session.worktree.clone().expect("worktree");
        assert!(tree.branch.starts_with("apex/"));
        assert_eq!(session.cwd, tree.path);
        assert!(std::path::Path::new(&tree.path).join("README.md").is_file());

        let target = GitTarget::Session { id: session.id };
        let status = harness.manager.git_status(harness.project, target).await.expect("status");
        assert_eq!(status.branch, tree.branch);
        assert_eq!(status.base, "main");
        assert!(status.isolated);
        assert!(status.changes.is_empty());

        std::fs::write(std::path::Path::new(&tree.path).join("README.md"), "# agent\n")
            .expect("write");
        let target = GitTarget::Session { id: session.id };
        let status = harness.manager.git_status(harness.project, target).await.expect("status");
        assert_eq!(status.changes.len(), 1);
        assert_eq!(status.changes[0].kind, "modified");
        assert!(
            harness
                .manager
                .git_diff(
                    harness.project,
                    GitTarget::Session { id: session.id },
                    "README.md",
                    None,
                    DiffScope::Both,
                )
                .await
                .expect("diff")
                .contains("+# agent")
        );
    }

    #[tokio::test]
    async fn the_project_itself_reports_its_changes_without_a_session() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());
        std::fs::write(harness.root.path().join("README.md"), "# edited\n").expect("write");

        let status =
            harness.manager.git_status(harness.project, GitTarget::Project).await.expect("status");
        assert_eq!(status.branch, "main");
        assert!(!status.isolated);
        assert_eq!(status.changes.len(), 1);
        assert!(
            harness
                .manager
                .git_diff(harness.project, GitTarget::Project, "README.md", None, DiffScope::Both)
                .await
                .expect("diff")
                .contains("+# edited")
        );
    }

    #[tokio::test]
    async fn a_partial_commit_leaves_the_rest_alone() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());
        std::fs::write(harness.root.path().join("README.md"), "# picked\n").expect("write");
        std::fs::write(harness.root.path().join("left.txt"), "not this one\n").expect("write");

        harness
            .manager
            .git_stage(harness.project, GitTarget::Project, vec!["README.md".to_owned()], true)
            .await
            .expect("stage");

        let commit = harness
            .manager
            .git_commit(harness.project, GitTarget::Project, "docs: solo el readme".to_owned())
            .await
            .expect("commit");
        assert_eq!(commit.summary, "docs: solo el readme");

        let shown = harness
            .manager
            .git_diff(harness.project, GitTarget::Project, "", Some(commit.id), DiffScope::Both)
            .await
            .expect("show");
        assert!(shown.contains("README.md"));
        assert!(!shown.contains("left.txt"));

        let status =
            harness.manager.git_status(harness.project, GitTarget::Project).await.expect("status");
        assert_eq!(status.changes.len(), 1);
        assert_eq!(status.changes[0].path, "left.txt");
    }

    #[tokio::test]
    async fn a_file_is_split_into_hunks_that_can_be_staged_apart() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());
        let lines: Vec<String> = (1..=20).map(|n| format!("line {n}")).collect();
        std::fs::write(harness.root.path().join("many.txt"), format!("{}\n", lines.join("\n")))
            .expect("write");
        for args in [&["add", "."][..], &["commit", "-m", "many"][..]] {
            std::process::Command::new("git")
                .args(args)
                .current_dir(harness.root.path())
                .output()
                .expect("git");
        }

        let mut edited = lines.clone();
        edited[1] = "line 2 touched".into();
        edited[18] = "line 19 touched".into();
        std::fs::write(harness.root.path().join("many.txt"), format!("{}\n", edited.join("\n")))
            .expect("write");

        let hunks = harness
            .manager
            .git_hunks(harness.project, GitTarget::Project, "many.txt", DiffScope::Unstaged)
            .await
            .expect("hunks");
        assert_eq!(hunks.len(), 2);

        harness
            .manager
            .git_stage_hunk(harness.project, GitTarget::Project, hunks[0].clone(), true)
            .await
            .expect("stage hunk");

        let staged = harness
            .manager
            .git_diff(harness.project, GitTarget::Project, "many.txt", None, DiffScope::Staged)
            .await
            .expect("staged");
        assert!(staged.contains("+line 2 touched"));
        assert!(!staged.contains("+line 19 touched"));
    }

    #[tokio::test]
    async fn an_agent_with_an_mcp_flag_is_handed_our_own_config() {
        let home = tempfile::tempdir().expect("tempdir");
        let paths = ApexPaths::rooted_at(home.path());
        let manager = manager_at(&paths);
        let root = tempfile::tempdir().expect("project");
        let project = manager
            .open_project(&root.path().display().to_string())
            .await
            .expect("project")
            .id;

        let session = manager
            .create(project, "mcp-aware", None, TerminalSize::default(), Isolation::Directory, None)
            .await
            .expect("session");

        let config = paths.mcp_dir().join(format!("{}.json", session.id));
        assert!(config.is_file(), "the config was never written");


        let written: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&config).expect("read")).expect("json");
        let server = &written["mcpServers"]["apex"];
        assert!(
            !written["mcpServers"].as_object().expect("servers").is_empty(),
            "apex should always be in there"
        );
        let launcher = server["command"].as_str().expect("command");
        assert!(std::path::Path::new(launcher).is_absolute());
        assert!(launcher.contains("apexd"));
        assert_eq!(
            server["args"],
            serde_json::json!(["mcp", "--session", session.id.to_string()])
        );

        let wanted = config.display().to_string();
        let echoed = timeout(Duration::from_secs(10), async {
            loop {
                let transcript = manager.transcript(session.id, 8192).await.expect("transcript");
                if transcript.contains(&wanted) {
                    return transcript;
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
        .await;
        assert!(echoed.is_ok(), "the flag never reached the agent");
    }

    #[tokio::test]
    async fn an_agent_without_a_flag_gets_its_config_in_the_folder_it_runs_in() {
        let home = tempfile::tempdir().expect("tempdir");
        let paths = ApexPaths::rooted_at(home.path());
        let manager = manager_at(&paths);
        let root = tempfile::tempdir().expect("project");
        init_repo(root.path());
        let project = manager
            .open_project(&root.path().display().to_string())
            .await
            .expect("project")
            .id;

        let session = manager
            .create(
                project,
                "mcp-project",
                None,
                TerminalSize::default(),
                Isolation::Directory,
                None,
            )
            .await
            .expect("session");
        assert!(session.worktree.is_none());

        let written = root.path().join("opencode.json");
        let config: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&written).expect("read")).expect("json");
        let launcher = config["mcp"]["apex"]["command"][0].as_str().expect("command");
        assert!(launcher.contains("apexd"));
        assert_eq!(config["mcp"]["apex"]["enabled"], true);

        let exclude = std::fs::read_to_string(root.path().join(".git/info/exclude")).expect("read");
        assert!(exclude.contains("/opencode.json"), "the repo would have been dirtied");

        let status = manager.git_status(project, GitTarget::Project).await.expect("status");
        assert!(status.changes.is_empty(), "the project should still look clean");
    }

    #[tokio::test]
    async fn the_servers_the_agent_already_had_survive_ours() {
        let home = tempfile::tempdir().expect("tempdir");
        std::fs::write(
            home.path().join(".apex-test-mcp.json"),
            r#"{"mcpServers":{"theirs":{"command":"bunx","args":["-y","their-server"]}}}"#,
        )
        .expect("their config");

        let paths = ApexPaths::rooted_at(home.path());
        let manager = manager_at(&paths);
        let root = tempfile::tempdir().expect("project");
        let project = manager
            .open_project(&root.path().display().to_string())
            .await
            .expect("project")
            .id;

        let session = manager
            .create(project, "mcp-aware", None, TerminalSize::default(), Isolation::Directory, None)
            .await
            .expect("session");

        let config = paths.mcp_dir().join(format!("{}.json", session.id));
        let written: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&config).expect("read")).expect("json");

        let servers = written["mcpServers"].as_object().expect("servers");
        assert!(servers.contains_key("apex"), "ours went missing");
        assert!(servers.contains_key("theirs"), "we replaced what the agent already had");
        assert_eq!(servers["theirs"]["command"], "bunx");
    }

    #[tokio::test]
    async fn a_config_the_project_already_has_is_never_overwritten() {
        let home = tempfile::tempdir().expect("tempdir");
        let paths = ApexPaths::rooted_at(home.path());
        let manager = manager_at(&paths);
        let root = tempfile::tempdir().expect("project");
        std::fs::write(root.path().join("opencode.json"), "{\"mine\": true}").expect("write");
        let project = manager
            .open_project(&root.path().display().to_string())
            .await
            .expect("project")
            .id;

        manager
            .create(
                project,
                "mcp-project",
                None,
                TerminalSize::default(),
                Isolation::Directory,
                None,
            )
            .await
            .expect("session");

        let kept = std::fs::read_to_string(root.path().join("opencode.json")).expect("read");
        assert_eq!(kept, "{\"mine\": true}");
    }

    #[tokio::test]
    async fn context_round_trips_and_notes_pile_up() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;

        client
            .request(Command::ContextWrite {
                project: harness.project,
                key: "architecture".into(),
                contents: "# Layers\n".into(),
            })
            .await;

        let Reply::Text { text } = client
            .request(Command::ContextRead { project: harness.project, key: "architecture".into() })
            .await
        else {
            panic!("expected the entry back");
        };
        assert_eq!(text, "# Layers\n");

        client
            .request(Command::ContextNote {
                project: harness.project,
                from: "codex".into(),
                to: Some("claude".into()),
                message: "the parser lives in lib.rs".into(),
            })
            .await;

        let Reply::Context { entries } =
            client.request(Command::ContextList { project: harness.project }).await
        else {
            panic!("expected the listing");
        };
        let keys: Vec<&str> = entries.iter().map(|entry| entry.key.as_str()).collect();
        assert_eq!(keys, vec!["architecture", "notes"]);
        assert!(harness.root.path().join(".apex/context/notes.md").is_file());
    }

    #[tokio::test]
    async fn a_transcript_returns_the_tail_of_what_an_agent_printed() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;

        client
            .request(Command::SessionInput {
                id: session.id,
                data: "echo marca-para-el-otro\n".into(),
            })
            .await;
        client.collect_output(session.id, "marca-para-el-otro").await;

        let Reply::Text { text } =
            client.request(Command::SessionTranscript { id: session.id, tail: 4096 }).await
        else {
            panic!("expected a transcript");
        };
        assert!(text.contains("marca-para-el-otro"));
        assert!(text.len() <= 4096);
    }

    #[tokio::test]
    async fn a_worktree_outlives_the_session_that_made_it() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());
        let session = harness
            .manager
            .create(
                harness.project,
                "sh",
                None,
                TerminalSize::default(),
                Isolation::Worktree,
                None,
            )
            .await
            .expect("session");
        let tree = session.worktree.clone().expect("worktree");

        harness.manager.close(session.id, WorktreeDisposal::Keep).await.expect("close");

        let listed = harness.manager.list_worktrees(harness.project).await.expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].branch, tree.branch);

        let target = GitTarget::Worktree { path: tree.path.clone() };
        let status =
            harness.manager.git_status(harness.project, target.clone()).await.expect("status");
        assert_eq!(status.branch, tree.branch);
        assert!(status.isolated);

        std::fs::write(std::path::Path::new(&tree.path).join("late.txt"), "after\n")
            .expect("write");
        harness
            .manager
            .git_stage(harness.project, target.clone(), vec!["late.txt".to_owned()], true)
            .await
            .expect("stage");
        harness
            .manager
            .git_commit(harness.project, target.clone(), "feat: after the session".to_owned())
            .await
            .expect("commit");

        assert_eq!(
            harness.manager.merge_worktree(harness.project, target).await.expect("merge"),
            apex_proto::MergeReport::Merged
        );
        assert!(harness.root.path().join("late.txt").is_file());
    }

    #[tokio::test]
    async fn a_worktree_commit_never_touches_the_project() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());
        let session = harness
            .manager
            .create(
                harness.project,
                "sh",
                None,
                TerminalSize::default(),
                Isolation::Worktree,
                None,
            )
            .await
            .expect("session");
        let tree = std::path::PathBuf::from(&session.worktree.expect("worktree").path);

        std::fs::write(tree.join("README.md"), "# from the agent\n").expect("write");
        harness
            .manager
            .git_stage(
                harness.project,
                GitTarget::Session { id: session.id },
                vec!["README.md".to_owned()],
                true,
            )
            .await
            .expect("stage");
        harness
            .manager
            .git_commit(
                harness.project,
                GitTarget::Session { id: session.id },
                "feat: agent work".to_owned(),
            )
            .await
            .expect("commit");

        let project =
            harness.manager.git_log(harness.project, GitTarget::Project, 10).await.expect("log");
        assert_eq!(project[0].summary, "first");
        let after =
            harness.manager.git_status(harness.project, GitTarget::Project).await.expect("status");
        assert!(after.changes.is_empty());
    }

    #[tokio::test]
    async fn the_history_is_listed_newest_first() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());
        std::fs::write(harness.root.path().join("later.txt"), "later\n").expect("write");
        for args in [&["add", "."][..], &["commit", "-m", "a later commit"][..]] {
            std::process::Command::new("git")
                .args(args)
                .current_dir(harness.root.path())
                .output()
                .expect("git");
        }

        let commits =
            harness.manager.git_log(harness.project, GitTarget::Project, 10).await.expect("log");
        assert_eq!(commits[0].summary, "a later commit");
        assert_eq!(commits.len(), 2);

        let patch = harness
            .manager
            .git_diff(
                harness.project,
                GitTarget::Project,
                "",
                Some(commits[0].id.clone()),
                DiffScope::Both,
            )
            .await
            .expect("show");
        assert!(patch.contains("+later"));
    }

    #[tokio::test]
    async fn discarding_a_session_takes_its_worktree_with_it() {
        let harness = Harness::start().await;
        init_repo(harness.root.path());

        let session = harness
            .manager
            .create(
                harness.project,
                "sh",
                None,
                TerminalSize::default(),
                Isolation::Worktree,
                None,
            )
            .await
            .expect("session");
        let path = std::path::PathBuf::from(&session.worktree.expect("worktree").path);

        harness.manager.close(session.id, WorktreeDisposal::Discard).await.expect("close");
        assert!(!path.exists());
    }

    #[tokio::test]
    async fn a_session_in_a_plain_folder_cannot_be_isolated() {
        let harness = Harness::start().await;
        assert!(
            harness
                .manager
                .create(
                harness.project,
                "sh",
                None,
                TerminalSize::default(),
                Isolation::Worktree,
                None,
            )
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn a_slow_command_does_not_hold_up_the_others() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;

        client.next += 1;
        let slow = RequestId(client.next);
        client
            .connection
            .send_control(&ClientMessage::Request {
                id: slow,
                command: Command::ReadMetrics { refresh_quota: true },
            })
            .await
            .expect("metrics");

        client.next += 1;
        let quick = RequestId(client.next);
        client
            .connection
            .send_control(&ClientMessage::Request { id: quick, command: Command::Ping })
            .await
            .expect("ping");

        let frame = timeout(Duration::from_secs(5), client.connection.recv())
            .await
            .expect("no timeout")
            .expect("frame")
            .expect("no error");
        match frame.parse_control::<ServerMessage>().expect("parse") {
            ServerMessage::Response { id, .. } => assert_eq!(id, quick),
            other => panic!("expected the ping answer first, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn a_project_tree_is_listed_and_read() {
        let harness = Harness::start().await;
        std::fs::create_dir(harness.root.path().join("src")).expect("src");
        std::fs::write(harness.root.path().join("src/main.rs"), "fn main() {}\n").expect("write");
        let mut client = harness.client().await;

        let Reply::Directory { entries } =
            client.request(Command::DirList { project: harness.project, path: String::new() }).await
        else {
            panic!("expected a directory");
        };
        assert_eq!(entries.len(), 1);
        assert!(entries[0].is_dir);

        let Reply::File { contents } = client
            .request(Command::FileRead {
                project: harness.project,
                path: "src/main.rs".into(),
            })
            .await
        else {
            panic!("expected a file");
        };
        assert_eq!(contents.text.as_deref(), Some("fn main() {}\n"));
    }

    #[tokio::test]
    async fn reading_outside_the_project_is_refused() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        client.next += 1;
        let id = RequestId(client.next);
        client
            .connection
            .send_control(&ClientMessage::Request {
                id,
                command: Command::FileRead {
                    project: harness.project,
                    path: "../../etc/hosts".into(),
                },
            })
            .await
            .expect("request");

        let frame = client.connection.recv().await.expect("frame").expect("no error");
        match frame.parse_control::<ServerMessage>().expect("parse") {
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                assert_eq!(error.code, ErrorCode::NotFound);
            }
            other => panic!("expected an error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn history_is_listed_across_agents_newest_first() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;

        let Reply::History { entries } =
            client.request(Command::ListHistory { project: harness.project }).await
        else {
            panic!("expected history");
        };
        assert!(entries.iter().all(|entry| entry.updated_at > 0 || entry.label.is_none()));
        assert!(
            entries.windows(2).all(|pair| pair[0].updated_at >= pair[1].updated_at),
            "history was not sorted"
        );
    }

    #[tokio::test]
    async fn resuming_an_agent_without_history_support_fails() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        client.next += 1;
        let id = RequestId(client.next);
        client
            .connection
            .send_control(&ClientMessage::Request {
                id,
                command: Command::SessionResume {
                    project: harness.project,
                    agent: "sh".into(),
                    session_id: "abc".into(),
                    size: TerminalSize::default(),
                },
            })
            .await
            .expect("request");

        let frame = client.connection.recv().await.expect("frame").expect("no error");
        match frame.parse_control::<ServerMessage>().expect("parse") {
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                assert_eq!(error.code, ErrorCode::Internal);
                assert!(error.message.contains("resume"));
            }
            other => panic!("expected an error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn a_layout_round_trips_through_the_protocol() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;

        let Reply::Layout { payload } =
            client.request(Command::LayoutLoad { project: harness.project }).await
        else {
            panic!("expected a layout");
        };
        assert_eq!(payload, None);

        client
            .request(Command::LayoutSave {
                project: harness.project,
                payload: "{\"tabs\":[]}".into(),
            })
            .await;

        let Reply::Layout { payload } =
            client.request(Command::LayoutLoad { project: harness.project }).await
        else {
            panic!("expected a layout");
        };
        assert_eq!(payload.as_deref(), Some("{\"tabs\":[]}"));
    }

    #[tokio::test]
    async fn a_session_carries_the_project_it_belongs_to() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;
        assert_eq!(session.project_id, harness.project);

        let Reply::Sessions { sessions } = client.request(Command::ListSessions).await else {
            panic!("expected session list");
        };
        assert_eq!(sessions[0].project_id, harness.project);
    }

    #[tokio::test]
    async fn a_session_defaults_to_the_project_root_as_its_cwd() {
        let harness = Harness::start().await;
        let session = harness
            .manager
            .create(
                harness.project,
                "sh",
                None,
                TerminalSize::default(),
                Isolation::Directory,
                None,
            )
            .await
            .expect("create");

        let root = harness
            .manager
            .list_projects()
            .await
            .expect("projects")
            .into_iter()
            .find(|project| project.id == harness.project)
            .expect("project")
            .root;
        assert_eq!(session.cwd, root);
    }

    #[tokio::test]
    async fn metrics_report_the_system_and_the_live_sessions() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;
        tokio::time::sleep(Duration::from_millis(400)).await;

        let Reply::Metrics { snapshot } =
            client.request(Command::ReadMetrics { refresh_quota: false }).await
        else {
            panic!("expected metrics");
        };

        assert!(snapshot.system.memory_total > 0.0, "missing total memory");
        assert!(snapshot.system.cores >= 1);

        let mine = snapshot
            .sessions
            .iter()
            .find(|usage| usage.id == session.id)
            .expect("session missing from metrics");
        assert!(mine.memory > 0.0, "session reports no memory");
        assert!(!mine.processes.is_empty());
        assert_eq!(mine.title, session.title);
    }

    #[tokio::test]
    async fn a_closed_session_disappears_from_the_metrics() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;
        client
            .request(Command::SessionClose { id: session.id, worktree: WorktreeDisposal::Keep })
            .await;

        let Reply::Metrics { snapshot } =
            client.request(Command::ReadMetrics { refresh_quota: false }).await
        else {
            panic!("expected metrics");
        };
        assert!(snapshot.sessions.iter().all(|usage| usage.id != session.id));
    }

    #[tokio::test]
    async fn a_provider_that_cannot_be_reached_does_not_hide_the_others() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;

        let Reply::Metrics { snapshot } =
            client.request(Command::ReadMetrics { refresh_quota: true }).await
        else {
            panic!("expected metrics");
        };

        let reported: Vec<&str> = snapshot.quotas.iter().map(|q| q.agent.as_str()).collect();
        assert!(reported.contains(&"answering"), "the working provider went missing");
        assert!(!reported.contains(&"unreachable"), "the failing provider should report nothing");

        let answering = snapshot
            .quotas
            .iter()
            .find(|report| report.agent == "answering")
            .expect("answering report");
        assert_eq!(answering.windows[0].used_percent, 42);
        assert_eq!(answering.windows[0].label.as_deref(), Some("5h"));

        assert!(snapshot.system.memory_total > 0.0, "system metrics broke alongside quota");
    }

    #[tokio::test]
    async fn killing_an_unknown_process_fails() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        client.next += 1;
        let id = RequestId(client.next);
        client
            .connection
            .send_control(&ClientMessage::Request {
                id,
                command: Command::KillProcess { pid: u32::MAX },
            })
            .await
            .expect("request");

        let frame = client.connection.recv().await.expect("frame").expect("no error");
        match frame.parse_control::<ServerMessage>().expect("parse") {
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                assert_eq!(error.code, ErrorCode::NotFound);
            }
            other => panic!("expected an error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn closing_a_session_removes_it() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        let session = client.create_shell(harness.project).await;

        client
            .request(Command::SessionClose { id: session.id, worktree: WorktreeDisposal::Keep })
            .await;
        assert!(harness.manager.list_sessions().await.is_empty());
    }

    #[tokio::test]
    async fn creating_a_session_for_an_unknown_agent_fails() {
        let harness = Harness::start().await;
        let mut client = harness.client().await;
        client.next += 1;
        let id = RequestId(client.next);
        client
            .connection
            .send_control(&ClientMessage::Request {
                id,
                command: Command::SessionCreate {
                    isolation: Isolation::Directory,
                    slug: None,
                    project: harness.project,
                    agent: "does-not-exist".into(),
                    cwd: None,
                    size: TerminalSize::default(),
                },
            })
            .await
            .expect("request");

        let frame = client.connection.recv().await.expect("frame").expect("no error");
        match frame.parse_control::<ServerMessage>().expect("parse") {
            ServerMessage::Response { outcome: CommandOutcome::Err { error }, .. } => {
                assert_eq!(error.code, ErrorCode::Internal);
            }
            other => panic!("expected an error, got {other:?}"),
        }
    }
}
