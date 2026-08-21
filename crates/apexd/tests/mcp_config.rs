mod common;

use apex_proto::{Isolation, TerminalSize, WorktreeDisposal};
use apexd::sessions::NewSession;
use common::{Harness, init_repo, manager_at};
use tokio::time::timeout;

#[tokio::test]
async fn an_agent_with_an_mcp_flag_is_handed_our_own_config() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let session = manager
        .create(NewSession {
            project,
            agent: "mcp-aware".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
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
    assert_eq!(server["args"], serde_json::json!(["mcp", "--session", session.id.to_string()]));

    let wanted = config.display().to_string();
    let echoed = timeout(std::time::Duration::from_secs(30), async {
        loop {
            let transcript = manager.transcript(session.id, 8192, false).await.expect("transcript");
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
async fn an_agent_that_wants_a_marked_path_gets_the_flag_prefixed() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let session = manager
        .create(NewSession {
            project,
            agent: "mcp-prefixed".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("session");

    let wanted = format!("@{}", paths.mcp_dir().join(format!("{}.json", session.id)).display());
    let echoed = timeout(std::time::Duration::from_secs(30), async {
        loop {
            let transcript = manager.transcript(session.id, 8192, false).await.expect("transcript");
            if transcript.contains(&wanted) {
                return transcript;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await;
    assert!(echoed.is_ok(), "the prefixed flag never reached the agent");
}

#[tokio::test]
async fn an_agent_configured_by_overrides_gets_them_on_its_command_line() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let session = manager
        .create(NewSession {
            project,
            agent: "mcp-overrides".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("session");

    let wanted = format!("mcp_servers.apex.args=[\"mcp\",\"--session\",\"{}\"]", session.id);
    let echoed = timeout(std::time::Duration::from_secs(30), async {
        loop {
            let transcript = manager.transcript(session.id, 8192, false).await.expect("transcript");
            if transcript.contains(&wanted) && transcript.contains("mcp_servers.apex.command=") {
                return transcript;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await;
    assert!(echoed.is_ok(), "the overrides never reached the agent");
}

#[tokio::test]
async fn an_agent_with_one_shared_config_gets_it_merged_and_taken_back_out() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let shared = home.path().join(".apex-test-shared-mcp.json");
    std::fs::write(&shared, r#"{"mcpServers":{"theirs":{"command":"keep-me"}}}"#).expect("seed");

    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let spawn = || async {
        manager
            .create(NewSession {
                project,
                agent: "mcp-shared".into(),
                cwd: None,
                size: TerminalSize::default(),
                isolation: Isolation::Directory,
                slug: None,
                mode: None,
                parent: None,
                run: None,
            })
            .await
            .expect("session")
    };
    let first = spawn().await;
    let second = spawn().await;

    let written: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&shared).expect("read")).expect("json");
    assert_eq!(written["mcpServers"]["theirs"]["command"], "keep-me");
    assert_eq!(written["mcpServers"]["apex"]["args"], serde_json::json!(["mcp"]));

    manager.close(first.id, WorktreeDisposal::Keep).await.expect("close");
    let midway: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&shared).expect("read")).expect("json");
    assert!(midway["mcpServers"]["apex"].is_object(), "the last session still needs it");

    manager.close(second.id, WorktreeDisposal::Keep).await.expect("close");
    let after: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&shared).expect("read")).expect("json");
    assert!(after["mcpServers"]["apex"].is_null(), "ours should be gone");
    assert_eq!(after["mcpServers"]["theirs"]["command"], "keep-me");
}

#[tokio::test]
async fn an_agent_without_a_flag_gets_its_config_in_the_folder_it_runs_in() {
    let home = tempfile::tempdir().expect("tempdir");
    let paths = apex_core::ApexPaths::rooted_at(home.path());
    let manager = manager_at(&paths);
    let root = tempfile::tempdir().expect("project");
    init_repo(root.path());
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let session = manager
        .create(NewSession {
            project,
            agent: "mcp-project".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
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

    let status = manager.git_status(project, apex_proto::GitTarget::Project).await.expect("status");
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
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let session = manager
        .create(NewSession {
            project,
            agent: "mcp-aware".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
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
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    let first = manager
        .create(NewSession {
            project,
            agent: "mcp-project".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
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
    let project =
        manager.open_project(&root.path().display().to_string()).await.expect("project").id;

    manager
        .create(NewSession {
            project,
            agent: "mcp-project".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
        })
        .await
        .expect("session");

    let kept = std::fs::read_to_string(root.path().join("opencode.json")).expect("read");
    assert_eq!(kept, "{\"mine\": true}");
}

#[tokio::test]
async fn adopting_an_agent_writes_apex_into_its_own_config_and_keeps_a_backup() {
    let harness = Harness::start().await;
    let config = std::env::temp_dir().join("apex-test-home/.pi/agent/mcp.json");
    std::fs::create_dir_all(config.parent().expect("parent")).expect("mkdir");
    std::fs::write(&config, r#"{"mcpServers":{"theirs":{"command":"echo"}}}"#).expect("write");

    let written = harness.manager.mcp_adopt("pi", true).await.expect("adopt");
    assert_eq!(written, config.display().to_string());

    let after: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&config).expect("read")).expect("json");
    assert!(after["mcpServers"]["apex"]["command"].is_string());
    assert_eq!(after["mcpServers"]["theirs"]["command"], "echo");

    let backup = config.with_extension("apex-backup");
    let kept: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&backup).expect("backup")).expect("json");
    assert!(kept["mcpServers"]["apex"].is_null());

    harness.manager.mcp_adopt("pi", false).await.expect("forget");
    let cleaned: serde_json::Value =
        serde_json::from_slice(&std::fs::read(&config).expect("read")).expect("json");
    assert!(cleaned["mcpServers"]["apex"].is_null());
    assert_eq!(cleaned["mcpServers"]["theirs"]["command"], "echo");
}
