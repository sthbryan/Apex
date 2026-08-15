mod common;

use apexd::sessions::NewSession;
use apex_proto::{
    ClientMessage, Command, CommandOutcome, DiffScope, ErrorCode, Frame, GitTarget, Isolation,
    Reply, RequestId, ServerMessage, SessionState, TerminalSize, WorktreeDisposal,
};
use common::{Harness, init_repo, manager_at, wait_for_state};
use tokio::time::timeout;

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

#[tokio::test]
async fn a_prompt_moves_the_session_to_blocked() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "prompted".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    wait_for_state(&harness.manager, session.id, SessionState::Blocked).await;
}

#[tokio::test]
async fn a_state_change_is_announced_as_an_event() {
    let harness = Harness::start().await;
    let mut events = harness.manager.subscribe();

    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "prompted".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    let announced = timeout(std::time::Duration::from_secs(10), async {
        loop {
            match events.recv().await {
                Ok(apex_proto::Event::SessionStateChanged { id, state })
                    if id == session.id && state == SessionState::Blocked =>
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

    wait_for_state(&harness.manager, session.id, SessionState::Idle).await;
}

#[tokio::test]
async fn answering_the_prompt_moves_the_session_back_to_working() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "prompted".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");
    wait_for_state(&harness.manager, session.id, SessionState::Blocked).await;

    harness.manager.write(session.id, "still writing\n").await.expect("input");
    wait_for_state(&harness.manager, session.id, SessionState::Working).await;
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

#[tokio::test]
async fn an_isolated_session_runs_in_its_own_worktree() {
    let harness = Harness::start().await;
    init_repo(harness.root.path());

    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
        })
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
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    let project = manager
        .open_project(&root.path().display().to_string())
        .await
        .expect("project")
        .id;

    let session = manager
        .create(NewSession { project, agent: "mcp-aware".into(), cwd: None, size: TerminalSize::default(), isolation: Isolation::Directory, slug: None, mode: None })
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
    let echoed = timeout(std::time::Duration::from_secs(10), async {
        loop {
            let transcript = manager.transcript(session.id, 8192).await.expect("transcript");
            if transcript.contains(&wanted) {
                return transcript;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await;
    assert!(echoed.is_ok(), "the flag never reached the agent");
}

#[tokio::test]
async fn an_agent_without_a_flag_gets_its_config_in_the_folder_it_runs_in() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    init_repo(root.path());
    let project = manager
        .open_project(&root.path().display().to_string())
        .await
        .expect("project")
        .id;

    let session = manager
        .create(NewSession {
            project,
            agent: "mcp-project".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
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

    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    let project = manager
        .open_project(&root.path().display().to_string())
        .await
        .expect("project")
        .id;

    let session = manager
        .create(NewSession { project, agent: "mcp-aware".into(), cwd: None, size: TerminalSize::default(), isolation: Isolation::Directory, slug: None, mode: None })
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
async fn the_config_left_in_a_folder_does_not_name_a_session() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    init_repo(root.path());
    let project = manager
        .open_project(&root.path().display().to_string())
        .await
        .expect("project")
        .id;

    let first = manager
        .create(NewSession {
            project,
            agent: "mcp-project".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("session");

    let written: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.path().join("opencode.json")).expect("read"))
            .expect("json");
    let command = written["mcp"]["apex"]["command"].as_array().expect("command");
    let spelled: Vec<&str> = command.iter().filter_map(|arg| arg.as_str()).collect();

    assert_eq!(spelled[1..], ["mcp"], "a session id here goes stale on the next one");
    assert!(!spelled.iter().any(|arg| arg.contains(&first.id.to_string())));
}

#[tokio::test]
async fn a_config_the_project_already_has_is_never_overwritten() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    std::fs::write(root.path().join("opencode.json"), "{\"mine\": true}").expect("write");
    let project = manager
        .open_project(&root.path().display().to_string())
        .await
        .expect("project")
        .id;

    manager
        .create(NewSession {
            project,
            agent: "mcp-project".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("session");

    let kept = std::fs::read_to_string(root.path().join("opencode.json")).expect("read");
    assert_eq!(kept, "{\"mine\": true}");
}

#[tokio::test]
async fn a_task_runs_as_a_session_and_will_not_run_twice() {
    let harness = Harness::start().await;
    std::fs::write(
        harness.root.path().join("package.json"),
        r#"{"scripts":{"greet":"echo hola-desde-la-tarea"}}"#,
    )
    .expect("write");
    let mut client = harness.client().await;

    let Reply::Tasks { tasks } =
        client.request(Command::ListTasks { project: harness.project }).await
    else {
        panic!("expected the task list");
    };
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].name, "greet");
    assert_eq!(tasks[0].source, "package.json");

    let session = harness
        .manager
        .run_task(harness.project, "greet", "echo hola-desde-la-tarea", TerminalSize::default())
        .await
        .expect("task");
    assert_eq!(session.task.as_deref(), Some("greet"));
    assert_eq!(session.title, "greet");

    assert!(
        harness
            .manager
            .run_task(harness.project, "greet", "echo otra vez", TerminalSize::default())
            .await
            .is_err(),
        "the same task should not be started twice"
    );

    let printed = timeout(std::time::Duration::from_secs(10), async {
        loop {
            let text = harness.manager.transcript(session.id, 4096).await.expect("transcript");
            if text.contains("hola-desde-la-tarea") {
                return text;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await;
    assert!(printed.is_ok(), "the task never ran");

    harness.manager.close(session.id, WorktreeDisposal::Keep).await.expect("close");
    harness
        .manager
        .run_task(harness.project, "greet", "echo de nuevo", TerminalSize::default())
        .await
        .expect("a finished task can run again");
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
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
        })
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
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
        })
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
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Worktree,
            slug: None,
            mode: None,
        })
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
            .create(NewSession {
                project: harness.project,
                agent: "sh".into(),
                cwd: None,
                size: TerminalSize::default(),
                isolation: Isolation::Worktree,
                slug: None,
                mode: None,
            })
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

    let frame = timeout(std::time::Duration::from_secs(5), client.connection.recv())
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
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
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
    tokio::time::sleep(std::time::Duration::from_millis(400)).await;

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
                mode: None,
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

#[tokio::test]
async fn an_acp_session_streams_its_answer_and_waits_for_permission() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    assert_eq!(session.mode, apex_proto::AgentMode::Acp);
    assert!(harness.manager.acp_snapshot(session.id).await.expect("transcript").entries.is_empty());

    harness.manager.acp_prompt(session.id, "change hello".into()).await.expect("prompt");
    wait_for_state(&harness.manager, session.id, SessionState::Blocked).await;

    let snapshot = harness.manager.acp_snapshot(session.id).await.expect("transcript");
    assert_eq!(snapshot.commands.len(), 1);
    assert_eq!(snapshot.commands[0].name, "compact");
    assert_eq!(snapshot.commands[0].description, "Shrink the context");
    let entries = snapshot.entries;
    assert_eq!(entries[0].body, apex_proto::AcpBody::User { text: "change hello".into() });
    assert_eq!(entries[1].body, apex_proto::AcpBody::Agent { text: "on it".into() });

    let apex_proto::AcpBody::Tool { call } = &entries[2].body else {
        panic!("expected a tool call, got {:?}", entries[2].body);
    };
    assert_eq!(call.diffs[0].new_text, "two");
    assert_eq!(call.status, apex_proto::AcpToolStatus::Running);

    let apex_proto::AcpBody::Permission { ask } = &entries[3].body else {
        panic!("expected a permission, got {:?}", entries[3].body);
    };
    assert_eq!(ask.decided, None);
    assert_eq!(ask.options[0].id, "allow_once");

    harness
        .manager
        .acp_decide(session.id, ask.request, Some("allow_once".into()))
        .await
        .expect("decide");
    wait_for_state(&harness.manager, session.id, SessionState::Done).await;

    let settled = harness.manager.acp_snapshot(session.id).await.expect("transcript").entries;
    let apex_proto::AcpBody::Permission { ask } = &settled[3].body else {
        panic!("expected a permission");
    };
    assert_eq!(ask.decided.as_deref(), Some("allow_once"));

    let apex_proto::AcpBody::Tool { call } = &settled[2].body else {
        panic!("expected a tool call");
    };
    assert_eq!(call.status, apex_proto::AcpToolStatus::Completed);
    assert_eq!(call.diffs[0].new_text, "two");
    assert_eq!(settled.len(), 4);
}

#[tokio::test]
async fn an_acp_agent_that_dies_leaves_its_session_marked_as_finished() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    harness.manager.acp_prompt(session.id, "walk out".into()).await.expect("prompt");
    wait_for_state(&harness.manager, session.id, SessionState::Done).await;

    let listed = harness.manager.list_sessions().await;
    let found = listed.iter().find(|candidate| candidate.id == session.id).expect("the session");
    assert_eq!(found.exit_code, Some(3));
    assert!(!found.is_alive());
}

#[tokio::test]
async fn closing_an_acp_session_stops_its_agent_and_forgets_it() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    assert!(harness.manager.list_sessions().await.iter().any(|found| found.id == session.id));

    harness
        .manager
        .close(session.id, apex_proto::WorktreeDisposal::Keep)
        .await
        .expect("close");

    assert!(!harness.manager.list_sessions().await.iter().any(|found| found.id == session.id));
    assert!(harness.manager.acp_snapshot(session.id).await.is_err());
}

#[tokio::test]
async fn an_acp_session_is_handed_the_apex_mcp_server() {
    let room = tempfile::tempdir().expect("tempdir");
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some(room.path().display().to_string()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    let seen = std::fs::read_to_string(room.path().join("session-new.json"))
        .expect("the agent recorded session/new");
    assert!(seen.contains("\"name\":\"apex\""), "no apex server in {seen}");
    assert!(seen.contains("\"type\":\"http\""), "this agent takes http, got {seen}");
    assert!(seen.contains("http://127.0.0.1:"), "no local url in {seen}");
    assert!(seen.contains("Bearer "), "no token in {seen}");
    let _ = session;
}

#[tokio::test]
async fn an_acp_agent_that_never_greets_leaves_no_session_behind() {
    let harness = Harness::start().await;
    let failure = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-mute".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect_err("the handshake cannot succeed");

    let told = format!("{failure:#}");
    assert!(told.contains("cannot reach the model"), "the agent complaint is missing from {told}");
    assert!(harness.manager.list_sessions().await.is_empty());
}

#[tokio::test]
async fn an_agent_that_takes_its_time_to_greet_does_not_freeze_the_rest() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;

    client.next += 1;
    let id = RequestId(client.next);
    client
        .connection
        .send_control(&ClientMessage::Request {
            id,
            command: Command::SessionCreate {
                mode: None,
                isolation: Isolation::Directory,
                slug: None,
                project: harness.project,
                agent: "acp-mummy".into(),
                cwd: Some("/tmp".into()),
                size: TerminalSize::default(),
            },
        })
        .await
        .expect("the slow request");

    assert_eq!(client.request(Command::Ping).await, Reply::Pong);
    assert_eq!(client.request(Command::ListSessions).await, Reply::Sessions { sessions: vec![] });
}

#[tokio::test]
async fn an_agent_that_answers_nothing_says_so_in_the_transcript() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-quiet".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    harness.manager.acp_prompt(session.id, "are you there".into()).await.expect("prompt");
    wait_for_state(&harness.manager, session.id, SessionState::Done).await;

    let entries = harness.manager.acp_snapshot(session.id).await.expect("transcript").entries;
    let apex_proto::AcpBody::Notice { text } = &entries[1].body else {
        panic!("expected a notice, got {:?}", entries[1].body);
    };
    assert!(text.contains("without saying anything"), "unhelpful notice: {text}");
    assert!(text.contains("opencode auth login"), "the sign in hint is missing from {text}");
}

#[tokio::test]
async fn the_models_an_acp_agent_offers_can_be_switched() {
    let harness = Harness::start().await;
    let session = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some("/tmp".into()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    let models = harness.manager.acp_snapshot(session.id).await.expect("snapshot").models;
    assert_eq!(models.chosen.as_deref(), Some("fast"));
    assert_eq!(models.choices.len(), 2);
    assert_eq!(models.choices[1].name, "Deep");

    harness.manager.acp_choose(session.id, Some("deep".into()), None).await.expect("choose");
    let after = harness.manager.acp_snapshot(session.id).await.expect("snapshot").models;
    assert_eq!(after.chosen.as_deref(), Some("deep"));
}

#[tokio::test]
async fn the_http_mcp_endpoint_turns_away_a_caller_without_the_token() {
    let room = tempfile::tempdir().expect("tempdir");
    let harness = Harness::start().await;
    harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "acp-agent".into(),
            cwd: Some(room.path().display().to_string()),
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
        })
        .await
        .expect("create");

    let seen = std::fs::read_to_string(room.path().join("session-new.json")).expect("session/new");
    let offered: serde_json::Value = serde_json::from_str(&seen).expect("json");
    let url = offered["params"]["mcpServers"][0]["url"].as_str().expect("a url").to_owned();
    let port: u16 = url.rsplit(':').next().unwrap().trim_end_matches("/mcp").parse().expect("port");

    let body = serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }).to_string();
    let refused = ask(port, "not-a-token", &body).await;
    assert!(refused.contains("401"), "an unknown token got in: {refused}");
}

async fn ask(port: u16, token: &str, body: &str) -> String {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.expect("connect");
    let request = format!(
        "POST /mcp HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes()).await.expect("write");
    let mut answered = String::new();
    stream.read_to_string(&mut answered).await.expect("read");
    answered
}
