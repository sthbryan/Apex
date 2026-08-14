use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use apex_core::{AgentProfile, BinaryResolver, ProfileSet, Store};
use std::collections::BTreeMap;
use apex_proto::{Event, SessionState, SessionSummary, TerminalSize};
use apex_pty::{PtyProcess, PtySpec};
use bytes::Bytes;
use tokio::sync::{Mutex, RwLock, broadcast};
use uuid::Uuid;

const EVENT_CHANNEL_DEPTH: usize = 256;

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
    project_id: Uuid,
    default_cwd: PathBuf,
    sessions: RwLock<HashMap<Uuid, Arc<LiveSession>>>,
    events: broadcast::Sender<Event>,
}

impl SessionManager {
    pub fn new(
        profiles: ProfileSet,
        resolver: BinaryResolver,
        store: Store,
        project_id: Uuid,
        default_cwd: PathBuf,
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
            project_id,
            default_cwd,
            sessions: RwLock::new(HashMap::new()),
            events,
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

    pub async fn create(
        self: &Arc<Self>,
        agent: &str,
        cwd: Option<String>,
        size: TerminalSize,
    ) -> Result<SessionSummary> {
        let profile = self
            .profiles
            .get(agent)
            .cloned()
            .with_context(|| format!("no existe el perfil {agent}"))?;
        let binary = self.resolve_binary(&profile).await?;
        let cwd = cwd.map(PathBuf::from).unwrap_or_else(|| self.default_cwd.clone());

        let mut spec = PtySpec::new(binary, &cwd);
        spec.args = profile.args.clone();
        spec.env = self.base_env.clone();
        spec.env.extend(profile.env.clone());
        spec.rows = size.rows;
        spec.cols = size.cols;

        let process = PtyProcess::spawn(spec)?;
        let title = self.next_title(&profile.name).await;
        let cwd_text = cwd.display().to_string();

        let record = {
            let store = self.store.lock().await;
            store.insert_session(self.project_id, &profile.name, &title, &cwd_text)?
        };

        let summary = SessionSummary {
            id: record.id,
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
}
