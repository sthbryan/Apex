use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use anyhow::{Context, Result, bail};
use apex_core::{ApexPaths, BinaryResolver, ProfileSet, Store};
use apex_proto::{
    ContextEntry, DaemonReport, DiffScope, EditorSummary, Event, FileContents, FileEntry,
    GitBranch, GitCommit, GitStatus, GitSyncOp, GitTarget, HistoryEntry, IDLE_GRACE_NEVER,
    ImagePair, Isolation, MergeReport, MetricsSnapshot, PROTOCOL_VERSION, PendingReview,
    ProjectSummary, RejectedHunk, SessionState, SessionSummary, TaskSummary, TerminalSize,
    WorktreeDisposal, WorktreeEntry,
};
use tokio::sync::Mutex;
use tokio::sync::broadcast;
use tokio::sync::watch;
use uuid::Uuid;

use crate::services::acp::AcpRegistry;
use crate::services::api::ApiService;
use crate::services::browsers::BrowsersService;
use crate::services::sessions::SessionRegistry;
use crate::services::{
    context::ContextService, files::FilesService, git::GitService, metrics::MetricsService,
    projects::ProjectsService, rejects::RejectsService, tasks::TasksService,
};

const EVENT_CHANNEL_DEPTH: usize = 256;
const SPAWN_DEPTH_CAP: usize = 1;
const STARTUP_GRACE: std::time::Duration = std::time::Duration::from_secs(5);
const SETTLE_AFTER_PAINT: std::time::Duration = std::time::Duration::from_millis(600);
const BEFORE_ENTER: std::time::Duration = std::time::Duration::from_millis(150);
const BLOCKED_GRACE: std::time::Duration = std::time::Duration::from_secs(300);
const POLL_WHILE_BLOCKED: std::time::Duration = std::time::Duration::from_millis(200);
const ECHO_GRACE: std::time::Duration = std::time::Duration::from_secs(4);
const ECHO_POLL: std::time::Duration = std::time::Duration::from_millis(250);
const TYPING_TRIES: u32 = 3;
const BLOCKED_TRIES: u32 = 4;
const PROBE_LEN: usize = 16;
const TRACE_LEN: usize = 4;
pub const DEFAULT_IDLE_GRACE_SECONDS: u64 = 300;

pub struct NewSession {
    pub project: Uuid,
    pub agent: String,
    pub cwd: Option<String>,
    pub size: TerminalSize,
    pub isolation: Isolation,
    pub slug: Option<String>,
    pub mode: Option<apex_proto::AgentMode>,
    pub parent: Option<Uuid>,
    pub run: Option<Uuid>,
    pub unattended: bool,
}

pub struct SessionManager {
    paths: ApexPaths,
    profiles: ProfileSet,
    files: FilesService,
    git: GitService,
    rejects: RejectsService,
    context: ContextService,
    projects: ProjectsService,
    tasks: TasksService,
    browsers: BrowsersService,
    api: ApiService,
    metrics: MetricsService,
    registry: Arc<SessionRegistry>,
    acp: Arc<AcpRegistry>,
    idle_grace: Arc<AtomicU64>,
    idle_since: Arc<std::sync::Mutex<Option<Instant>>>,
    clients: Arc<AtomicUsize>,
    started: Instant,
    quit: Arc<watch::Sender<bool>>,
    preview: tokio::sync::OnceCell<Arc<crate::preview::PreviewServer>>,
}

impl SessionManager {
    pub fn new(
        paths: ApexPaths,
        profiles: ProfileSet,
        resolver: BinaryResolver,
        store: Store,
    ) -> Arc<Self> {
        let mut base_env =
            resolver.environment().map(|environment| environment.env().clone()).unwrap_or_default();
        base_env.insert("APEX_HOME".to_owned(), paths.home.display().to_string());
        let resolver = Arc::new(Mutex::new(resolver));
        let store = Arc::new(Mutex::new(store));
        let (events, _) = broadcast::channel(EVENT_CHANNEL_DEPTH);
        let acp = Arc::new(AcpRegistry::new(
            profiles.clone(),
            Arc::clone(&resolver),
            Arc::clone(&store),
            base_env.clone(),
            events.clone(),
        ));
        let files = FilesService::new(Arc::clone(&store), Arc::clone(&resolver));
        let context = ContextService::new(Arc::clone(&store));
        let projects = ProjectsService::new(Arc::clone(&store));
        let tasks = TasksService::new(Arc::clone(&store));
        let browsers = BrowsersService::new();
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
        let rejects = RejectsService::new(&paths.data_dir);
        let manager = Arc::new(Self {
            paths,
            profiles,
            files,
            git: GitService,
            rejects,
            context,
            projects,
            tasks,
            browsers,
            api: ApiService::new(),
            metrics,
            registry,
            acp,
            idle_grace: Arc::new(AtomicU64::new(DEFAULT_IDLE_GRACE_SECONDS)),
            idle_since: Arc::new(std::sync::Mutex::new(None)),
            clients: Arc::new(AtomicUsize::new(0)),
            started: Instant::now(),
            quit: Arc::new(watch::channel(false).0),
            preview: tokio::sync::OnceCell::new(),
        });
        let dispatch: Arc<dyn crate::commands::Dispatch> = manager.clone();
        manager.acp.bind(Arc::downgrade(&dispatch));
        manager
    }

    pub fn quitting(&self) -> watch::Receiver<bool> {
        self.quit.subscribe()
    }

    pub fn quit(&self) {
        self.registry.announce(Event::DaemonShutdown);
        let _ = self.quit.send(true);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.registry.subscribe()
    }

    pub async fn list_agents(&self) -> Vec<apex_proto::AgentSummary> {
        self.registry.list_agents().await
    }

    pub async fn tool_groups_off(&self) -> Vec<apex_proto::ToolGroup> {
        self.registry.tool_groups_off().await
    }

    pub async fn set_tool_groups(&self, groups: &[apex_proto::ToolGroup]) -> anyhow::Result<()> {
        self.registry.set_tool_groups(groups).await
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

    pub async fn create(&self, request: NewSession) -> Result<SessionSummary> {
        let NewSession {
            project,
            agent,
            cwd,
            size,
            isolation,
            slug,
            mode,
            parent,
            run,
            unattended,
        } = request;
        let agent = agent.as_str();
        let wanted = match mode {
            Some(chosen) => chosen,
            None => self.acp.mode_of(agent).await,
        };
        if wanted != apex_proto::AgentMode::Acp || !self.acp.speaks_acp(agent).await {
            return Arc::clone(&self.registry)
                .spawn(crate::services::sessions::Spawn {
                    project,
                    agent: agent.to_owned(),
                    cwd,
                    size,
                    override_args: None,
                    isolation,
                    slug,
                    task: None,
                    parent,
                    run,
                    unattended,
                })
                .await;
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

        Arc::clone(&self.acp)
            .open(crate::services::acp::OpenAcp {
                project,
                agent: agent.to_owned(),
                cwd: directory,
                title,
                size,
                worktree,
                parent,
                run,
            })
            .await
    }

    pub async fn race(
        &self,
        project: Uuid,
        agents: Vec<String>,
        task: String,
        unattended: Vec<String>,
    ) -> Result<Vec<SessionSummary>> {
        if agents.is_empty() {
            bail!("pick at least one agent to run the task")
        }
        if task.trim().is_empty() {
            bail!("a race needs a task to hand out")
        }
        let run = Uuid::new_v4();
        let mut started = Vec::with_capacity(agents.len());
        let mut refused = Vec::new();
        for agent in &agents {
            match self.enter_race(project, agent, &task, run, unattended.contains(agent)).await {
                Ok(session) => started.push(session),
                Err(error) => refused.push(format!("{agent}: {error:#}")),
            }
        }
        if started.is_empty() {
            bail!("none of them started — {}", refused.join("; "))
        }
        for reason in &refused {
            tracing::warn!(%reason, "an agent stayed out of the race");
            self.registry.announce(Event::Notify {
                session: None,
                notice: apex_proto::NotifyKind::Quiet,
                title: Some("Did not join the race".into()),
                body: reason.clone(),
            });
        }
        Ok(started)
    }

    async fn enter_race(
        &self,
        project: Uuid,
        agent: &str,
        task: &str,
        run: Uuid,
        unattended: bool,
    ) -> Result<SessionSummary> {
        let session = self
            .create(NewSession {
                project,
                agent: agent.to_owned(),
                cwd: None,
                size: TerminalSize::default(),
                isolation: Isolation::Worktree,
                slug: Some(format!("race-{agent}")),
                mode: None,
                parent: None,
                run: Some(run),
                unattended,
            })
            .await?;
        if let Err(error) = self.hand_over(&session, task.to_owned()).await {
            let _ = self.close(session.id, WorktreeDisposal::Discard).await;
            return Err(error);
        }
        Ok(session)
    }

    pub async fn broadcast(
        &self,
        parent: Uuid,
        agents: Vec<String>,
        task: String,
        isolation: Isolation,
    ) -> Result<Vec<SessionSummary>> {
        if agents.is_empty() {
            bail!("name at least one agent to send the task to")
        }
        let run = Uuid::new_v4();
        let mut started = Vec::with_capacity(agents.len());
        let mut refused = Vec::new();
        for agent in &agents {
            match self.spawn_tagged(parent, agent, Some(task.clone()), isolation, Some(run)).await {
                Ok(session) => started.push(session),
                Err(error) => refused.push(format!("{agent}: {error:#}")),
            }
        }
        if started.is_empty() {
            bail!("none of them started — {}", refused.join("; "))
        }
        if !refused.is_empty() {
            tracing::warn!(refused = %refused.join("; "), "some agents did not take the task");
        }
        Ok(started)
    }

    pub async fn open_view(&self, asked_by: Uuid, target: apex_proto::ViewTarget) -> Result<()> {
        let sessions = self.list_sessions().await;
        sessions
            .iter()
            .find(|session| session.id == asked_by)
            .with_context(|| format!("session {asked_by} does not exist"))?;
        if let apex_proto::ViewTarget::Session { id } = &target
            && !sessions.iter().any(|session| session.id == *id)
        {
            bail!("session {id} does not exist")
        }
        self.registry.announce(Event::OpenView { target, asked_by });
        Ok(())
    }

    pub async fn preview(&self, asked_by: Uuid, path: &str) -> Result<String> {
        let sessions = self.list_sessions().await;
        let session = sessions
            .iter()
            .find(|session| session.id == asked_by)
            .with_context(|| format!("session {asked_by} does not exist"))?;

        let dir = apex_core::preview::ensure(std::path::Path::new(&session.cwd))?;
        let wanted = path.trim_start_matches('/');
        apex_core::files::resolve(&dir, wanted).with_context(|| {
            format!("{wanted} is not in {}, write the page there and ask again", dir.display())
        })?;

        let server = self
            .preview
            .get_or_try_init(crate::preview::PreviewServer::start)
            .await
            .context("could not open the preview port")?;
        let url = server.url(&server.issue(&dir, asked_by).await, wanted);
        self.registry.announce(Event::OpenView {
            target: apex_proto::ViewTarget::Url { url: url.clone() },
            asked_by,
        });
        Ok(url)
    }

    pub async fn close_view(&self, asked_by: Uuid, target: apex_proto::ViewTarget) -> Result<()> {
        self.list_sessions()
            .await
            .iter()
            .find(|session| session.id == asked_by)
            .with_context(|| format!("session {asked_by} does not exist"))?;
        self.registry.announce(Event::CloseView { target, asked_by });
        Ok(())
    }

    pub async fn spawn(
        &self,
        parent: Uuid,
        agent: &str,
        task: Option<String>,
        isolation: Isolation,
    ) -> Result<SessionSummary> {
        self.spawn_tagged(parent, agent, task, isolation, None).await
    }

    async fn spawn_tagged(
        &self,
        parent: Uuid,
        agent: &str,
        task: Option<String>,
        isolation: Isolation,
        run: Option<Uuid>,
    ) -> Result<SessionSummary> {
        let known = self.list_agents().await;
        match known.iter().find(|found| found.name == agent) {
            Some(found) if !found.agentic => {
                bail!("{agent} is a plain terminal, it does not read a task")
            }
            Some(_) => {}
            None => {
                let named: Vec<&str> = known
                    .iter()
                    .filter(|found| found.is_available() && found.agentic)
                    .map(|found| found.name.as_str())
                    .collect();
                bail!("there is no agent called {agent} — you can use {}", named.join(", "))
            }
        }

        let sessions = self.list_sessions().await;
        let caller = sessions
            .iter()
            .find(|session| session.id == parent)
            .with_context(|| format!("session {parent} does not exist"))?;
        if depth_of(&sessions, caller) >= SPAWN_DEPTH_CAP {
            bail!(
                "you were spawned by another agent, so you cannot spawn a third generation.                  Ask the person driving Apex to start it."
            )
        }

        let session = self
            .create(NewSession {
                project: caller.project_id,
                agent: agent.to_owned(),
                cwd: None,
                size: TerminalSize::default(),
                isolation,
                slug: None,
                mode: None,
                parent: Some(parent),
                run,
                unattended: false,
            })
            .await?;

        self.registry.announce(Event::OpenView {
            target: apex_proto::ViewTarget::Session { id: session.id },
            asked_by: parent,
        });

        if let Some(task) = task.filter(|text| !text.trim().is_empty()) {
            self.hand_over(&session, task).await?;
        }

        Ok(session)
    }

    pub async fn resume(
        &self,
        project: Uuid,
        agent: &str,
        session_id: &str,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        Arc::clone(&self.registry).resume(project, agent, session_id, size).await
    }

    pub async fn run_task(
        &self,
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
        if let Some(server) = self.preview.get() {
            server.revoke(id).await;
        }
        if self.acp.get(id).await.is_some() {
            return self.acp.close(id).await;
        }
        self.registry.close(id, disposal).await
    }

    pub async fn shutdown(&self) {
        self.acp.kill_all().await;
        self.registry.kill_all().await;
    }

    pub fn set_idle_grace(&self, seconds: u32) {
        self.idle_grace.store(seconds as u64, Ordering::Relaxed);
    }

    pub fn idle_grace(&self) -> Arc<AtomicU64> {
        Arc::clone(&self.idle_grace)
    }

    pub fn idle_since(&self) -> Arc<std::sync::Mutex<Option<Instant>>> {
        Arc::clone(&self.idle_since)
    }

    pub fn idle_for(&self) -> Option<Duration> {
        let since = self.idle_since.lock().ok()?;
        since.map(|start| start.elapsed())
    }

    pub fn uptime(&self) -> Duration {
        self.started.elapsed()
    }

    pub fn clients(&self) -> Arc<AtomicUsize> {
        Arc::clone(&self.clients)
    }

    pub fn notify(&self, title: Option<String>, body: String) {
        self.registry.announce(Event::Notify {
            session: None,
            notice: apex_proto::NotifyKind::Message,
            title,
            body,
        });
    }

    pub fn client_count(&self) -> usize {
        self.clients.load(Ordering::SeqCst)
    }

    pub async fn daemon_report(&self) -> DaemonReport {
        let sessions = self.list_sessions().await;
        let live = sessions.iter().filter(|session| session.exit_code.is_none()).count();
        let grace = self.idle_grace.load(Ordering::Relaxed);
        let idle_for = self.idle_for().map(|elapsed| elapsed.as_secs());
        let remaining = if grace == u64::from(IDLE_GRACE_NEVER) {
            None
        } else {
            idle_for.map(|spent| grace.saturating_sub(spent))
        };
        DaemonReport {
            daemon_version: env!("CARGO_PKG_VERSION").to_string(),
            protocol_version: PROTOCOL_VERSION,
            uptime: self.uptime().as_secs(),
            idle_grace: grace.min(u64::from(u32::MAX)) as u32,
            idle_for,
            remaining,
            clients: self.client_count().min(u32::MAX as usize) as u32,
            sessions: sessions.len().min(u32::MAX as usize) as u32,
            live: live.min(u32::MAX as usize) as u32,
        }
    }

    pub async fn transcript(&self, id: Uuid, tail: usize, plain: bool) -> Result<String> {
        self.registry.transcript(id, tail, plain).await
    }

    pub async fn tell(&self, id: Uuid, text: String) -> Result<()> {
        if self.acp.get(id).await.is_some() {
            return self.acp_prompt(id, text).await;
        }
        self.await_first_paint(id).await;
        self.await_unblocked(id).await;
        self.type_into(id, &text).await
    }

    async fn hand_over(&self, session: &SessionSummary, task: String) -> Result<()> {
        if session.mode == apex_proto::AgentMode::Acp {
            return self.acp_prompt(session.id, task).await;
        }
        self.tell(session.id, task).await
    }

    async fn await_first_paint(&self, id: Uuid) {
        let deadline = std::time::Instant::now() + STARTUP_GRACE;
        while std::time::Instant::now() < deadline {
            match self.registry.transcript(id, 4096, false).await {
                Ok(seen) if !seen.trim().is_empty() => break,
                Ok(_) => {}
                Err(_) => return,
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        tokio::time::sleep(SETTLE_AFTER_PAINT).await;
    }

    async fn await_unblocked(&self, id: Uuid) {
        let deadline = std::time::Instant::now() + BLOCKED_GRACE;
        let mut waited = false;
        while std::time::Instant::now() < deadline {
            let sessions = self.list_sessions().await;
            let Some(mine) = sessions.iter().find(|session| session.id == id) else {
                return;
            };
            if mine.state != SessionState::Blocked {
                break;
            }
            waited = true;
            tokio::time::sleep(POLL_WHILE_BLOCKED).await;
        }
        if waited {
            tokio::time::sleep(SETTLE_AFTER_PAINT).await;
        }
    }

    async fn type_into(&self, id: Uuid, text: &str) -> Result<()> {
        let typed = text.replace(['\n', '\r'], " ");
        let probe = probe_of(&typed);
        let trace: String = probe.chars().take(TRACE_LEN).collect();
        let mut retyped = 0;
        let mut unblocked = 0;
        loop {
            self.write(id, &typed).await?;
            if self.await_echo(id, &probe).await {
                tokio::time::sleep(BEFORE_ENTER).await;
                return self.write(id, "\r").await;
            }
            if unblocked < BLOCKED_TRIES && self.blocked_now(id).await {
                unblocked += 1;
                self.await_unblocked(id).await;
                continue;
            }
            if self.echoed(id, &trace).await {
                break;
            }
            retyped += 1;
            if retyped >= TYPING_TRIES {
                break;
            }
        }
        bail!("never saw the task appear on screen, it is showing: {}", self.on_screen(id).await)
    }

    async fn await_echo(&self, id: Uuid, probe: &str) -> bool {
        let deadline = std::time::Instant::now() + ECHO_GRACE;
        while std::time::Instant::now() < deadline {
            if self.echoed(id, probe).await {
                return true;
            }
            tokio::time::sleep(ECHO_POLL).await;
        }
        false
    }

    async fn blocked_now(&self, id: Uuid) -> bool {
        self.list_sessions()
            .await
            .iter()
            .find(|session| session.id == id)
            .is_some_and(|session| session.state == SessionState::Blocked)
    }

    async fn on_screen(&self, id: Uuid) -> String {
        let Ok(seen) = self.registry.transcript(id, 4096, true).await else {
            return "nothing".to_owned();
        };
        let tail: String = seen
            .lines()
            .rev()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .take(3)
            .collect::<Vec<_>>()
            .join(" / ");
        if tail.is_empty() { "nothing".to_owned() } else { tail.chars().take(160).collect() }
    }

    async fn echoed(&self, id: Uuid, probe: &str) -> bool {
        if probe.is_empty() {
            return true;
        }
        match self.registry.transcript(id, 16384, true).await {
            Ok(seen) => squash(&seen).contains(probe),
            Err(_) => true,
        }
    }

    pub async fn call_it_done(&self, id: Uuid, summary: Option<String>) -> Result<()> {
        let sessions = self.list_sessions().await;
        let mine = sessions
            .iter()
            .find(|session| session.id == id)
            .with_context(|| format!("session {id} does not exist"))?;
        let parent = mine.parent.context("only a session an agent started can call itself done")?;

        if let Some(summary) = summary.filter(|text| !text.trim().is_empty()) {
            self.context_note(mine.project_id, &mine.title, Some(&parent.to_string()), &summary)
                .await?;
        }

        if self.acp.get(id).await.is_some() {
            return self.acp.finish(id).await;
        }
        self.registry.finish(id).await
    }

    pub async fn dismiss(&self, asked_by: Uuid, id: Uuid) -> Result<()> {
        let sessions = self.list_sessions().await;
        let wanted = sessions
            .iter()
            .find(|session| session.id == id)
            .with_context(|| format!("session {id} does not exist"))?;
        if wanted.parent != Some(asked_by) {
            bail!("you can only close the sessions you started yourself")
        }
        self.close(id, WorktreeDisposal::Keep).await
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

    pub async fn write_file(
        &self,
        project: Uuid,
        path: &str,
        text: String,
        revision: Option<String>,
    ) -> Result<String> {
        self.files.write_file(project, path, text, revision).await
    }

    pub async fn list_editors(&self) -> Vec<EditorSummary> {
        self.files.list_editors().await
    }

    pub async fn sweep_rejects(&self) {
        self.rejects.sweep().await;
    }

    pub async fn browser_report(&self, project: Uuid, pane: String, url: String) {
        self.browsers.report(project, pane, url).await;
    }

    pub async fn browser_forget(&self, pane: &str) {
        self.browsers.forget(pane).await;
    }

    pub async fn browser_page(&self, project: Uuid) -> String {
        self.browsers.page(project).await
    }

    pub fn api_list(&self, project: Uuid) -> (Vec<apex_proto::ApiEntry>, Vec<String>) {
        let root = self.paths.api_dir(project);
        (apex_core::api::entries(&root), apex_core::api::environments(&root))
    }

    pub fn api_read(
        &self,
        project: Uuid,
        name: &str,
    ) -> Result<(apex_proto::ApiRequest, Option<apex_proto::ApiRun>)> {
        let root = self.paths.api_dir(project);
        Ok((apex_core::api::load(&root, name)?, self.api.last(&root, name)))
    }

    pub fn api_write(
        &self,
        project: Uuid,
        name: &str,
        request: &apex_proto::ApiRequest,
    ) -> Result<()> {
        let root = self.paths.api_dir(project);
        apex_core::api::ensure(&root)?;
        apex_core::api::save(&root, name, request)?;
        self.registry.announce(Event::ApiChanged { project, name: name.to_owned() });
        Ok(())
    }

    pub fn api_remove(&self, project: Uuid, name: &str) -> Result<()> {
        apex_core::api::remove(&self.paths.api_dir(project), name)?;
        self.registry.announce(Event::ApiChanged { project, name: name.to_owned() });
        Ok(())
    }

    pub fn api_env_read(&self, project: Uuid, name: &str) -> Result<Vec<apex_proto::ApiVariable>> {
        apex_core::api::read_environment(&self.paths.api_dir(project), name)
    }

    pub fn api_env_write(
        &self,
        project: Uuid,
        name: &str,
        variables: &[apex_proto::ApiVariable],
    ) -> Result<()> {
        let root = self.paths.api_dir(project);
        apex_core::api::ensure(&root)?;
        apex_core::api::write_environment(&root, name, variables)
    }

    pub fn api_env_remove(&self, project: Uuid, name: &str) -> Result<()> {
        apex_core::api::remove_environment(&self.paths.api_dir(project), name)
    }

    pub async fn api_send(
        &self,
        project: Uuid,
        name: &str,
        environment: Option<&str>,
    ) -> Result<apex_proto::ApiRun> {
        let root = self.paths.api_dir(project);
        apex_core::api::ensure(&root)?;
        self.api.send(&root, name, environment).await
    }

    pub async fn browser_logs(&self, project: Uuid) -> Result<String> {
        let taken = self.ask_page(project).await?;
        Ok(crate::services::browsers::describe_logs(&taken))
    }

    async fn ask_page(&self, project: Uuid) -> Result<crate::services::browsers::Snapshot> {
        let raw = self.ask_browser(project, |request| Event::AskPage { request }).await?;
        serde_json::from_str(&raw).context("the browser answered with something unreadable")
    }

    pub async fn browser_shot(&self, project: Uuid) -> Result<String> {
        self.ask_browser(project, |request| Event::AskShot { request }).await
    }

    async fn ask_browser(&self, project: Uuid, shape: impl Fn(Uuid) -> Event) -> Result<String> {
        self.browsers.showing(project).await.map_err(anyhow::Error::msg)?;
        let request = Uuid::new_v4();
        let waiting = self.browsers.expect(request).await;
        self.registry.announce(shape(request));
        let answered = tokio::time::timeout(std::time::Duration::from_secs(5), waiting)
            .await
            .map_err(|_| anyhow::anyhow!("the desktop did not answer in time"));
        match answered {
            Ok(Ok(Ok(answer))) => Ok(answer),
            Ok(Ok(Err(error))) => bail!(error),
            Ok(Err(_)) => bail!("the desktop dropped the request"),
            Err(error) => {
                self.browsers.give_up(request).await;
                Err(error)
            }
        }
    }

    pub async fn pane_answered(
        &self,
        request: Uuid,
        answer: Option<String>,
        error: Option<String>,
    ) {
        let settled = match answer {
            Some(answer) => Ok(answer),
            None => Err(error.unwrap_or_else(|| "the pane did not answer".into())),
        };
        self.browsers.settle(request, settled).await;
    }

    pub fn open_url(&self, url: &str) -> anyhow::Result<()> {
        self.files.open_url(url)
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

    pub async fn git_images(
        &self,
        project: Uuid,
        target: GitTarget,
        path: &str,
        commit: Option<String>,
    ) -> Result<ImagePair> {
        let dir = self.git_dir(project, &target).await?;
        self.git.images(&dir, path, commit).await
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

    pub async fn git_sync(&self, project: Uuid, target: GitTarget, op: GitSyncOp) -> Result<()> {
        let dir = self.git_dir(project, &target).await?;
        self.git.sync(&dir, op).await
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

    async fn git_branch(&self, project: Uuid, target: &GitTarget) -> Result<String> {
        let dir = self.git_dir(project, target).await?;
        let branch = tokio::task::spawn_blocking(move || apex_git::current_branch(&dir)).await??;
        Ok(crate::services::rejects::require_branch(&branch)?.to_owned())
    }

    pub async fn git_reject_hunk(
        &self,
        project: Uuid,
        target: GitTarget,
        patch: String,
    ) -> Result<()> {
        let dir = self.git_dir(project, &target).await?;
        let branch = self.git_branch(project, &target).await?;
        self.rejects.reject(&dir, project, &branch, patch).await
    }

    pub async fn git_rejects(&self, project: Uuid, target: GitTarget) -> Result<Vec<RejectedHunk>> {
        let branch = self.git_branch(project, &target).await?;
        self.rejects.list(project, &branch).await
    }

    pub async fn git_restore_reject(
        &self,
        project: Uuid,
        target: GitTarget,
        id: &str,
    ) -> Result<()> {
        let dir = self.git_dir(project, &target).await?;
        let branch = self.git_branch(project, &target).await?;
        self.rejects.restore(&dir, project, &branch, id).await
    }

    pub async fn git_clear_rejects(&self, project: Uuid, target: GitTarget) -> Result<()> {
        let branch = self.git_branch(project, &target).await?;
        self.rejects.clear(project, &branch).await
    }

    pub async fn git_pending(&self, project: Uuid) -> Result<Vec<PendingReview>> {
        let root = PathBuf::from(self.project_root(project).await?);
        let mut reviews = self.git.pending(&root).await?;
        let sessions = self.list_sessions().await;
        for review in &mut reviews {
            let GitTarget::Worktree { path } = &review.target else {
                continue;
            };
            let owner = sessions.iter().find(|session| {
                session.project_id == project
                    && session.worktree.as_ref().is_some_and(|tree| &tree.path == path)
            });
            if let Some(session) = owner {
                review.title = Some(session.title.clone());
                review.state = Some(session.state);
                review.target = GitTarget::Session { id: session.id };
            }
        }
        reviews.sort_by_key(|review| waiting_rank(review.state));
        Ok(reviews)
    }

    pub async fn git_branches(&self, project: Uuid, target: GitTarget) -> Result<Vec<GitBranch>> {
        let dir = self.git_dir(project, &target).await?;
        self.git.branches(&dir).await
    }

    pub async fn git_checkout(
        &self,
        project: Uuid,
        target: GitTarget,
        branch: String,
    ) -> Result<()> {
        let dir = self.git_dir(project, &target).await?;
        self.git.checkout(&dir, branch).await
    }

    pub async fn list_worktrees(&self, project: Uuid) -> Result<Vec<WorktreeEntry>> {
        let root = PathBuf::from(self.project_root(project).await?);
        self.git.list_worktrees(&root).await
    }

    pub async fn prune_worktrees(&self, project: Uuid) -> Result<Vec<String>> {
        let root = PathBuf::from(self.project_root(project).await?);
        let mut removed = Vec::new();
        for entry in self.list_worktrees(project).await? {
            if entry.changed > 0 {
                continue;
            }
            let branch = entry.branch.clone();
            let unmerged = tokio::task::spawn_blocking({
                let root = root.clone();
                move || apex_git::unmerged_count(&root, &branch)
            })
            .await?
            .unwrap_or(1);
            if unmerged > 0 {
                continue;
            }
            if self
                .remove_worktree(project, entry.path.clone(), Some(entry.branch.clone()))
                .await
                .is_ok()
            {
                removed.push(entry.path);
            }
        }
        Ok(removed)
    }

    pub async fn merge_worktree(&self, project: Uuid, target: GitTarget) -> Result<MergeReport> {
        let root = PathBuf::from(self.project_root(project).await?);
        let dir = self.git_dir(project, &target).await?;
        self.git.merge(&root, &dir).await
    }

    pub async fn remove_worktree(
        &self,
        project: Uuid,
        path: String,
        branch: Option<String>,
    ) -> Result<()> {
        let root = PathBuf::from(self.project_root(project).await?);
        let busy = self.list_sessions().await.into_iter().any(|session| {
            session.exit_code.is_none() && session.worktree.is_some_and(|tree| tree.path == path)
        });
        if busy {
            bail!("a session is still running in {path}")
        }
        tokio::task::spawn_blocking(move || {
            apex_git::remove_worktree(&root, &PathBuf::from(&path), branch.as_deref())
        })
        .await?
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
            .flat_map(|profile| {
                apex_core::history::read_history(profile, &PathBuf::from(&root), &home)
            })
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

    pub async fn remove_project(&self, project: Uuid) -> Result<()> {
        let live = self
            .list_sessions()
            .await
            .into_iter()
            .filter(|session| session.project_id == project && session.exit_code.is_none())
            .count();
        if live > 0 {
            bail!("close the {live} running sessions before removing this project")
        }
        self.projects.remove(project).await
    }

    pub async fn save_layout(&self, project: Uuid, payload: &str) -> Result<()> {
        self.projects.save_layout(project, payload).await
    }

    pub async fn load_layout(&self, project: Uuid) -> Result<Option<String>> {
        self.projects.load_layout(project).await
    }

    pub async fn mcp_adopt(&self, agent: &str, enabled: bool) -> Result<String> {
        let profile = self.profiles.get(agent).context(format!("unknown agent {agent}"))?;
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
                match self.registry.require(*id).await?.snapshot_summary().await.worktree {
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

fn squash(text: &str) -> String {
    text.chars().filter(|letter| !letter.is_whitespace()).collect()
}

fn probe_of(text: &str) -> String {
    squash(text).chars().take(PROBE_LEN).collect()
}

fn waiting_rank(state: Option<SessionState>) -> u8 {
    match state {
        Some(SessionState::Done) => 0,
        Some(SessionState::Blocked) => 1,
        Some(SessionState::Idle) => 2,
        Some(SessionState::Working) => 3,
        None => 4,
    }
}

fn depth_of(sessions: &[SessionSummary], session: &SessionSummary) -> usize {
    let mut depth = 0;
    let mut ancestor = session.parent;
    while let Some(id) = ancestor {
        depth += 1;
        if depth > sessions.len() {
            break;
        }
        ancestor = sessions.iter().find(|found| found.id == id).and_then(|found| found.parent);
    }
    depth
}

fn silent(provider: &apex_agent::Provider) -> String {
    match &provider.base_url {
        Some(url) => format!("{} did not answer at {url}", provider.label),
        None => format!("{} did not answer", provider.label),
    }
}

fn home_directory() -> PathBuf {
    directories::UserDirs::new()
        .map(|dirs| dirs.home_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("/"))
}

impl SessionManager {
    pub fn providers(&self) -> anyhow::Result<Vec<apex_proto::ProviderStatus>> {
        let set = apex_agent::ProviderSet::load(&self.paths.providers_dir())?;
        let mut listed = Vec::new();
        for provider in set.iter() {
            listed.push(apex_proto::ProviderStatus {
                name: provider.name.clone(),
                label: provider.label.clone(),
                base_url: provider.base_url.clone(),
                env: provider.env.clone(),
                keyless: provider.keyless,
                added: set.was_added(&provider.name),
                in_env: provider.key_from_env().is_some(),
                held: apex_agent::key::find(provider)?.map(|found| match found.from {
                    apex_agent::key::Source::Keychain => apex_proto::KeyFrom::Keychain,
                    apex_agent::key::Source::Environment => apex_proto::KeyFrom::Environment,
                }),
            });
        }
        Ok(listed)
    }

    pub async fn provider_add(
        &self,
        name: &str,
        label: &str,
        base_url: &str,
        key: &str,
    ) -> anyhow::Result<()> {
        let provider = apex_agent::Provider::custom(name, label, base_url, key.trim().is_empty())?;
        apex_agent::model::list(&provider.dial(key)?).await.with_context(|| silent(&provider))?;
        if !key.trim().is_empty() {
            apex_agent::key::keep(&provider.name, key)?;
        }
        apex_agent::provider::write(&self.paths.providers_dir(), &provider)
    }

    pub async fn provider_keep(&self, provider: &str, key: &str) -> anyhow::Result<()> {
        let found = self.provider(provider)?;
        if key.trim().is_empty() && !found.keyless {
            anyhow::bail!("{} needs a key", found.label)
        }
        apex_agent::model::list(&found.dial(key)?).await.with_context(|| silent(&found))?;
        match key.trim().is_empty() {
            true => apex_agent::provider::write(&self.paths.providers_dir(), &found),
            false => apex_agent::key::keep(&found.name, key),
        }
    }

    pub fn provider_forget(&self, provider: &str) -> anyhow::Result<()> {
        let found = self.provider(provider)?;
        apex_agent::key::forget(&found.name)?;
        self.unchoose(&found.name)
    }

    pub fn provider_drop(&self, provider: &str) -> anyhow::Result<()> {
        let found = self.provider(provider)?;
        apex_agent::provider::erase(&self.paths.providers_dir(), &found.name)?;
        apex_agent::key::forget(&found.name)?;
        self.unchoose(&found.name)
    }

    fn unchoose(&self, provider: &str) -> anyhow::Result<()> {
        match self.agent_chosen().is_some_and(|choice| choice.provider == provider) {
            true => apex_agent::choice::erase(&self.paths.agent_dir()),
            false => Ok(()),
        }
    }

    pub async fn provider_models(
        &self,
        provider: &str,
    ) -> anyhow::Result<Vec<apex_proto::AgentModel>> {
        let found = self.provider(provider)?;
        let held = match apex_agent::key::find(&found)? {
            Some(found) => found.key,
            None if found.keyless => String::new(),
            None => anyhow::bail!("{} has no key yet", found.name),
        };
        Ok(apex_agent::model::list(&found.dial(&held)?)
            .await
            .with_context(|| silent(&found))?
            .into_iter()
            .map(|one| apex_proto::AgentModel {
                id: one.id,
                label: one.label,
                context: one.context,
            })
            .collect())
    }

    pub fn agent_chosen(&self) -> Option<apex_proto::AgentChoice> {
        apex_agent::choice::read(&self.paths.agent_dir()).map(|choice| apex_proto::AgentChoice {
            provider: choice.provider,
            model: choice.model,
        })
    }

    pub fn agent_choose(&self, provider: &str, model: &str) -> anyhow::Result<()> {
        let found = self.provider(provider)?;
        if model.trim().is_empty() {
            anyhow::bail!("that needs a model")
        }
        apex_agent::choice::write(
            &self.paths.agent_dir(),
            &apex_agent::Choice { provider: found.name, model: model.trim().to_owned() },
        )
    }

    fn provider(&self, provider: &str) -> anyhow::Result<apex_agent::Provider> {
        apex_agent::ProviderSet::load(&self.paths.providers_dir())?
            .get(provider)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("there is no provider called {provider}"))
    }
}
