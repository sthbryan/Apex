use std::collections::HashMap;
use std::sync::Arc;

use apex_proto::{
    ClientMessage, Command, Connection, ConnectionReader, ErrorCode, Frame, Hello,
    PROTOCOL_VERSION, ProtocolError, Reply, RequestId, Scope, ServerMessage, TransportError,
    Welcome,
};
use tokio::sync::mpsc;
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
    client.detach_all();
    drop(client);
    let _ = pump.await;
    tracing::info!(peer = %peer.label, "client disconnected");
}

struct Client {
    manager: Arc<SessionManager>,
    outbox: Outbox,
    scope: Scope,
    attached: HashMap<Uuid, JoinHandle<()>>,
}

impl Client {
    fn new(manager: Arc<SessionManager>, outbox: Outbox, scope: Scope) -> Self {
        Self { manager, outbox, scope, attached: HashMap::new() }
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

    async fn dispatch(&mut self, id: RequestId, command: Command) -> ServerMessage {
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

    async fn execute(&mut self, command: Command) -> Result<Reply, ProtocolError> {
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
            Command::SessionCreate { project, agent, cwd, size } => {
                let session = self
                    .manager
                    .create(project, &agent, cwd, size)
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
                self.detach(id);
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
            Command::SessionClose { id } => {
                self.detach(id);
                self.manager.close(id).await.map_err(not_found_error)?;
                Ok(Reply::Done)
            }
        }
    }

    async fn attach(&mut self, id: Uuid) -> Result<(), ProtocolError> {
        if self.attached.contains_key(&id) {
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

        self.attached.insert(id, handle);
        Ok(())
    }

    fn detach(&mut self, id: Uuid) {
        if let Some(handle) = self.attached.remove(&id) {
            handle.abort();
        }
    }

    fn detach_all(&mut self) {
        for (_, handle) in self.attached.drain() {
            handle.abort();
        }
    }
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
    use apex_core::{AgentProfile, BinaryResolver, ProfileSet, ShellEnvironment, Store};
    use apex_proto::{
        CommandOutcome, Listener, SessionSummary, TerminalSize, UnixTransport, connect_unix,
    };
    use std::path::PathBuf;
    use std::time::Duration;
    use tokio::time::timeout;

    const QUOTA_SAMPLE: &str =
        r#"[{"provider":"answering","usage":{"primary":{"windowMinutes":300,"usedPercent":42}}}]"#;

    fn manager() -> Arc<SessionManager> {
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

        Arc::new(SessionManager::new(profiles, resolver, Store::in_memory().expect("store")))
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
            .create(harness.project, "prompted", Some("/tmp".into()), TerminalSize::default())
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
            .create(harness.project, "prompted", Some("/tmp".into()), TerminalSize::default())
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
            .create(harness.project, "prompted", Some("/tmp".into()), TerminalSize::default())
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
                serde_json::json!({ "kind": "request", "id": id, "command": { "type": "from_the_future" } })
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
            .create(harness.project, "sh", None, TerminalSize::default())
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
        client.request(Command::SessionClose { id: session.id }).await;

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

        client.request(Command::SessionClose { id: session.id }).await;
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
