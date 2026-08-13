use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellEnvironment {
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
            if let Some(path) = run_path_probe(shell, flags).await {
                let search_path = split_path(&path);
                if !search_path.is_empty() {
                    return Self { search_path: with_fallback_roots(search_path), source };
                }
            }
        }
        Self {
            search_path: with_fallback_roots(inherited_path()),
            source: ProbeSource::InheritedPath,
        }
    }

    pub fn from_search_path(search_path: Vec<PathBuf>) -> Self {
        Self { search_path, source: ProbeSource::InheritedPath }
    }

    pub fn source(&self) -> ProbeSource {
        self.source
    }

    pub fn search_path(&self) -> &[PathBuf] {
        &self.search_path
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

async fn run_path_probe(shell: &Path, flags: &[&str]) -> Option<String> {
    let mut command = Command::new(shell);
    command.args(flags).arg("printf %s \"$PATH\"");
    command.stdin(std::process::Stdio::null());
    command.kill_on_drop(true);

    let output = timeout(PROBE_TIMEOUT, command.output()).await.ok()?.ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let value = raw.lines().next_back()?.trim().to_string();
    (!value.is_empty()).then_some(value)
}

fn split_path(raw: &str) -> Vec<PathBuf> {
    raw.split(':').filter(|entry| !entry.is_empty()).map(PathBuf::from).collect()
}

fn inherited_path() -> Vec<PathBuf> {
    std::env::var("PATH").map(|raw| split_path(&raw)).unwrap_or_default()
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
        assert!(resolver.cache.contains_key("nada"));
    }

    #[tokio::test]
    async fn probing_a_real_shell_yields_a_usable_search_path() {
        let env = ShellEnvironment::probe_with_shell(Path::new("/bin/sh")).await;
        assert!(!env.search_path().is_empty());
        assert!(env.lookup("sh").is_some());
    }

    #[tokio::test]
    async fn probing_a_missing_shell_falls_back_to_the_inherited_path() {
        let env = ShellEnvironment::probe_with_shell(Path::new("/no/existe/shell")).await;
        assert_eq!(env.source(), ProbeSource::InheritedPath);
    }

    #[test]
    fn fallback_roots_are_appended_without_duplicates() {
        let Some(home) = directories::UserDirs::new() else {
            return;
        };
        let cargo = home.home_dir().join(".cargo/bin");
        if !cargo.is_dir() {
            return;
        }

        let merged = with_fallback_roots(vec![cargo.clone()]);
        assert_eq!(merged.iter().filter(|entry| **entry == cargo).count(), 1);
        assert!(!merged.is_empty());
    }
}
