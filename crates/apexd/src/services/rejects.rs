use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use apex_proto::RejectedHunk;
use uuid::Uuid;

const KEEP: usize = 30;
const TTL_MILLIS: u128 = 30 * 24 * 60 * 60 * 1000;

pub struct RejectsService {
    root: PathBuf,
}

impl RejectsService {
    pub fn new(data_dir: &Path) -> Self {
        Self { root: data_dir.join("rejected") }
    }

    fn shelf(&self, project: Uuid, branch: &str) -> PathBuf {
        self.root.join(project.to_string()).join(apex_git::slugify(branch))
    }

    pub async fn reject(
        &self,
        dir: &Path,
        project: Uuid,
        branch: &str,
        patch: String,
    ) -> Result<()> {
        let shelf = self.shelf(project, branch);
        let dir = dir.to_path_buf();
        tokio::task::spawn_blocking(move || {
            apex_git::apply_to_worktree(&dir, &patch, true)?;
            std::fs::create_dir_all(&shelf)
                .with_context(|| format!("creating {}", shelf.display()))?;
            let stamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            std::fs::write(shelf.join(format!("{stamp}.patch")), &patch)
                .context("saving the rejected hunk")?;
            prune(&shelf, now_millis());
            Ok(())
        })
        .await?
    }

    pub async fn list(&self, project: Uuid, branch: &str) -> Result<Vec<RejectedHunk>> {
        let shelf = self.shelf(project, branch);
        tokio::task::spawn_blocking(move || Ok(read_shelf(&shelf))).await?
    }

    pub async fn restore(&self, dir: &Path, project: Uuid, branch: &str, id: &str) -> Result<()> {
        let file = self.shelf(project, branch).join(format!("{id}.patch"));
        let dir = dir.to_path_buf();
        tokio::task::spawn_blocking(move || {
            let patch = std::fs::read_to_string(&file)
                .with_context(|| format!("{} is no longer there", file.display()))?;
            apex_git::apply_to_worktree(&dir, &patch, false)?;
            std::fs::remove_file(&file).ok();
            Ok(())
        })
        .await?
    }

    pub async fn sweep(&self) {
        let Ok(projects) = std::fs::read_dir(&self.root) else {
            return;
        };
        let now = now_millis();
        for project in projects.flatten() {
            let Ok(shelves) = std::fs::read_dir(project.path()) else {
                continue;
            };
            for shelf in shelves.flatten() {
                prune(&shelf.path(), now);
                std::fs::remove_dir(shelf.path()).ok();
            }
            std::fs::remove_dir(project.path()).ok();
        }
    }

    pub async fn clear(&self, project: Uuid, branch: &str) -> Result<()> {
        let shelf = self.shelf(project, branch);
        tokio::task::spawn_blocking(move || {
            if shelf.exists() {
                std::fs::remove_dir_all(&shelf)
                    .with_context(|| format!("clearing {}", shelf.display()))?;
            }
            Ok(())
        })
        .await?
    }
}

fn stems(shelf: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(shelf) else {
        return Vec::new();
    };
    let mut found: Vec<String> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            (path.extension()? == "patch")
                .then(|| path.file_stem()?.to_str().map(str::to_owned))
                .flatten()
        })
        .collect();
    found.sort();
    found
}

fn read_shelf(shelf: &Path) -> Vec<RejectedHunk> {
    stems(shelf)
        .into_iter()
        .rev()
        .filter_map(|id| {
            let patch = std::fs::read_to_string(shelf.join(format!("{id}.patch"))).ok()?;
            let (added, removed) = apex_git::patch_counts(&patch);
            Some(RejectedHunk {
                at: id.parse().unwrap_or_default(),
                path: apex_git::patch_path(&patch).unwrap_or_default(),
                id,
                added,
                removed,
            })
        })
        .collect()
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn prune(shelf: &Path, now: u128) {
    let found = stems(shelf);
    let extra = found.len().saturating_sub(KEEP);
    for (index, id) in found.iter().enumerate() {
        let aged = id.parse::<u128>().is_ok_and(|at| now.saturating_sub(at) > TTL_MILLIS);
        if index < extra || aged {
            std::fs::remove_file(shelf.join(format!("{id}.patch"))).ok();
        }
    }
}

pub fn require_branch(branch: &str) -> Result<&str> {
    if branch.trim().is_empty() {
        bail!("this target has no branch to file its rejects under")
    }
    Ok(branch)
}
