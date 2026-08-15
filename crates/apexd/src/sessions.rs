use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use apex_core::{ApexPaths, BinaryResolver, ProfileSet, Store};
use apex_proto::{
    ContextEntry, DiffScope, EditorSummary, Event, FileContents, FileEntry, GitCommit, GitStatus,
    GitTarget, HistoryEntry, Isolation, MergeReport, MetricsSnapshot, ProjectSummary,
    SessionSummary, TaskSummary, TerminalSize, WorktreeDisposal, WorktreeInfo,
};
use tokio::sync::Mutex;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::services::acp::AcpRegistry;
use crate::services::sessions::SessionRegistry;
use crate::services::{
    context::ContextService, files::FilesService, git::GitService, metrics::MetricsService,
    projects::ProjectsService, tasks::TasksService,
};

const EVENT_CHANNEL_DEPTH: usize = 256;

pub struct NewSession {
    pub project: Uuid,
    pub agent: String,
    pub cwd: Option<String>,
    pub size: TerminalSize,
    pub isolation: Isolation,
    pub slug: Option<String>,
    pub mode: Option<apex_proto::AgentMode>,
}

pub struct SessionManager {
    paths: ApexPaths,
    profiles: ProfileSet,
    files: FilesService,
    git: GitService,
    context: ContextService,
    projects: ProjectsService,
    tasks: TasksService,
    metrics: MetricsService,
    registry: Arc<SessionRegistry>,
    acp: Arc<AcpRegistry>,
}

impl SessionManager {
    pub fn new(
        paths: ApexPaths,
        profiles: ProfileSet,
        resolver: BinaryResolver,
        store: Store,
    ) -> Self {
        let base_env = resolver
            .environment()
            .map(|environment| environment.env().clone())
            .unwrap_or_default();
        let resolver = Arc::new(Mutex::new(resolver));
        let store = Arc::new(Mutex::new(store));
        let (events, _) = broadcast::channel(EVENT_CHANNEL_DEPTH);
        let acp = Arc::new(AcpRegistry::new(
            profiles.clone(),
            Arc::clone(&resolver),
            Arc::clone(&store),
            base_env.clone(),
            events.clone(),
            paths.socket.clone(),
        ));
        let files = FilesService::new(Arc::clone(&store), Arc::clone(&resolver));
        let context = ContextService::new(Arc::clone(&store));
        let projects = ProjectsService::new(Arc::clone(&store));
        let tasks = TasksService::new(Arc::clone(&store));
        let registry = Arc::new(SessionRegistry::new(
            paths.clone(),
            profiles.clone(),
            Arc::clone(&resolver),
            Arc::clone(&store),
            base_env.clone(),
            events,
        ));
        let metrics = MetricsService::new(
            Arc::new(Mutex::new(apex_metrics::Sampler::new())),
            registry.sessions_map(),
            Arc::new(Mutex::new(apex_quota::QuotaCache::new())),
            profiles.clone(),
            Arc::clone(&resolver),
            base_env,
            Arc::clone(&acp),
        );
        Self {
            paths,
            profiles,
            files,
            git: GitService,
            context,
            projects,
            tasks,
            metrics,
            registry,
            acp,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.registry.subscribe()
    }

    pub async fn list_agents(&self) -> Vec<apex_proto::AgentSummary> {
        self.registry.list_agents().await
    }

    pub async fn list_sessions(&self) -> Vec<SessionSummary> {
        let mut sessions = self.registry.list_sessions().await;
        sessions.extend(self.acp.list().await);
        sessions.sort_by(|left, right| left.title.cmp(&right.title));
        sessions
    }

    pub async fn acp_snapshot(&self, id: Uuid) -> Result<apex_proto::AcpSnapshot> {
        Ok(self.acp.require(id).await?.snapshot().await)
    }

    pub async fn acp_prompt(&self, id: Uuid, text: String) -> Result<()> {
        Arc::clone(&self.acp).prompt(id, text).await
    }

    pub async fn acp_choose(
        &self,
        id: Uuid,
        model: Option<String>,
        mode: Option<String>,
    ) -> Result<()> {
        self.acp.require(id).await?.choose(model, mode).await
    }

    pub async fn acp_cancel(&self, id: Uuid) -> Result<()> {
        self.acp.require(id).await?.cancel()
    }

    pub async fn acp_decide(&self, id: Uuid, request: u32, option: Option<String>) -> Result<()> {
        self.acp.require(id).await?.decide(request, option).await
    }

    pub async fn get(&self, id: Uuid) -> Option<Arc<crate::services::sessions::LiveSession>> {
        self.registry.get(id).await
    }

    pub async fn create(self: &Arc<Self>, request: NewSession) -> Result<SessionSummary> {
        let NewSession { project, agent, cwd, size, isolation, slug, mode } = request;
        let agent = agent.as_str();
        let wanted = match mode {
            Some(chosen) => chosen,
            None => self.acp.mode_of(agent).await,
        };
        if wanted != apex_proto::AgentMode::Acp || !self.acp.speaks_acp(agent).await {
            return Arc::clone(&self.registry).create(project, agent, cwd, size, isolation, slug).await;
        }

        let root = self.registry.project_root(project).await?;
        let title = self.registry.next_title(agent).await;
        let worktree = match isolation {
            Isolation::Worktree => {
                Some(self.registry.open_worktree(&root, slug.as_deref().unwrap_or(&title)).await?)
            }
            Isolation::Directory => None,
        };
        let directory = match (&worktree, cwd) {
            (Some(tree), _) => PathBuf::from(&tree.path),
            (None, Some(explicit)) => PathBuf::from(explicit),
            (None, None) => PathBuf::from(root),
        };

        Arc::clone(&self.acp).open(project, agent, &directory, title, size, worktree).await
    }

    pub async fn resume(
        self: &Arc<Self>,
        project: Uuid,
        agent: &str,
        session_id: &str,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        Arc::clone(&self.registry).resume(project, agent, session_id, size).await
    }

    pub async fn run_task(
        self: &Arc<Self>,
        project: Uuid,
        task: &str,
        command: &str,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        Arc::clone(&self.registry).run_task(project, task, command, size).await
    }

    pub async fn write(&self, id: Uuid, data: &str) -> Result<()> {
        self.registry.write(id, data).await
    }

    pub async fn resize(&self, id: Uuid, size: TerminalSize) -> Result<()> {
        self.registry.resize(id, size).await
    }

    pub async fn close(&self, id: Uuid, disposal: WorktreeDisposal) -> Result<()> {
        if self.acp.get(id).await.is_some() {
            return self.acp.close(id).await;
        }
        self.registry.close(id, disposal).await
    }

    pub async fn transcript(&self, id: Uuid, tail: usize) -> Result<String> {
        self.registry.transcript(id, tail).await
    }

    pub async fn read_metrics(&self, refresh_quota: bool) -> MetricsSnapshot {
        self.metrics.read(refresh_quota).await
    }

    pub async fn kill_process(&self, pid: u32) -> Result<()> {
        self.metrics.kill_process(pid).await
    }

    pub async fn list_directory(&self, project: Uuid, path: &str) -> Result<Vec<FileEntry>> {
        self.files.list_directory(project, path).await
    }

    pub async fn read_file(&self, project: Uuid, path: &str) -> Result<FileContents> {
        self.files.read_file(project, path).await
    }

    pub async fn list_editors(&self) -> Vec<EditorSummary> {
        self.files.list_editors().await
    }

    pub async fn open_externally(
        &self,
        project: Uuid,
        path: &str,
        editor: Option<&str>,
    ) -> Result<()> {
        self.files.open_externally(project, path, editor).await
    }

    pub async fn search_files(
        &self,
        project: Uuid,
        query: &str,
        limit: usize,
    ) -> Result<Vec<FileEntry>> {
        self.files.search_files(project, query, limit).await
    }

    pub async fn git_status(&self, project: Uuid, target: GitTarget) -> Result<GitStatus> {
        let root = PathBuf::from(self.project_root(project).await?);
        let dir = self.git_dir(project, &target).await?;
        self.git.status(&dir, &root).await
    }

    pub async fn git_diff(
        &self,
        project: Uuid,
        target: GitTarget,
        path: &str,
        commit: Option<String>,
        scope: DiffScope,
    ) -> Result<String> {
        let dir = self.git_dir(project, &target).await?;
        self.git.diff(&dir, path, commit, scope).await
    }

    pub async fn git_hunks(
        &self,
        project: Uuid,
        target: GitTarget,
        path: &str,
        scope: DiffScope,
    ) -> Result<Vec<String>> {
        let dir = self.git_dir(project, &target).await?;
        self.git.hunks(&dir, path, scope).await
    }

    pub async fn git_stage(
        &self,
        project: Uuid,
        target: GitTarget,
        paths: Vec<String>,
        staged: bool,
    ) -> Result<()> {
        let dir = self.git_dir(project, &target).await?;
        self.git.stage(&dir, paths, staged).await
    }

    pub async fn git_stage_hunk(
        &self,
        project: Uuid,
        target: GitTarget,
        patch: String,
        staged: bool,
    ) -> Result<()> {
        let dir = self.git_dir(project, &target).await?;
        self.git.stage_hunk(&dir, patch, staged).await
    }

    pub async fn git_commit(
        &self,
        project: Uuid,
        target: GitTarget,
        message: String,
    ) -> Result<GitCommit> {
        let dir = self.git_dir(project, &target).await?;
        self.git.commit(&dir, message).await
    }

    pub async fn git_log(
        &self,
        project: Uuid,
        target: GitTarget,
        limit: usize,
    ) -> Result<Vec<GitCommit>> {
        let dir = self.git_dir(project, &target).await?;
        self.git.log(&dir, limit).await
    }

    pub async fn list_worktrees(&self, project: Uuid) -> Result<Vec<WorktreeInfo>> {
        let root = PathBuf::from(self.project_root(project).await?);
        self.git.list_worktrees(&root).await
    }

    pub async fn merge_worktree(&self, project: Uuid, target: GitTarget) -> Result<MergeReport> {
        let root = PathBuf::from(self.project_root(project).await?);
        let dir = self.git_dir(project, &target).await?;
        self.git.merge(&root, &dir).await
    }

    pub async fn context_list(&self, project: Uuid) -> Result<Vec<ContextEntry>> {
        self.context.list(project).await
    }

    pub async fn context_read(&self, project: Uuid, key: &str) -> Result<String> {
        self.context.read(project, key).await
    }

    pub async fn context_write(&self, project: Uuid, key: &str, contents: &str) -> Result<()> {
        self.context.write(project, key, contents).await
    }

    pub async fn context_note(
        &self,
        project: Uuid,
        from: &str,
        to: Option<&str>,
        message: &str,
    ) -> Result<()> {
        self.context.note(project, from, to, message).await
    }

    pub async fn list_history(&self, project: Uuid) -> Result<Vec<HistoryEntry>> {
        let root = self.project_root(project).await?;
        let home = home_directory();

        let mut entries: Vec<HistoryEntry> = self
            .profiles
            .iter()
            .flat_map(|profile| apex_core::history::read_history(profile, &PathBuf::from(&root), &home))
            .map(|entry| HistoryEntry {
                agent: entry.agent,
                session_id: entry.session_id,
                label: entry.label,
                updated_at: entry.updated_at.min(u64::from(u32::MAX)) as u32,
            })
            .collect();

        entries.sort_by_key(|entry| std::cmp::Reverse(entry.updated_at));
        Ok(entries)
    }

    pub async fn list_projects(&self) -> Result<Vec<ProjectSummary>> {
        self.projects.list().await
    }

    pub async fn open_project(&self, root: &str) -> Result<ProjectSummary> {
        self.projects.open(root).await
    }

    pub async fn save_layout(&self, project: Uuid, payload: &str) -> Result<()> {
        self.projects.save_layout(project, payload).await
    }

    pub async fn load_layout(&self, project: Uuid) -> Result<Option<String>> {
        self.projects.load_layout(project).await
    }

    pub async fn mcp_adopt(&self, agent: &str, enabled: bool) -> Result<String> {
        let profile =
            self.profiles.get(agent).context(format!("unknown agent {agent}"))?;
        let delivery =
            profile.mcp.as_ref().context(format!("{agent} does not take an MCP server"))?;
        let written = crate::mcp_delivery::adopt(delivery, &self.paths.home, enabled)?;
        Ok(written.display().to_string())
    }

    pub async fn list_tasks(&self, project: Uuid) -> Result<Vec<TaskSummary>> {
        self.tasks.list(project).await
    }

    async fn git_dir(&self, project: Uuid, target: &GitTarget) -> Result<PathBuf> {
        match target {
            GitTarget::Project => Ok(PathBuf::from(self.project_root(project).await?)),
            GitTarget::Worktree { path } => Ok(PathBuf::from(path)),
            GitTarget::Session { id } => {
                match self
                    .registry
                    .require(*id)
                    .await?
                    .snapshot_summary()
                    .await
                    .worktree
                {
                    Some(tree) => Ok(PathBuf::from(tree.path)),
                    None => Ok(PathBuf::from(self.project_root(project).await?)),
                }
            }
        }
    }

    async fn project_root(&self, project: Uuid) -> Result<String> {
        self.registry.project_root(project).await
    }
}

fn home_directory() -> PathBuf {
    directories::UserDirs::new()
        .map(|dirs| dirs.home_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("/"))
}
