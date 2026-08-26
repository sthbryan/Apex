use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

const MAX_SOCKET_PATH_BYTES: usize = 100;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApexPaths {
    pub home: PathBuf,
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    pub socket: PathBuf,
}

impl ApexPaths {
    pub fn discover() -> Result<Self> {
        Self::discover_with(std::env::var_os("APEX_HOME"))
    }

    pub fn discover_with(elsewhere: Option<std::ffi::OsString>) -> Result<Self> {
        if let Some(root) = elsewhere.filter(|root| !root.is_empty()) {
            return Ok(Self::rooted_at(Path::new(&root)));
        }
        let home = directories::UserDirs::new()
            .context("could not determine the home directory")?
            .home_dir()
            .to_path_buf();
        Ok(Self::rooted_at(&home))
    }

    pub fn rooted_at(home: &Path) -> Self {
        let config_dir = home.join(".apex");
        let data_dir = config_dir.join("data");
        let socket = pick_socket_path(&config_dir);
        Self { home: home.to_path_buf(), config_dir, data_dir, socket }
    }

    pub fn agents_dir(&self) -> PathBuf {
        self.config_dir.join("agents")
    }

    pub fn providers_dir(&self) -> PathBuf {
        self.config_dir.join("providers")
    }

    pub fn mcp_dir(&self) -> PathBuf {
        self.config_dir.join("run").join("mcp")
    }

    pub fn shots_dir(&self) -> PathBuf {
        self.config_dir.join("run").join("shots")
    }

    pub fn api_dir(&self, project: uuid::Uuid) -> PathBuf {
        self.config_dir.join("api").join(project.to_string())
    }

    pub fn database(&self) -> PathBuf {
        self.data_dir.join("apex.sqlite")
    }

    pub fn ensure_dirs(&self) -> Result<()> {
        std::fs::create_dir_all(&self.data_dir)
            .with_context(|| format!("creating {}", self.data_dir.display()))?;
        std::fs::create_dir_all(self.agents_dir())
            .with_context(|| format!("creating {}", self.agents_dir().display()))?;
        if let Some(parent) = self.socket.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("creating {}", parent.display()))?;
        }
        Ok(())
    }
}

fn pick_socket_path(config_dir: &Path) -> PathBuf {
    let preferred = config_dir.join("run").join("d.sock");
    if preferred.as_os_str().len() <= MAX_SOCKET_PATH_BYTES {
        return preferred;
    }
    let tag = fingerprint(config_dir.as_os_str().as_encoded_bytes());
    PathBuf::from("/tmp").join(format!("apex-{}-{tag}", nix_uid())).join("d.sock")
}

fn fingerprint(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

fn nix_uid() -> String {
    std::env::var("UID").unwrap_or_else(|_| {
        std::env::var("USER").map(|user| user.replace('/', "_")).unwrap_or_else(|_| "0".into())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_hangs_off_the_home_directory() {
        let paths = ApexPaths::rooted_at(Path::new("/Users/tester"));
        assert_eq!(paths.config_dir, PathBuf::from("/Users/tester/.apex"));
        assert_eq!(paths.agents_dir(), PathBuf::from("/Users/tester/.apex/agents"));
        assert_eq!(paths.database(), PathBuf::from("/Users/tester/.apex/data/apex.sqlite"));
        assert_eq!(paths.socket, PathBuf::from("/Users/tester/.apex/run/d.sock"));
    }

    #[test]
    fn a_named_root_moves_everything_including_the_socket() {
        let moved = ApexPaths::discover_with(Some("/Users/tester/dev".into())).expect("paths");

        assert_eq!(moved.config_dir, PathBuf::from("/Users/tester/dev/.apex"));
        assert_eq!(moved.database(), PathBuf::from("/Users/tester/dev/.apex/data/apex.sqlite"));
        assert_eq!(moved.socket, PathBuf::from("/Users/tester/dev/.apex/run/d.sock"));
    }

    #[test]
    fn an_empty_root_is_ignored_instead_of_landing_at_the_filesystem_root() {
        let real = ApexPaths::discover().expect("paths");
        let asked = ApexPaths::discover_with(Some("".into())).expect("paths");

        assert_eq!(asked, real);
    }

    #[test]
    fn two_roots_never_share_a_socket() {
        let one = ApexPaths::discover_with(Some("/Users/tester".into())).expect("paths");
        let other = ApexPaths::discover_with(Some("/Users/tester/dev".into())).expect("paths");

        assert_ne!(one.socket, other.socket);
        assert_ne!(one.database(), other.database());
    }

    #[test]
    fn socket_falls_back_when_the_home_path_is_too_long() {
        let deep = PathBuf::from("/Users").join("x".repeat(120));
        let paths = ApexPaths::rooted_at(&deep);
        assert!(paths.socket.starts_with("/tmp"));
        assert!(paths.socket.as_os_str().len() <= MAX_SOCKET_PATH_BYTES);
    }

    #[test]
    fn two_deep_roots_do_not_land_on_the_same_fallback_socket() {
        let one = ApexPaths::rooted_at(&PathBuf::from("/Users").join("x".repeat(120)));
        let other = ApexPaths::rooted_at(&PathBuf::from("/Users").join("y".repeat(120)));

        assert!(one.socket.starts_with("/tmp"));
        assert!(other.socket.starts_with("/tmp"));
        assert_ne!(one.socket, other.socket);
    }

    #[test]
    fn a_deep_root_keeps_the_same_socket_every_time_it_is_asked() {
        let deep = PathBuf::from("/Users").join("z".repeat(120));

        assert_eq!(ApexPaths::rooted_at(&deep).socket, ApexPaths::rooted_at(&deep).socket);
    }
}
