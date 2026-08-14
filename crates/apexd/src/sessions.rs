use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use anyhow::{Context, Result, bail};
use apex_core::{AgentProfile, ApexPaths, BinaryResolver, ProfileSet, Store, context, history};
use apex_metrics::Sampler;
use apex_proto::{
    ContextEntry, DiffScope, EditorSummary, Event, FileContents, FileEntry, GitCommit, GitStatus,
    GitTarget, HistoryEntry, Isolation, MergeReport, MetricsSnapshot, ProcessUsage, ProjectSummary,
    QuotaReport, QuotaWindow, SessionState, SessionSummary, SessionUsage, SystemUsage,
    TaskSummary, TerminalSize, WorktreeDisposal, WorktreeInfo,
};
use apex_pty::{PtyProcess, PtySpec, StateDetector, StatePatterns};
use apex_quota::QuotaCache;
use bytes::Bytes;
use tokio::sync::{Mutex, RwLock, broadcast};
use tokio::time::{MissedTickBehavior, interval};
use uuid::Uuid;

const EVENT_CHANNEL_DEPTH: usize = 256;
const POLL_INTERVAL: std::time::Duration = std::time::Duration::from_millis(200);

pub struct LiveSession {
    pub summary: Mutex<SessionSummary>,
    pub process: PtyProcess,
}

impl LiveSession {
    pub async fn snapshot_summary(&self) -> SessionSummary {
        self.summary.lock().await.clone()
    }
}

struct Spawn {
    project: Uuid,
    agent: String,
    cwd: Option<String>,
    size: TerminalSize,
    override_args: Option<Vec<String>>,
    isolation: Isolation,
    slug: Option<String>,
    task: Option<String>,
}

pub struct SessionManager {
    paths: ApexPaths,
    profiles: ProfileSet,
    base_env: BTreeMap<String, String>,
    resolver: Arc<Mutex<BinaryResolver>>,
    store: Arc<Mutex<Store>>,
    sessions: RwLock<HashMap<Uuid, Arc<LiveSession>>>,
    events: broadcast::Sender<Event>,
    sampler: Mutex<Sampler>,
    quotas: Mutex<QuotaCache>,
    files: crate::services::files::FilesService,
    git: crate::services::git::GitService,
}

impl SessionManager {
    pub fn new(
        paths: ApexPaths,
        profiles: ProfileSet,
        resolver: BinaryResolver,
        store: Store,
    ) -> Self {
        let (events, _) = broadcast::channel(EVENT_CHANNEL_DEPTH);
        let base_env = resolver
            .environment()
            .map(|environment| environment.env().clone())
            .unwrap_or_default();
        let resolver = Arc::new(Mutex::new(resolver));
        let store = Arc::new(Mutex::new(store));
        let files = crate::services::files::FilesService::new(Arc::clone(&store), Arc::clone(&resolver));
        Self {
            paths,
            profiles,
            base_env,
            resolver,
            store,
            sessions: RwLock::new(HashMap::new()),
            events,
            sampler: Mutex::new(Sampler::new()),
            quotas: Mutex::new(QuotaCache::new()),
            files,
            git: crate::services::git::GitService,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.events.subscribe()
    }

    pub async fn list_agents(&self) -> Vec<apex_proto::AgentSummary> {
        let mut resolver = self.resolver.lock().await;
        self.profiles.summarize(&mut resolver)
    }

    pub async fn list_sessions(&self) -> Vec<SessionSummary> {
        let sessions = self.sessions.read().await;
        let mut summaries = Vec::with_capacity(sessions.len());
        for session in sessions.values() {
            summaries.push(session.snapshot_summary().await);
        }
        summaries.sort_by(|left, right| left.title.cmp(&right.title));
        summaries
    }

    pub async fn get(&self, id: Uuid) -> Option<Arc<LiveSession>> {
        self.sessions.read().await.get(&id).cloned()
    }

    pub async fn list_projects(&self) -> Result<Vec<ProjectSummary>> {
        let store = self.store.lock().await;
        Ok(store
            .list_projects()?
            .into_iter()
            .map(|project| ProjectSummary {
                id: project.id,
                name: project.name,
                root: project.root,
                is_git: project.is_git,
            })
            .collect())
    }

    pub async fn open_project(&self, root: &str) -> Result<ProjectSummary> {
        let path = PathBuf::from(root);
        if !path.is_dir() {
            bail!("{root} is not a folder")
        }
        let canonical = path.canonicalize().unwrap_or(path);

        let store = self.store.lock().await;
        let project = store.open_project(&canonical)?;
        Ok(ProjectSummary {
            id: project.id,
            name: project.name,
            root: project.root,
            is_git: project.is_git,
        })
    }

    pub async fn save_layout(&self, project: Uuid, payload: &str) -> Result<()> {
        self.store.lock().await.save_layout(project, payload)
    }

    pub async fn load_layout(&self, project: Uuid) -> Result<Option<String>> {
        self.store.lock().await.load_layout(project)
    }

    pub async fn read_metrics(&self, refresh_quota: bool) -> MetricsSnapshot {
        let sessions = {
            let mut sampler = self.sampler.lock().await;
            sampler.refresh();

            let live = self.sessions.read().await;
            let mut usage = Vec::with_capacity(live.len());
            for (id, session) in live.iter() {
                let Some(pid) = session.process.pid() else {
                    continue;
                };
                let tree = sampler.tree_usage(pid);
                if tree.processes.is_empty() {
                    continue;
                }
                usage.push(SessionUsage {
                    id: *id,
                    title: session.summary.lock().await.title.clone(),
                    cpu_percent: tree.cpu_percent,
                    memory: tree.memory as f64,
                    processes: tree
                        .processes
                        .into_iter()
                        .map(|entry| ProcessUsage {
                            pid: entry.pid,
                            name: entry.name,
                            cpu_percent: entry.cpu_percent,
                            memory: entry.memory as f64,
                        })
                        .collect(),
                });
            }
            usage.sort_by(|left, right| right.memory.total_cmp(&left.memory));
            usage
        };

        let system = {
            let sampler = self.sampler.lock().await;
            let raw = sampler.system_usage();
            SystemUsage {
                cpu_percent: raw.cpu_percent,
                gpu_percent: apex_metrics::read_gpu_utilization(),
                memory_used: raw.memory_used as f64,
                memory_total: raw.memory_total as f64,
                swap_used: raw.swap_used as f64,
                swap_total: raw.swap_total as f64,
                cores: raw.cores as u32,
            }
        };

        MetricsSnapshot { system, sessions, quotas: self.read_quotas(refresh_quota).await }
    }

    pub async fn kill_process(&self, pid: u32) -> Result<()> {
        let sampler = self.sampler.lock().await;
        if !sampler.kill(pid) {
            bail!("failed to kill process {pid}")
        }
        Ok(())
    }

    async fn read_quotas(&self, force: bool) -> Vec<QuotaReport> {
        let mut reports = Vec::new();
        for profile in self.profiles.iter() {
            let Some(config) = &profile.quota else {
                continue;
            };

            let binary = {
                let mut resolver = self.resolver.lock().await;
                if resolver.resolve(&profile.command).is_none() {
                    continue;
                }
                match resolver.resolve(&config.command) {
                    Some(binary) => binary,
                    None => continue,
                }
            };

            let mut cache = self.quotas.lock().await;
            let Some(report) = cache.read(profile, binary, &self.base_env, force).await else {
                continue;
            };
            reports.push(QuotaReport {
                agent: report.agent,
                windows: report
                    .windows
                    .into_iter()
                    .map(|window| QuotaWindow {
                        label: window.label,
                        used_percent: window.used_percent,
                        expected_percent: window.expected_percent,
                        lasts_to_reset: window.lasts_to_reset,
                        eta_seconds: window
                            .eta_seconds
                            .map(|seconds| seconds.min(u64::from(u32::MAX)) as u32),
                        resets_at: window.resets_at,
                        reset_description: window.reset_description,
                    })
                    .collect(),
                updated_at: report.updated_at,
            });
        }
        reports
    }

    pub async fn list_history(&self, project: Uuid) -> Result<Vec<HistoryEntry>> {
        let root = self.project_root(project).await?;
        let home = home_directory();

        let mut entries: Vec<HistoryEntry> = self
            .profiles
            .iter()
            .flat_map(|profile| history::read_history(profile, &PathBuf::from(&root), &home))
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

    pub async fn resume(
        self: &Arc<Self>,
        project: Uuid,
        agent: &str,
        session_id: &str,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        let profile = self
            .profiles
            .get(agent)
            .with_context(|| format!("unknown profile {agent}"))?;
        let args = history::resume_args(profile, session_id)
            .with_context(|| format!("{agent} cannot resume sessions"))?;

        self.spawn(Spawn {
            project,
            agent: agent.to_owned(),
            cwd: None,
            size,
            override_args: Some(args),
            isolation: Isolation::Directory,
            slug: None,
            task: None,
        })
        .await
    }

    pub async fn create(
        self: &Arc<Self>,
        project: Uuid,
        agent: &str,
        cwd: Option<String>,
        size: TerminalSize,
        isolation: Isolation,
        slug: Option<String>,
    ) -> Result<SessionSummary> {
        self.spawn(Spawn {
            project,
            agent: agent.to_owned(),
            cwd,
            size,
            override_args: None,
            isolation,
            slug,
            task: None,
        })
        .await
    }

    pub async fn list_tasks(&self, project: Uuid) -> Result<Vec<TaskSummary>> {
        let root = PathBuf::from(self.project_root(project).await?);
        let found = tokio::task::spawn_blocking(move || apex_tasks::discover(&root)).await?;
        Ok(found
            .into_iter()
            .map(|task| TaskSummary {
                name: task.name,
                command: task.command,
                source: task.source.as_str().to_owned(),
            })
            .collect())
    }

    pub async fn run_task(
        self: &Arc<Self>,
        project: Uuid,
        task: &str,
        command: &str,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        if self.task_running(project, task).await {
            bail!("{task} is already running")
        }
        self.spawn(Spawn {
            project,
            agent: "shell".to_owned(),
            cwd: None,
            size,
            override_args: Some(vec!["-lc".to_owned(), command.to_owned()]),
            isolation: Isolation::Directory,
            slug: None,
            task: Some(task.to_owned()),
        })
        .await
    }

    async fn task_running(&self, project: Uuid, task: &str) -> bool {
        for session in self.sessions.read().await.values() {
            let summary = session.summary.lock().await;
            if summary.project_id == project
                && summary.task.as_deref() == Some(task)
                && summary.exit_code.is_none()
            {
                return true;
            }
        }
        false
    }

    async fn spawn(self: &Arc<Self>, request: Spawn) -> Result<SessionSummary> {
        let Spawn { project, agent, cwd, size, override_args, isolation, slug, task } = request;
        let profile = self
            .profiles
            .get(&agent)
            .cloned()
            .with_context(|| format!("unknown profile {agent}"))?;
        let binary = self.resolve_binary(&profile).await?;
        let project_root = self.project_root(project).await?;
        let title = match &task {
            Some(name) => name.clone(),
            None => self.next_title(&profile.name).await,
        };

        let worktree = match isolation {
            Isolation::Worktree => {
                let wanted = slug.as_deref().unwrap_or(&title);
                Some(self.open_worktree(&project_root, wanted).await?)
            }
            Isolation::Directory => None,
        };
        let cwd = match (&worktree, cwd) {
            (Some(tree), _) => PathBuf::from(&tree.path),
            (None, Some(explicit)) => PathBuf::from(explicit),
            (None, None) => PathBuf::from(project_root),
        };

        let record = {
            let store = self.store.lock().await;
            store.insert_session(
                project,
                &profile.name,
                &title,
                &cwd.display().to_string(),
                worktree.as_ref().map(|tree| (tree.path.as_str(), tree.branch.as_str())),
            )?
        };

        let mut spec = PtySpec::new(binary, &cwd);
        spec.args = override_args.unwrap_or_else(|| profile.args.clone());
        if let Some(delivery) = &profile.mcp {
            match crate::mcp_delivery::offer(record.id, delivery, &cwd, worktree.is_some(), &self.paths)
            {
                Ok(Some(flag)) => spec.args.extend(flag),
                Ok(None) => {}
                Err(error) => tracing::warn!(%error, "could not offer the MCP server"),
            }
        }
        spec.env = self.base_env.clone();
        spec.env.extend(profile.env.clone());
        spec.rows = size.rows;
        spec.cols = size.cols;

        let process = PtyProcess::spawn(spec)?;
        let cwd_text = cwd.display().to_string();

        let summary = SessionSummary {
            id: record.id,
            project_id: project,
            agent: profile.name.clone(),
            title,
            cwd: cwd_text,
            state: SessionState::Idle,
            size,
            exit_code: None,
            worktree: worktree.clone(),
            task: task.clone(),
        };

        let session = Arc::new(LiveSession { summary: Mutex::new(summary.clone()), process });
        self.sessions.write().await.insert(record.id, session.clone());
        let _ = self.events.send(Event::SessionOpened { session: summary.clone() });
        self.watch_state(record.id, session.clone(), &profile);
        self.watch_exit(record.id, session);

        Ok(summary)
    }

    pub async fn write(&self, id: Uuid, data: &str) -> Result<()> {
        let session = self.require(id).await?;
        session.process.write(Bytes::copy_from_slice(data.as_bytes()))
    }

    pub async fn resize(&self, id: Uuid, size: TerminalSize) -> Result<()> {
        let session = self.require(id).await?;
        session.process.resize(size.rows, size.cols)?;
        session.summary.lock().await.size = size;
        Ok(())
    }

    pub async fn close(&self, id: Uuid, disposal: WorktreeDisposal) -> Result<()> {
        let Some(session) = self.sessions.write().await.remove(&id) else {
            bail!("session {id} does not exist")
        };
        let _ = session.process.kill();

        let summary = session.snapshot_summary().await;
        if let Some(tree) = summary.worktree.filter(|_| disposal == WorktreeDisposal::Discard) {
            let root = PathBuf::from(self.project_root(summary.project_id).await?);
            let path = PathBuf::from(&tree.path);
            let branch = tree.branch.clone();
            let removed = tokio::task::spawn_blocking(move || {
                apex_git::remove_worktree(&root, &path, Some(&branch))
            })
            .await?;
            if let Err(error) = removed {
                tracing::warn!(%id, %error, "could not drop the worktree");
            }
        }

        let store = self.store.lock().await;
        store.close_session(id)?;
        let _ = self.events.send(Event::SessionClosed { id });
        Ok(())
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

    async fn git_dir(&self, project: Uuid, target: &GitTarget) -> Result<PathBuf> {
        match target {
            GitTarget::Project => Ok(PathBuf::from(self.project_root(project).await?)),
            GitTarget::Worktree { path } => Ok(PathBuf::from(path)),
            GitTarget::Session { id } => {
                match self.require(*id).await?.snapshot_summary().await.worktree {
                    Some(tree) => Ok(PathBuf::from(tree.path)),
                    None => Ok(PathBuf::from(self.project_root(project).await?)),
                }
            }
        }
    }

    pub async fn context_list(&self, project: Uuid) -> Result<Vec<ContextEntry>> {
        let root = PathBuf::from(self.project_root(project).await?);
        let entries = tokio::task::spawn_blocking(move || context::list(&root)).await??;
        Ok(entries
            .into_iter()
            .map(|entry| ContextEntry {
                key: entry.key,
                bytes: entry.bytes,
                updated_at: entry.updated_at,
            })
            .collect())
    }

    pub async fn context_read(&self, project: Uuid, key: &str) -> Result<String> {
        let root = PathBuf::from(self.project_root(project).await?);
        let key = key.to_owned();
        tokio::task::spawn_blocking(move || context::read(&root, &key)).await?
    }

    pub async fn context_write(&self, project: Uuid, key: &str, contents: &str) -> Result<()> {
        let root = PathBuf::from(self.project_root(project).await?);
        let key = key.to_owned();
        let contents = contents.to_owned();
        tokio::task::spawn_blocking(move || context::write(&root, &key, &contents)).await?
    }

    pub async fn context_note(
        &self,
        project: Uuid,
        from: &str,
        to: Option<&str>,
        message: &str,
    ) -> Result<()> {
        let root = PathBuf::from(self.project_root(project).await?);
        let from = from.to_owned();
        let to = to.map(str::to_owned);
        let message = message.to_owned();
        tokio::task::spawn_blocking(move || {
            context::append_note(&root, &from, to.as_deref(), &message)
        })
        .await?
    }

    pub async fn transcript(&self, id: Uuid, tail: usize) -> Result<String> {
        let session = self.require(id).await?;
        let snapshot = session.process.snapshot();
        let start = snapshot.len().saturating_sub(tail);
        Ok(String::from_utf8_lossy(&snapshot[start..]).into_owned())
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

    async fn open_worktree(&self, project_root: &str, wanted: &str) -> Result<WorktreeInfo> {
        let root = PathBuf::from(project_root);
        if !tokio::task::spawn_blocking({
            let root = root.clone();
            move || apex_git::is_repo(&root)
        })
        .await?
        {
            bail!("{project_root} is not a git repository")
        }

        let slug = apex_git::slugify(wanted);
        if slug.is_empty() {
            bail!("the worktree name is empty")
        }
        let created =
            tokio::task::spawn_blocking(move || apex_git::add_worktree(&root, &slug)).await??;
        Ok(WorktreeInfo { path: created.path.display().to_string(), branch: created.branch })
    }

    async fn project_root(&self, project: Uuid) -> Result<String> {
        let store = self.store.lock().await;
        Ok(store
            .project(project)?
            .with_context(|| format!("unknown project {project}"))?
            .root)
    }

    async fn require(&self, id: Uuid) -> Result<Arc<LiveSession>> {
        self.get(id).await.with_context(|| format!("session {id} does not exist"))
    }

    async fn resolve_binary(&self, profile: &AgentProfile) -> Result<PathBuf> {
        let mut resolver = self.resolver.lock().await;
        resolver
            .resolve(&profile.command)
            .with_context(|| format!("\"{}\" was not found in PATH", profile.command))
    }

    async fn next_title(&self, agent: &str) -> String {
        let sessions = self.sessions.read().await;
        let mut taken = 0;
        for session in sessions.values() {
            if session.summary.lock().await.agent == agent {
                taken += 1;
            }
        }
        if taken == 0 {
            return agent.to_string();
        }
        format!("{agent} {}", taken + 1)
    }

    fn watch_state(self: &Arc<Self>, id: Uuid, session: Arc<LiveSession>, profile: &AgentProfile) {
        let patterns =
            StatePatterns::compile(&profile.state_patterns.blocked, &profile.state_patterns.done);
        let manager = self.clone();
        let mut output = session.process.subscribe();
        let produced_before_subscribing = session.process.snapshot();

        tokio::spawn(async move {
            let mut detector = StateDetector::new(patterns, Instant::now());
            if !produced_before_subscribing.is_empty()
                && let Some(state) =
                    detector.observe(&produced_before_subscribing, Instant::now())
            {
                manager.publish_state(id, &session, state).await;
            }

            let mut ticker = interval(POLL_INTERVAL);
            ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

            loop {
                let change = tokio::select! {
                    chunk = output.recv() => match chunk {
                        Ok(data) => detector.observe(&data, Instant::now()),
                        Err(broadcast::error::RecvError::Lagged(_)) => {
                            detector.observe(b"", Instant::now())
                        }
                        Err(broadcast::error::RecvError::Closed) => return,
                    },
                    _ = ticker.tick() => detector.poll(Instant::now()),
                };

                if let Some(state) = change {
                    manager.publish_state(id, &session, state).await;
                }
            }
        });
    }

    fn watch_exit(self: &Arc<Self>, id: Uuid, session: Arc<LiveSession>) {
        let manager = self.clone();
        tokio::spawn(async move {
            let status = session.process.wait().await;
            {
                let mut summary = session.summary.lock().await;
                summary.exit_code = Some(status.code);
                summary.state = SessionState::Done;
            }
            let _ = manager.events.send(Event::SessionExited { id, code: status.code });
        });
    }

    async fn publish_state(&self, id: Uuid, session: &LiveSession, state: SessionState) {
        {
            let mut summary = session.summary.lock().await;
            if summary.exit_code.is_some() {
                return;
            }
            summary.state = state;
        }
        let _ = self.events.send(Event::SessionStateChanged { id, state });
    }
}

fn home_directory() -> PathBuf {
    directories::UserDirs::new()
        .map(|dirs| dirs.home_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("/"))
}
