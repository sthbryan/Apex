use super::*;

#[test]
fn lookup_finds_a_binary_on_the_search_path() {
    let env = ShellEnvironment::from_search_path(vec![PathBuf::from("/bin")]);
    assert_eq!(env.lookup("sh"), Some(PathBuf::from("/bin/sh")));
}

#[test]
fn lookup_returns_none_for_a_missing_binary() {
    let env = ShellEnvironment::from_search_path(vec![PathBuf::from("/bin")]);
    assert_eq!(env.lookup("definitely-does-not-exist"), None);
}

#[test]
fn lookup_accepts_an_absolute_path() {
    let env = ShellEnvironment::from_search_path(vec![]);
    assert_eq!(env.lookup("/bin/sh"), Some(PathBuf::from("/bin/sh")));
    assert_eq!(env.lookup("/bin/definitely-does-not-exist"), None);
}

#[test]
fn resolver_caches_both_hits_and_misses() {
    let env = ShellEnvironment::from_search_path(vec![PathBuf::from("/bin")]);
    let mut resolver = BinaryResolver::with_environment(env);
    assert_eq!(resolver.resolve("sh"), Some(PathBuf::from("/bin/sh")));
    assert_eq!(resolver.resolve("nada"), None);
    assert_eq!(resolver.cache.len(), 2);
}

#[test]
fn env_output_is_parsed_after_the_marker() {
    let raw = format!("ruido de zshrc\n{ENV_MARKER}\0PATH=/bin:/usr/bin\0HOME=/Users/x\0");
    let parsed = parse_env(raw.as_bytes());
    assert_eq!(parsed.get("PATH").map(String::as_str), Some("/bin:/usr/bin"));
    assert_eq!(parsed.get("HOME").map(String::as_str), Some("/Users/x"));
    assert_eq!(parsed.len(), 2);
}

#[test]
fn env_values_may_contain_newlines_and_equals() {
    let raw = format!("{ENV_MARKER}\0PROMPT=line1\nline2\0EXPR=a=b\0");
    let parsed = parse_env(raw.as_bytes());
    assert_eq!(parsed.get("PROMPT").map(String::as_str), Some("line1\nline2"));
    assert_eq!(parsed.get("EXPR").map(String::as_str), Some("a=b"));
}

#[test]
fn output_without_the_marker_yields_nothing() {
    assert!(parse_env(b"PATH=/bin\0").is_empty());
}

#[test]
fn the_probe_seed_carries_only_identity_and_a_dumb_terminal() {
    let seed = probe_seed();
    assert_eq!(seed.get("TERM").map(String::as_str), Some("dumb"));
    for key in seed.keys() {
        assert!(
            key == "TERM" || PROBE_SEED.contains(&key.as_str()),
            "seed should not include {key}"
        );
    }
}

#[tokio::test]
async fn the_probe_does_not_inherit_the_parent_environment() {
    const SHELL_PROVIDES: &[&str] =
        &["PATH", "PWD", "SHLVL", "_", "OLDPWD", "TERM", "TMPDIR", "IFS"];

    let Some(candidate) = std::env::vars().map(|(key, _)| key).find(|key| {
        !PROBE_SEED.contains(&key.as_str()) && !SHELL_PROVIDES.contains(&key.as_str())
    }) else {
        return;
    };

    let env = ShellEnvironment::probe_with_shell(Path::new("/bin/sh")).await;
    if env.source() == ProbeSource::InheritedPath {
        return;
    }
    assert!(!env.env().contains_key(&candidate), "probe inherited {candidate}");
}

#[tokio::test]
async fn the_probe_does_not_hand_back_its_dumb_terminal() {
    let env = ShellEnvironment::probe_with_shell(Path::new("/bin/sh")).await;
    if env.source() == ProbeSource::InheritedPath {
        return;
    }
    assert!(!env.env().contains_key("TERM"));
}

#[tokio::test]
async fn probing_a_real_shell_captures_the_whole_environment() {
    let env = ShellEnvironment::probe_with_shell(Path::new("/bin/sh")).await;
    assert!(!env.search_path().is_empty());
    assert!(env.lookup("sh").is_some());
    assert!(env.env().contains_key("PATH"));
    assert!(env.env().contains_key("HOME"));
}

#[tokio::test]
async fn probing_a_missing_shell_falls_back_to_the_inherited_environment() {
    let env = ShellEnvironment::probe_with_shell(Path::new("/no/such/shell")).await;
    assert_eq!(env.source(), ProbeSource::InheritedPath);
    assert!(!env.env().is_empty());
}
