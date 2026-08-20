use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use anyhow::{Context, Result, bail};
use apex_core::{AgentProfile, ApexPaths, BinaryResolver, ProfileSet, Store, history};
use apex_proto::{
    AgentSummary, Event, Isolation, NotifyKind, SessionState, SessionSummary, TerminalSize,
    WorktreeDisposal, WorktreeInfo,
};
use apex_pty::{OscScanner, PtyProcess, PtySpec, StateDetector, StatePatterns, TerminalNotice};
use bytes::Bytes;
use tokio::sync::{Mutex, RwLock, broadcast};
use tokio::time::{MissedTickBehavior, interval};
use uuid::Uuid;

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

pub fn strip_terminal_codes(raw: &str) -> String {
    let mut clean = String::with_capacity(raw.len());
    let mut rest = raw.chars().peekable();
    while let Some(letter) = rest.next() {
        if letter != '\u{1b}' {
            if letter != '\r' && letter != '\u{7}' {
                clean.push(letter);
            }
            continue;
        }
        match rest.next() {
            Some('[') => {
                for ending in rest.by_ref() {
                    if ending.is_ascii_alphabetic() || ending == '~' {
                        break;
                    }
                }
            }
            Some(']') => {
                while let Some(ending) = rest.next() {
                    if ending == '\u{7}' {
                        break;
                    }
                    if ending == '\u{1b}' && rest.peek() == Some(&'\\') {
                        rest.next();
                        break;
                    }
                }
            }
            Some('(') | Some(')') => {
                rest.next();
            }
            _ => {}
        }
    }
    clean
}

pub struct Spawn {
    pub project: Uuid,
    pub agent: String,
    pub cwd: Option<String>,
    pub size: TerminalSize,
    pub override_args: Option<Vec<String>>,
    pub isolation: Isolation,
    pub slug: Option<String>,
    pub task: Option<String>,
    pub parent: Option<Uuid>,
}

pub struct SessionRegistry {
    paths: ApexPaths,
    profiles: ProfileSet,
    base_env: BTreeMap<String, String>,
    resolver: Arc<Mutex<BinaryResolver>>,
    store: Arc<Mutex<Store>>,
    sessions: Arc<RwLock<HashMap<Uuid, Arc<LiveSession>>>>,
    events: broadcast::Sender<Event>,
}

impl SessionRegistry {
    pub fn new(
        paths: ApexPaths,
        profiles: ProfileSet,
        resolver: Arc<Mutex<BinaryResolver>>,
        store: Arc<Mutex<Store>>,
        base_env: BTreeMap<String, String>,
        events: broadcast::Sender<Event>,
    ) -> Self {
        let sessions = Arc::new(RwLock::new(HashMap::new()));
        for profile in profiles.iter() {
            if let Some(delivery) = &profile.mcp
                && let Err(error) = crate::mcp_delivery::withdraw(delivery, &paths.home)
            {
                tracing::warn!(agent = %profile.name, %error, "could not clear a stale MCP entry");
            }
        }
        Self { paths, profiles, base_env, resolver, store, sessions, events }
    }

    pub fn announce(&self, event: Event) {
        let _ = self.events.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.events.subscribe()
    }

    pub fn sessions_map(&self) -> Arc<RwLock<HashMap<Uuid, Arc<LiveSession>>>> {
        Arc::clone(&self.sessions)
    }

    pub async fn list_agents(&self) -> Vec<AgentSummary> {
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

    pub async fn resume(
        self: &Arc<Self>,
        project: Uuid,
        agent: &str,
        session_id: &str,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        let profile =
            self.profiles.get(agent).with_context(|| format!("unknown profile {agent}"))?;
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
            parent: None,
        })
        .await
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
            parent: None,
        })
        .await
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

        self.withdraw_shared_mcp(&summary.agent).await;

        let store = self.store.lock().await;
        store.close_session(id)?;
        let _ = self.events.send(Event::SessionClosed { id });
        Ok(())
    }

    async fn withdraw_shared_mcp(&self, agent: &str) {
        let Some(delivery) = self.profiles.get(agent).and_then(|profile| profile.mcp.clone())
        else {
            return;
        };
        let sessions = self.sessions.read().await;
        for session in sessions.values() {
            if session.summary.lock().await.agent == agent {
                return;
            }
        }
        drop(sessions);
        if let Err(error) = crate::mcp_delivery::withdraw(&delivery, &self.paths.home) {
            tracing::warn!(%agent, %error, "could not take our MCP entry back out");
        }
    }

    pub async fn kill_all(&self) {
        let ids: Vec<Uuid> = self.sessions.read().await.keys().cloned().collect();
        for id in ids {
            match self.close(id, WorktreeDisposal::Keep).await {
                Ok(()) => {}
                Err(error) => tracing::warn!(%id, %error, "could not close session on shutdown"),
            }
        }
    }

    pub async fn transcript(&self, id: Uuid, tail: usize, plain: bool) -> Result<String> {
        let session = self.require(id).await?;
        let snapshot = session.process.snapshot();
        let start = snapshot.len().saturating_sub(tail);
        let text = String::from_utf8_lossy(&snapshot[start..]).into_owned();
        Ok(if plain { strip_terminal_codes(&text) } else { text })
    }

    pub async fn task_running(&self, project: Uuid, task: &str) -> bool {
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

    pub async fn project_root(&self, project: Uuid) -> Result<String> {
        let store = self.store.lock().await;
        Ok(store.project(project)?.with_context(|| format!("unknown project {project}"))?.root)
    }

    pub async fn require(&self, id: Uuid) -> Result<Arc<LiveSession>> {
        self.get(id).await.with_context(|| format!("session {id} does not exist"))
    }

    pub async fn spawn(self: &Arc<Self>, request: Spawn) -> Result<SessionSummary> {
        let Spawn { project, agent, cwd, size, override_args, isolation, slug, task, parent } =
            request;
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
            match crate::mcp_delivery::offer(
                record.id,
                delivery,
                &cwd,
                worktree.is_some(),
                &self.paths,
            ) {
                Ok(Some(flag)) => spec.args.extend(flag),
                Ok(None) => {}
                Err(error) => tracing::warn!(%error, "could not offer the MCP server"),
            }
        }
        spec.env = self.base_env.clone();
        spec.env.extend(profile.env.clone());
        spec.env.insert("APEX_SESSION".to_owned(), record.id.to_string());
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
            started_at: record.created_at,
            state: SessionState::Idle,
            size,
            exit_code: None,
            worktree: worktree.clone(),
            task: task.clone(),
            mode: apex_proto::AgentMode::Pty,
            parent,
        };

        let session = Arc::new(LiveSession { summary: Mutex::new(summary.clone()), process });
        self.sessions.write().await.insert(record.id, session.clone());
        let _ = self.events.send(Event::SessionOpened { session: summary.clone() });
        self.watch_state(record.id, session.clone(), &profile, size);
        self.watch_exit(record.id, session);

        Ok(summary)
    }

    async fn resolve_binary(&self, profile: &AgentProfile) -> Result<PathBuf> {
        let mut resolver = self.resolver.lock().await;
        let command = profile.launch_command();
        resolver.resolve(&command).with_context(|| format!("\"{command}\" was not found in PATH"))
    }

    pub async fn next_title(&self, agent: &str) -> String {
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

    pub async fn open_worktree(&self, project_root: &str, wanted: &str) -> Result<WorktreeInfo> {
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

    fn watch_state(
        self: &Arc<Self>,
        id: Uuid,
        session: Arc<LiveSession>,
        profile: &AgentProfile,
        size: TerminalSize,
    ) {
        let patterns =
            StatePatterns::compile(&profile.state_patterns.blocked, &profile.state_patterns.done);
        let bell = profile.notify.as_ref().is_some_and(|notify| notify.bell);
        let manager = self.clone();
        let mut output = session.process.subscribe();
        let produced_before_subscribing = session.process.snapshot();

        tokio::spawn(async move {
            let mut detector = StateDetector::new(patterns, size.rows, size.cols, Instant::now());
            let mut scanner = OscScanner::new(bell);
            if !produced_before_subscribing.is_empty()
                && let Some(state) = detector.observe(&produced_before_subscribing, Instant::now())
            {
                manager.publish_state(id, &session, state).await;
            }

            let mut ticker = interval(POLL_INTERVAL);
            ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);

            loop {
                let change = tokio::select! {
                    chunk = output.recv() => match chunk {
                        Ok(data) => {
                            let now = Instant::now();
                            for notice in scanner.scan(&data, now) {
                                manager.announce(notice_event(id, notice));
                            }
                            detector.observe(&data, now)
                        }
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
            if status.code != 0 {
                manager.announce(Event::Notify {
                    session: Some(id),
                    notice: NotifyKind::Exited,
                    title: None,
                    body: status.code.to_string(),
                });
            }
        });
    }

    pub async fn finish(&self, id: Uuid) -> Result<()> {
        let session = self.require(id).await?;
        self.publish_state(id, &session, SessionState::Done).await;
        Ok(())
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

fn notice_event(id: Uuid, notice: TerminalNotice) -> Event {
    Event::Notify {
        session: Some(id),
        notice: NotifyKind::Terminal,
        title: notice.title,
        body: notice.body,
    }
}
