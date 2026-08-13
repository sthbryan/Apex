use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

const MAX_SOCKET_PATH_BYTES: usize = 100;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApexPaths {
    pub config_dir: PathBuf,
    pub data_dir: PathBuf,
    pub socket: PathBuf,
}

impl ApexPaths {
    pub fn discover() -> Result<Self> {
        let home = directories::UserDirs::new()
            .context("no se pudo determinar el directorio home")?
            .home_dir()
            .to_path_buf();
        Ok(Self::rooted_at(&home))
    }

    pub fn rooted_at(home: &Path) -> Self {
        let config_dir = home.join(".apex");
        let data_dir = config_dir.join("data");
        let socket = pick_socket_path(&config_dir);
        Self { config_dir, data_dir, socket }
    }

    pub fn agents_dir(&self) -> PathBuf {
        self.config_dir.join("agents")
    }

    pub fn database(&self) -> PathBuf {
        self.data_dir.join("apex.sqlite")
    }

    pub fn ensure_dirs(&self) -> Result<()> {
        std::fs::create_dir_all(&self.data_dir)
            .with_context(|| format!("creando {}", self.data_dir.display()))?;
        std::fs::create_dir_all(self.agents_dir())
            .with_context(|| format!("creando {}", self.agents_dir().display()))?;
        if let Some(parent) = self.socket.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("creando {}", parent.display()))?;
        }
        Ok(())
    }
}

fn pick_socket_path(config_dir: &Path) -> PathBuf {
    let preferred = config_dir.join("run").join("d.sock");
    if preferred.as_os_str().len() <= MAX_SOCKET_PATH_BYTES {
        return preferred;
    }
    PathBuf::from("/tmp").join(format!("apex-{}", nix_uid())).join("d.sock")
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
    fn socket_falls_back_when_the_home_path_is_too_long() {
        let deep = PathBuf::from("/Users").join("x".repeat(120));
        let paths = ApexPaths::rooted_at(&deep);
        assert!(paths.socket.starts_with("/tmp"));
        assert!(paths.socket.as_os_str().len() <= MAX_SOCKET_PATH_BYTES);
    }
}
