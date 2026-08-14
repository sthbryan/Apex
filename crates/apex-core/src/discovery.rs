use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

const PROBE_TIMEOUT: Duration = Duration::from_secs(8);
const ENV_MARKER: &str = "APEX_ENV_BEGIN";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellEnvironment {
    env: BTreeMap<String, String>,
    search_path: Vec<PathBuf>,
    source: ProbeSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProbeSource {
    LoginInteractive,
    Login,
    InheritedPath,
}

impl ShellEnvironment {
    pub async fn probe() -> Self {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
        Self::probe_with_shell(Path::new(&shell)).await
    }

    pub async fn probe_with_shell(shell: &Path) -> Self {
        for (flags, source) in [
            (&["-l", "-i", "-c"][..], ProbeSource::LoginInteractive),
            (&["-l", "-c"][..], ProbeSource::Login),
        ] {
            if let Some(env) = run_env_probe(shell, flags).await
                && env.contains_key("PATH")
            {
                return Self::from_env(env, source);
            }
        }
        Self::from_env(inherited_env(), ProbeSource::InheritedPath)
    }

    pub fn from_env(env: BTreeMap<String, String>, source: ProbeSource) -> Self {
        let search_path = env
            .get("PATH")
            .map(|raw| split_path(raw))
            .unwrap_or_default();
        Self { env, search_path: with_fallback_roots(search_path), source }
    }

    pub fn from_search_path(search_path: Vec<PathBuf>) -> Self {
        let joined =
            search_path.iter().map(|entry| entry.display().to_string()).collect::<Vec<_>>().join(":");
        Self {
            env: BTreeMap::from([("PATH".to_string(), joined)]),
            search_path,
            source: ProbeSource::InheritedPath,
        }
    }

    pub fn source(&self) -> ProbeSource {
        self.source
    }

    pub fn search_path(&self) -> &[PathBuf] {
        &self.search_path
    }

    pub fn env(&self) -> &BTreeMap<String, String> {
        &self.env
    }

    pub fn lookup(&self, command: &str) -> Option<PathBuf> {
        let candidate = Path::new(command);
        if candidate.is_absolute() {
            return is_executable(candidate).then(|| candidate.to_path_buf());
        }
        self.search_path
            .iter()
            .map(|dir| dir.join(command))
            .find(|candidate| is_executable(candidate))
    }
}

#[derive(Debug, Default)]
pub struct BinaryResolver {
    environment: Option<ShellEnvironment>,
    cache: HashMap<String, Option<PathBuf>>,
}

impl BinaryResolver {
    pub async fn new() -> Self {
        Self { environment: Some(ShellEnvironment::probe().await), cache: HashMap::new() }
    }

    pub fn with_environment(environment: ShellEnvironment) -> Self {
        Self { environment: Some(environment), cache: HashMap::new() }
    }

    pub fn environment(&self) -> Option<&ShellEnvironment> {
        self.environment.as_ref()
    }

    pub fn resolve(&mut self, command: &str) -> Option<PathBuf> {
        if let Some(cached) = self.cache.get(command) {
            return cached.clone();
        }
        let resolved = self.environment.as_ref().and_then(|env| env.lookup(command));
        self.cache.insert(command.to_string(), resolved.clone());
        resolved
    }
}

const PROBE_SEED: &[&str] = &["HOME", "USER", "LOGNAME", "SHELL"];

fn probe_seed() -> BTreeMap<String, String> {
    let mut seed: BTreeMap<String, String> = PROBE_SEED
        .iter()
        .filter_map(|key| std::env::var(key).ok().map(|value| ((*key).to_string(), value)))
        .collect();
    seed.insert("TERM".into(), "dumb".into());
    seed
}

async fn run_env_probe(shell: &Path, flags: &[&str]) -> Option<BTreeMap<String, String>> {
    let mut command = Command::new(shell);
    command.args(flags).arg(format!("printf '%s\\0' {ENV_MARKER}; env -0"));
    command.stdin(std::process::Stdio::null());
    command.kill_on_drop(true);
    command.env_clear();
    command.envs(probe_seed());

    let output = timeout(PROBE_TIMEOUT, command.output()).await.ok()?.ok()?;
    if !output.status.success() {
        return None;
    }
    Some(parse_env(&output.stdout))
}

fn parse_env(raw: &[u8]) -> BTreeMap<String, String> {
    let text = String::from_utf8_lossy(raw);
    let body = match text.split_once(&format!("{ENV_MARKER}\0")) {
        Some((_, rest)) => rest,
        None => return BTreeMap::new(),
    };

    body.split('\0')
        .filter_map(|entry| entry.split_once('='))
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect()
}

fn split_path(raw: &str) -> Vec<PathBuf> {
    raw.split(':').filter(|entry| !entry.is_empty()).map(PathBuf::from).collect()
}

fn inherited_env() -> BTreeMap<String, String> {
    std::env::vars().collect()
}

const FALLBACK_ROOTS: &[&str] =
    &[".local/bin", ".claude/local", ".bun/bin", ".volta/bin", ".cargo/bin"];

fn with_fallback_roots(mut search_path: Vec<PathBuf>) -> Vec<PathBuf> {
    let Some(home) = directories::UserDirs::new() else {
        return search_path;
    };
    for root in FALLBACK_ROOTS {
        let candidate = home.home_dir().join(root);
        if candidate.is_dir() && !search_path.contains(&candidate) {
            search_path.push(candidate);
        }
    }
    search_path
}

fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path)
        .map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_finds_a_binary_on_the_search_path() {
        let env = ShellEnvironment::from_search_path(vec![PathBuf::from("/bin")]);
        assert_eq!(env.lookup("sh"), Some(PathBuf::from("/bin/sh")));
    }

    #[test]
    fn lookup_returns_none_for_a_missing_binary() {
        let env = ShellEnvironment::from_search_path(vec![PathBuf::from("/bin")]);
        assert_eq!(env.lookup("definitivamente-no-existe"), None);
    }

    #[test]
    fn lookup_accepts_an_absolute_path() {
        let env = ShellEnvironment::from_search_path(vec![]);
        assert_eq!(env.lookup("/bin/sh"), Some(PathBuf::from("/bin/sh")));
        assert_eq!(env.lookup("/bin/definitivamente-no-existe"), None);
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
        let raw = format!("{ENV_MARKER}\0PROMPT=linea1\nlinea2\0EXPR=a=b\0");
        let parsed = parse_env(raw.as_bytes());
        assert_eq!(parsed.get("PROMPT").map(String::as_str), Some("linea1\nlinea2"));
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
                "el seed no deberia incluir {key}"
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
        assert!(!env.env().contains_key(&candidate), "el probe heredo {candidate}");
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
        let env = ShellEnvironment::probe_with_shell(Path::new("/no/existe/shell")).await;
        assert_eq!(env.source(), ProbeSource::InheritedPath);
        assert!(!env.env().is_empty());
    }
}
