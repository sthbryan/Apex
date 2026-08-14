use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use apex_core::{AgentProfile, BinaryResolver, ProfileSet, Store, history};
use std::collections::BTreeMap;
use apex_proto::{
    Event, HistoryEntry, MetricsSnapshot, ProcessUsage, ProjectSummary, QuotaReport, QuotaWindow,
    SessionState, SessionSummary, SessionUsage, SystemUsage, TerminalSize,
};
use apex_metrics::Sampler;
use apex_pty::{PtyProcess, PtySpec, StateDetector, StatePatterns};
use apex_quota::QuotaCache;
use bytes::Bytes;
use std::time::Instant;
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

pub struct SessionManager {
    profiles: ProfileSet,
    base_env: BTreeMap<String, String>,
    resolver: Mutex<BinaryResolver>,
    store: Mutex<Store>,
    sessions: RwLock<HashMap<Uuid, Arc<LiveSession>>>,
    events: broadcast::Sender<Event>,
    sampler: Mutex<Sampler>,
    quotas: Mutex<QuotaCache>,
}

impl SessionManager {
    pub fn new(
        profiles: ProfileSet,
        resolver: BinaryResolver,
        store: Store,
    ) -> Self {
        let (events, _) = broadcast::channel(EVENT_CHANNEL_DEPTH);
        let base_env = resolver
            .environment()
            .map(|environment| environment.env().clone())
            .unwrap_or_default();
        Self {
            profiles,
            base_env,
            resolver: Mutex::new(resolver),
            store: Mutex::new(store),
            sessions: RwLock::new(HashMap::new()),
            events,
            sampler: Mutex::new(Sampler::new()),
            quotas: Mutex::new(QuotaCache::new()),
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
            bail!("{root} no es una carpeta")
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
            bail!("no se pudo terminar el proceso {pid}")
        }
        Ok(())
    }

    async fn read_quotas(&self, force: bool) -> Vec<QuotaReport> {
        let mut reports = Vec::new();
        for profile in self.profiles.iter() {
            let Some(config) = &profile.quota else {
                continue;
            };
            let Some(binary) = self.resolver.lock().await.resolve(&config.command) else {
                continue;
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
        let home = directories::UserDirs::new()
            .map(|dirs| dirs.home_dir().to_path_buf())
            .unwrap_or_else(|| PathBuf::from("/"));

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
            .with_context(|| format!("no existe el perfil {agent}"))?;
        let args = history::resume_args(profile, session_id)
            .with_context(|| format!("{agent} no sabe reanudar sesiones"))?;

        self.spawn(project, agent, None, size, Some(args)).await
    }

    pub async fn create(
        self: &Arc<Self>,
        project: Uuid,
        agent: &str,
        cwd: Option<String>,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        self.spawn(project, agent, cwd, size, None).await
    }

    async fn spawn(
        self: &Arc<Self>,
        project: Uuid,
        agent: &str,
        cwd: Option<String>,
        size: TerminalSize,
        override_args: Option<Vec<String>>,
    ) -> Result<SessionSummary> {
        let profile = self
            .profiles
            .get(agent)
            .cloned()
            .with_context(|| format!("no existe el perfil {agent}"))?;
        let binary = self.resolve_binary(&profile).await?;
        let project_root = self.project_root(project).await?;
        let cwd = cwd.map(PathBuf::from).unwrap_or_else(|| PathBuf::from(project_root));

        let mut spec = PtySpec::new(binary, &cwd);
        spec.args = override_args.unwrap_or_else(|| profile.args.clone());
        spec.env = self.base_env.clone();
        spec.env.extend(profile.env.clone());
        spec.rows = size.rows;
        spec.cols = size.cols;

        let process = PtyProcess::spawn(spec)?;
        let title = self.next_title(&profile.name).await;
        let cwd_text = cwd.display().to_string();

        let record = {
            let store = self.store.lock().await;
            store.insert_session(project, &profile.name, &title, &cwd_text)?
        };

        let summary = SessionSummary {
            id: record.id,
            project_id: project,
            agent: profile.name.clone(),
            title,
            cwd: cwd_text,
            state: SessionState::Idle,
            size,
            exit_code: None,
        };

        let session = Arc::new(LiveSession {
            summary: Mutex::new(summary.clone()),
            process,
        });
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

    pub async fn close(&self, id: Uuid) -> Result<()> {
        let Some(session) = self.sessions.write().await.remove(&id) else {
            bail!("la sesion {id} no existe")
        };
        let _ = session.process.kill();
        let store = self.store.lock().await;
        store.close_session(id)?;
        let _ = self.events.send(Event::SessionClosed { id });
        Ok(())
    }

    async fn project_root(&self, project: Uuid) -> Result<String> {
        let store = self.store.lock().await;
        Ok(store
            .project(project)?
            .with_context(|| format!("no existe el proyecto {project}"))?
            .root)
    }

    async fn require(&self, id: Uuid) -> Result<Arc<LiveSession>> {
        self.get(id).await.with_context(|| format!("la sesion {id} no existe"))
    }

    async fn resolve_binary(&self, profile: &AgentProfile) -> Result<PathBuf> {
        let mut resolver = self.resolver.lock().await;
        resolver
            .resolve(&profile.command)
            .with_context(|| format!("no se encontro \"{}\" en el PATH", profile.command))
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
        let patterns = StatePatterns::compile(
            &profile.state_patterns.blocked,
            &profile.state_patterns.done,
        );
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
