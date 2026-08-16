use super::*;
use crate::discovery::ShellEnvironment;
use std::path::PathBuf;

#[test]
fn every_builtin_profile_parses() {
    let set = ProfileSet::builtin().expect("builtin profiles");
    assert_eq!(set.len(), BUILTIN_PROFILES.len());
    for (name, _) in BUILTIN_PROFILES {
        assert!(set.get(name).is_some(), "missing profile {name}");
    }
}

#[test]
fn claude_declares_resume_and_acp() {
    let set = ProfileSet::builtin().expect("builtin profiles");
    let claude = set.get("claude").expect("claude");
    assert!(claude.supports_resume());
    assert_eq!(claude.acp_command.as_deref(), Some("npx"));
    assert!(!claude.state_patterns.blocked.is_empty());
}

#[test]
fn shell_profile_has_no_agent_machinery() {
    let set = ProfileSet::builtin().expect("builtin profiles");
    let shell = set.get("shell").expect("shell");
    assert!(!shell.supports_resume());
    assert!(shell.quota.is_none());
}

#[test]
fn a_user_profile_overrides_a_builtin_by_name() {
    let dir = tempfile::tempdir().expect("tempdir");
    std::fs::write(
        dir.path().join("claude.toml"),
        "name = \"claude\"\ncommand = \"/opt/my-claude\"\n",
    )
    .expect("write");

    let set = ProfileSet::load(dir.path()).expect("load");
    assert_eq!(set.len(), BUILTIN_PROFILES.len());
    assert_eq!(set.get("claude").expect("claude").command, "/opt/my-claude");
}

#[test]
fn a_user_profile_can_add_a_new_agent() {
    let dir = tempfile::tempdir().expect("tempdir");
    std::fs::write(
        dir.path().join("glm.toml"),
        "name = \"glm\"\ncommand = \"glm\"\nmode = \"pty\"\n",
    )
    .expect("write");

    let set = ProfileSet::load(dir.path()).expect("load");
    assert_eq!(set.len(), BUILTIN_PROFILES.len() + 1);
    assert_eq!(set.get("glm").expect("glm").mode, AgentMode::Pty);
}

#[test]
fn a_missing_agents_dir_leaves_the_builtins_intact() {
    let set = ProfileSet::load(Path::new("/no/such/agents")).expect("load");
    assert_eq!(set.len(), BUILTIN_PROFILES.len());
}

#[test]
fn an_invalid_user_profile_is_reported_with_its_path() {
    let dir = tempfile::tempdir().expect("tempdir");
    std::fs::write(dir.path().join("broken.toml"), "this is not valid toml = = =")
        .expect("write");

    let error = ProfileSet::load(dir.path()).expect_err("should fail");
    assert!(format!("{error:#}").contains("broken.toml"));
}

#[test]
fn summaries_mark_availability_from_the_resolver() {
    let env = ShellEnvironment::from_search_path(vec![PathBuf::from("/bin")]);
    let mut resolver = BinaryResolver::with_environment(env);
    let profile = AgentProfile::parse("name = \"sh\"\ncommand = \"sh\"\n").expect("profile");

    let summary = profile.summarize(&mut resolver);
    assert!(summary.is_available());
    assert_eq!(summary.resolved_path.as_deref(), Some("/bin/sh"));
}

#[test]
fn only_an_agent_whose_config_we_can_merge_into_shares_it() {
    let env = ShellEnvironment::from_search_path(vec![PathBuf::from("/bin")]);
    let mut resolver = BinaryResolver::with_environment(env);
    let builtin = ProfileSet::builtin().expect("builtin");

    let mut says = |wanted: &str| {
        builtin
            .iter()
            .find(|profile| profile.name == wanted)
            .map(|profile| profile.summarize(&mut resolver).shares_config)
    };

    assert_eq!(says("pi"), Some(true), "pi names a config we can merge into");
    assert_eq!(says("claude"), Some(false), "claude takes a flag but names no config");
    assert_eq!(says("opencode"), Some(false), "opencode only takes a project file");
    assert_eq!(says("shell"), Some(false), "shell has no config at all");
}
