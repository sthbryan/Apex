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
    std::fs::write(dir.path().join("broken.toml"), "this is not valid toml = = =").expect("write");

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

#[test]
fn a_command_falls_back_when_the_variable_it_names_is_unset() {
    let profile = AgentProfile::parse("name = \"t\"\ncommand = \"${APEX_UNSET_SHELL:-/bin/sh}\"\n")
        .expect("t");
    assert_eq!(profile.launch_command(), "/bin/sh");
}

#[test]
fn a_command_takes_the_variable_when_it_is_set() {
    let home = std::env::var("HOME").expect("HOME");
    let profile = AgentProfile::parse("name = \"t\"\ncommand = \"${HOME:-/bin/sh}\"\n").expect("t");
    assert_eq!(profile.launch_command(), home);
}

#[test]
fn a_plain_command_is_left_alone() {
    let profile = AgentProfile::parse("name = \"t\"\ncommand = \"claude\"\n").expect("t");
    assert_eq!(profile.launch_command(), "claude");
}

#[test]
fn apex_is_one_of_the_agents_it_can_run() {
    let set = ProfileSet::builtin().expect("builtin");
    let ours = set.get("apex").expect("apex");
    assert_eq!(ours.mode, AgentMode::Acp);
    assert_eq!(ours.acp_command.as_deref(), Some("apexd"));
    assert_eq!(ours.acp_args, vec!["agent".to_owned(), "--acp".to_owned()]);
    assert!(ours.agentic);
}

#[test]
fn a_command_the_resolver_is_told_about_needs_no_looking_up() {
    let mut resolver = BinaryResolver::default();
    assert_eq!(resolver.resolve("apexd"), None);

    let mut resolver = BinaryResolver::default();
    resolver.knows("apexd", std::path::PathBuf::from("/opt/apex/apexd"));
    assert_eq!(resolver.resolve("apexd"), Some(std::path::PathBuf::from("/opt/apex/apexd")));
}

#[test]
fn apex_shows_as_available_once_the_resolver_knows_where_it_is() {
    let set = ProfileSet::builtin().expect("builtin");
    let mut resolver = BinaryResolver::default();
    resolver.knows("apexd", std::path::PathBuf::from("/opt/apex/apexd"));
    let summary = set.get("apex").expect("apex").summarize(&mut resolver);
    assert!(summary.is_available());
    assert!(summary.speaks_acp);
}
