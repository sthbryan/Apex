use apex_proto::{
    Command, DiffScope, GitBranch, GitCommit, GitStatus, GitSyncOp, GitTarget, ImagePair,
    MergeReport, PendingReview, RejectedHunk, Reply, WorktreeEntry,
};
use uuid::Uuid;

use crate::state::{Answer, AppState, failed};

#[tauri::command]
pub async fn git_status(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
) -> Answer<GitStatus> {
    match state.daemon()?.request(Command::GitRead { project, target }).await.map_err(failed)? {
        Reply::Git { status } => Ok(status),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_diff(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    path: String,
    commit: Option<String>,
    scope: DiffScope,
) -> Answer<String> {
    match state
        .daemon()?
        .request(Command::GitDiff { project, target, path, commit, scope })
        .await
        .map_err(failed)?
    {
        Reply::Diff { patch } => Ok(patch),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_images(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    path: String,
    commit: Option<String>,
) -> Answer<ImagePair> {
    match state
        .daemon()?
        .request(Command::GitImages { project, target, path, commit })
        .await
        .map_err(failed)?
    {
        Reply::Images { pair } => Ok(pair),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_log(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    limit: u32,
) -> Answer<Vec<GitCommit>> {
    match state
        .daemon()?
        .request(Command::GitLog { project, target, limit })
        .await
        .map_err(failed)?
    {
        Reply::Log { commits } => Ok(commits),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_branches(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
) -> Answer<Vec<GitBranch>> {
    match state.daemon()?.request(Command::GitBranches { project, target }).await.map_err(failed)? {
        Reply::Branches { branches } => Ok(branches),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_checkout(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    branch: String,
) -> Answer<()> {
    match state
        .daemon()?
        .request(Command::GitCheckout { project, target, branch })
        .await
        .map_err(failed)?
    {
        Reply::Done => Ok(()),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn list_worktrees(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<WorktreeEntry>> {
    match state.daemon()?.request(Command::WorktreeList { project }).await.map_err(failed)? {
        Reply::Worktrees { worktrees } => Ok(worktrees),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_pending(
    state: tauri::State<'_, AppState>,
    project: Uuid,
) -> Answer<Vec<PendingReview>> {
    match state.daemon()?.request(Command::GitPending { project }).await.map_err(failed)? {
        Reply::Pending { reviews } => Ok(reviews),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_reject_hunk(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    patch: String,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::GitRejectHunk { project, target, patch })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn git_rejects(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
) -> Answer<Vec<RejectedHunk>> {
    match state.daemon()?.request(Command::GitRejects { project, target }).await.map_err(failed)? {
        Reply::Rejects { rejects } => Ok(rejects),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_restore_reject(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    id: String,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::GitRestoreReject { project, target, id })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn git_clear_rejects(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
) -> Answer<()> {
    state.daemon()?.request(Command::GitClearRejects { project, target }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn git_hunks(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    path: String,
    scope: DiffScope,
) -> Answer<Vec<String>> {
    match state
        .daemon()?
        .request(Command::GitHunks { project, target, path, scope })
        .await
        .map_err(failed)?
    {
        Reply::Hunks { patches } => Ok(patches),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_stage(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    paths: Vec<String>,
    staged: bool,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::GitStage { project, target, paths, staged })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn git_stage_hunk(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    patch: String,
    staged: bool,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::GitStageHunk { project, target, patch, staged })
        .await
        .map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn git_commit(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    message: String,
) -> Answer<GitCommit> {
    match state
        .daemon()?
        .request(Command::GitCommitStaged { project, target, message })
        .await
        .map_err(failed)?
    {
        Reply::Committed { commit } => Ok(commit),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn git_sync(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
    op: GitSyncOp,
) -> Answer<()> {
    state.daemon()?.request(Command::GitSync { project, target, op }).await.map_err(failed)?;
    Ok(())
}

#[tauri::command]
pub async fn merge_worktree(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    target: GitTarget,
) -> Answer<MergeReport> {
    match state
        .daemon()?
        .request(Command::WorktreeMerge { project, target })
        .await
        .map_err(failed)?
    {
        Reply::Merge { report } => Ok(report),
        other => Err(format!("unexpected reply: {other:?}")),
    }
}

#[tauri::command]
pub async fn remove_worktree(
    state: tauri::State<'_, AppState>,
    project: Uuid,
    path: String,
    branch: Option<String>,
) -> Answer<()> {
    state
        .daemon()?
        .request(Command::WorktreeRemove { project, path, branch })
        .await
        .map_err(failed)?;
    Ok(())
}
