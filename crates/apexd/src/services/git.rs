use std::path::Path;

use anyhow::{Result, bail};
use apex_proto::{
    DiffScope, GitChange, GitCommit, GitStatus, GitSyncOp, MergeReport, WorktreeEntry,
};

pub struct GitService;

impl GitService {
    pub async fn status(&self, dir: &Path, root: &Path) -> Result<GitStatus> {
        let dir = dir.to_path_buf();
        let root = root.to_path_buf();
        let isolated = dir != root;
        tokio::task::spawn_blocking(move || {
            if !apex_git::is_repo(&dir) {
                bail!("{} is not a git repository", dir.display())
            }
            let upstream = apex_git::upstream(&dir);
            Ok(GitStatus {
                upstream: upstream.as_ref().map(|remote| remote.name.clone()),
                ahead: upstream.as_ref().map(|remote| remote.ahead).unwrap_or_default(),
                behind: upstream.map(|remote| remote.behind).unwrap_or_default(),
                branch: apex_git::current_branch(&dir)?,
                base: apex_git::current_branch(&root).unwrap_or_default(),
                changes: apex_git::status(&dir)?
                    .into_iter()
                    .map(|change| GitChange {
                        path: change.path,
                        kind: kind_name(change.kind).to_owned(),
                        staged: change.staged,
                        added: change.added,
                        removed: change.removed,
                    })
                    .collect(),
                isolated,
            })
        })
        .await?
    }

    pub async fn diff(
        &self,
        dir: &Path,
        path: &str,
        commit: Option<String>,
        scope: DiffScope,
    ) -> Result<String> {
        let dir = dir.to_path_buf();
        let path = path.to_owned();
        tokio::task::spawn_blocking(move || match commit {
            Some(commit) => {
                apex_git::show(&dir, &commit, (!path.is_empty()).then_some(path.as_str()))
            }
            None => apex_git::diff_scoped(&dir, &path, scope_of(scope)),
        })
        .await?
    }

    pub async fn hunks(&self, dir: &Path, path: &str, scope: DiffScope) -> Result<Vec<String>> {
        let dir = dir.to_path_buf();
        let path = path.to_owned();
        tokio::task::spawn_blocking(move || {
            Ok(apex_git::split_hunks(&apex_git::diff_scoped(&dir, &path, scope_of(scope))?))
        })
        .await?
    }

    pub async fn stage(&self, dir: &Path, paths: Vec<String>, staged: bool) -> Result<()> {
        let dir = dir.to_path_buf();
        tokio::task::spawn_blocking(move || {
            if staged { apex_git::stage(&dir, &paths) } else { apex_git::unstage(&dir, &paths) }
        })
        .await?
    }

    pub async fn stage_hunk(&self, dir: &Path, patch: String, staged: bool) -> Result<()> {
        let dir = dir.to_path_buf();
        tokio::task::spawn_blocking(move || apex_git::apply_to_index(&dir, &patch, !staged)).await?
    }

    pub async fn commit(&self, dir: &Path, message: String) -> Result<GitCommit> {
        let dir = dir.to_path_buf();
        let commit =
            tokio::task::spawn_blocking(move || apex_git::commit(&dir, &message)).await??;
        Ok(GitCommit {
            id: commit.id,
            short: commit.short,
            author: commit.author,
            when: commit.when,
            summary: commit.summary,
            refs: commit.refs,
        })
    }

    pub async fn sync(&self, dir: &Path, op: GitSyncOp) -> Result<()> {
        let dir = dir.to_path_buf();
        tokio::task::spawn_blocking(move || apex_git::sync(&dir, sync_of(op))).await?
    }

    pub async fn log(&self, dir: &Path, limit: usize) -> Result<Vec<GitCommit>> {
        let dir = dir.to_path_buf();
        let commits = tokio::task::spawn_blocking(move || apex_git::log(&dir, limit)).await??;
        Ok(commits
            .into_iter()
            .map(|commit| GitCommit {
                id: commit.id,
                short: commit.short,
                author: commit.author,
                when: commit.when,
                summary: commit.summary,
                refs: commit.refs,
            })
            .collect())
    }

    pub async fn list_worktrees(&self, root: &Path) -> Result<Vec<WorktreeEntry>> {
        let root = root.to_path_buf();
        let trees = tokio::task::spawn_blocking({
            let root = root.clone();
            move || apex_git::list_worktrees(&root)
        })
        .await??;

        let counting: Vec<_> = trees
            .into_iter()
            .filter(|tree| tree.path != root)
            .map(|tree| {
                tokio::task::spawn_blocking(move || WorktreeEntry {
                    path: tree.path.display().to_string(),
                    branch: tree.branch,
                    changed: apex_git::change_count(&tree.path).unwrap_or(0) as u32,
                })
            })
            .collect();

        let mut entries = Vec::with_capacity(counting.len());
        for task in counting {
            entries.push(task.await?);
        }
        Ok(entries)
    }

    pub async fn merge(&self, root: &Path, dir: &Path) -> Result<MergeReport> {
        let root = root.to_path_buf();
        let dir = dir.to_path_buf();
        if dir == root {
            bail!("the project itself has nothing to merge back")
        }
        let outcome = tokio::task::spawn_blocking(move || {
            let branch = apex_git::current_branch(&dir)?;
            apex_git::merge(&root, &branch)
        })
        .await??;
        Ok(match outcome {
            apex_git::MergeOutcome::Merged => MergeReport::Merged,
            apex_git::MergeOutcome::Conflicted { files } => MergeReport::Conflicted { files },
        })
    }
}

fn kind_name(kind: apex_git::ChangeKind) -> &'static str {
    match kind {
        apex_git::ChangeKind::Added => "added",
        apex_git::ChangeKind::Modified => "modified",
        apex_git::ChangeKind::Deleted => "deleted",
        apex_git::ChangeKind::Renamed => "renamed",
        apex_git::ChangeKind::Untracked => "untracked",
        apex_git::ChangeKind::Conflicted => "conflicted",
    }
}

fn scope_of(scope: DiffScope) -> apex_git::Scope {
    match scope {
        DiffScope::Unstaged => apex_git::Scope::Unstaged,
        DiffScope::Staged => apex_git::Scope::Staged,
        DiffScope::Both => apex_git::Scope::Both,
    }
}

fn sync_of(op: GitSyncOp) -> apex_git::Sync {
    match op {
        GitSyncOp::Fetch => apex_git::Sync::Fetch,
        GitSyncOp::Pull => apex_git::Sync::Pull,
        GitSyncOp::Push => apex_git::Sync::Push,
    }
}
