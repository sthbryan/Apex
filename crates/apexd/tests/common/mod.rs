use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use apex_core::{AgentProfile, ApexPaths, BinaryResolver, ProfileSet, ShellEnvironment, Store};
use apex_proto::{
    ClientMessage, Command, CommandOutcome, Connection, Frame, Hello, Listener, PROTOCOL_VERSION,
    Reply, RequestId, ServerMessage, SessionState, SessionSummary, TerminalSize, UnixTransport,
    connect_unix,
};
use apexd::session::serve;
use apexd::sessions::SessionManager;
use tokio::time::timeout;
use uuid::Uuid;

const QUOTA_SAMPLE: &str =
    r#"[{"provider":"answering","usage":{"primary":{"windowMinutes":300,"usedPercent":42}}}]"#;

pub fn manager() -> Arc<SessionManager> {
    manager_at(&ApexPaths::rooted_at(&std::env::temp_dir().join("apex-test-home")))
}

pub fn manager_at(paths: &ApexPaths) -> Arc<SessionManager> {
    let mut profiles = ProfileSet::builtin().expect("profiles");
    profiles.upsert(AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("sh profile"));
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
    let acp = format!(
        "name = \"acp-agent\"\n\
         command = \"sh\"\n\
         mode = \"acp\"\n\
         acp_command = \"sh\"\n\
         acp_args = [\"{}/tests/fixtures/acp-agent.sh\"]\n",
        env!("CARGO_MANIFEST_DIR")
    );
    profiles.upsert(AgentProfile::parse(&acp).expect("acp profile"));
    profiles.upsert(
        AgentProfile::parse(
            "name = \"acp-mute\"\n\
             command = \"sh\"\n\
             mode = \"acp\"\n\
             acp_command = \"sh\"\n\
             acp_args = [\"-c\", \"echo 'cannot reach the model' >&2; exit 1\"]\n",
        )
        .expect("mute acp profile"),
    );
    profiles.upsert(
        AgentProfile::parse(
            "name = \"acp-mummy\"\n\
             command = \"sh\"\n\
             mode = \"acp\"\n\
             acp_command = \"sh\"\n\
             acp_args = [\"-c\", \"sleep 120\"]\n",
        )
        .expect("mummy acp profile"),
    );
    let quiet = format!(
        "name = \"acp-quiet\"\n\
         command = \"sh\"\n\
         mode = \"acp\"\n\
         acp_command = \"sh\"\n\
         acp_args = [\"{}/tests/fixtures/acp-quiet.sh\"]\n",
        env!("CARGO_MANIFEST_DIR")
    );
    profiles.upsert(AgentProfile::parse(&quiet).expect("quiet acp profile"));
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
            "name = \"mcp-prefixed\"\n\
             command = \"echo\"\n\
             [mcp]\n\
             kind = \"flag\"\n\
             flag = \"--additional-mcp-config\"\n\
             prefix = \"@\"\n",
        )
        .expect("prefixed mcp profile"),
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

    SessionManager::new(paths.clone(), profiles, resolver, Store::in_memory().expect("store"))
}

pub struct Harness {
    pub socket: PathBuf,
    pub manager: Arc<SessionManager>,
    pub project: Uuid,
    pub root: tempfile::TempDir,
}

impl Harness {
    pub async fn start() -> Self {
        let manager = manager();
        let root = tempfile::tempdir().expect("tempdir");
        let project =
            manager.open_project(&root.path().display().to_string()).await.expect("project").id;
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

    pub async fn client(&self) -> TestClient {
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

pub struct TestClient {
    pub connection: Connection,
    pub next: u64,
}

impl TestClient {
    pub async fn request(&mut self, command: Command) -> Reply {
        self.next += 1;
        let id = RequestId(self.next);
        self.connection
            .send_control(&ClientMessage::Request { id, command })
            .await
            .expect("request");

        let deadline = timeout(Duration::from_secs(10), async {
            loop {
                let frame = self.connection.recv().await.expect("frame").expect("no error");
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

    pub async fn create_shell(&mut self, project: Uuid) -> SessionSummary {
        let reply = self
            .request(Command::SessionCreate {
                mode: None,
                isolation: apex_proto::Isolation::Directory,
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

    pub async fn collect_output(&mut self, id: Uuid, needle: &str) -> String {
        let found = timeout(Duration::from_secs(10), async {
            let mut seen = Vec::new();
            loop {
                let frame = self.connection.recv().await.expect("frame").expect("no error");
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

pub fn init_repo(root: &std::path::Path) {
    for args in [
        &["init", "--initial-branch=main"][..],
        &["config", "user.email", "test@apex.dev"][..],
        &["config", "user.name", "Apex Test"][..],
    ] {
        std::process::Command::new("git").args(args).current_dir(root).output().expect("git");
    }
    std::fs::write(root.join("README.md"), "# sample\n").expect("readme");
    for args in [&["add", "."][..], &["commit", "-m", "first"][..]] {
        std::process::Command::new("git").args(args).current_dir(root).output().expect("git");
    }
}

pub async fn wait_for_state(manager: &Arc<SessionManager>, id: Uuid, wanted: SessionState) {
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
