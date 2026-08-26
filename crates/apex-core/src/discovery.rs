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
        let search_path = env.get("PATH").map(|raw| split_path(raw)).unwrap_or_default();
        Self { env, search_path: with_fallback_roots(search_path), source }
    }

    pub fn from_search_path(search_path: Vec<PathBuf>) -> Self {
        let joined = search_path
            .iter()
            .map(|entry| entry.display().to_string())
            .collect::<Vec<_>>()
            .join(":");
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

    pub fn knows(&mut self, command: &str, path: PathBuf) {
        self.cache.insert(command.to_owned(), Some(path));
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
    let mut env = parse_env(&output.stdout);
    env.remove("TERM");
    env.remove("COLORTERM");
    Some(env)
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
#[path = "discovery_tests.rs"]
mod tests;
