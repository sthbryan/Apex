use std::collections::HashMap;

use apex_acp::{ContentBlock, SessionUpdate, ToolCall, ToolContent, ToolStatus};
use apex_proto::{
    AcpBody, AcpCommand, AcpDiff, AcpEntry, AcpOption, AcpPermission, AcpPlanEntry, AcpSnapshot,
    AcpToolCall, AcpToolStatus,
};

#[derive(Default)]
pub struct Transcript {
    entries: Vec<AcpEntry>,
    tools: HashMap<String, usize>,
    speaking: Option<usize>,
    thinking: Option<usize>,
    next_request: u32,
}

impl Transcript {
    pub fn entries(&self) -> Vec<AcpEntry> {
        self.entries.clone()
    }

    pub fn said(&mut self, text: &str) -> AcpEntry {
        self.speaking = None;
        self.thinking = None;
        self.push(AcpBody::User { text: text.to_owned() })
    }

    pub fn noticed(&mut self, text: &str) -> AcpEntry {
        self.speaking = None;
        self.thinking = None;
        self.push(AcpBody::Notice { text: text.to_owned() })
    }

    pub fn asked(&mut self, title: &str, options: Vec<AcpOption>) -> (u32, AcpEntry) {
        self.speaking = None;
        self.thinking = None;
        self.next_request += 1;
        let request = self.next_request;
        let ask = AcpPermission {
            request,
            title: title.to_owned(),
            options,
            decided: None,
        };
        (request, self.push(AcpBody::Permission { ask }))
    }

    pub fn decided(&mut self, request: u32, option: Option<String>) -> Option<AcpEntry> {
        let index = self.entries.iter().position(|entry| match &entry.body {
            AcpBody::Permission { ask } => ask.request == request,
            _ => false,
        })?;
        let AcpBody::Permission { ask } = &mut self.entries[index].body else {
            return None;
        };
        ask.decided = Some(option.unwrap_or_else(|| "cancelled".to_owned()));
        Some(self.entries[index].clone())
    }

    pub fn absorb(&mut self, update: SessionUpdate) -> Option<AcpEntry> {
        match update {
            SessionUpdate::UserMessageChunk { content } => Some(self.said(&content.as_text())),
            SessionUpdate::AgentMessageChunk { content } => Some(self.stream(&content, false)),
            SessionUpdate::AgentThoughtChunk { content } => Some(self.stream(&content, true)),
            SessionUpdate::ToolCall { call } | SessionUpdate::ToolCallUpdate { call } => {
                Some(self.tool(call))
            }
            SessionUpdate::Plan { entries } => {
                self.speaking = None;
                self.thinking = None;
                let entries = entries
                    .into_iter()
                    .map(|entry| AcpPlanEntry {
                        content: entry.content,
                        status: entry.status.unwrap_or_else(|| "pending".to_owned()),
                    })
                    .collect();
                Some(self.push(AcpBody::Plan { entries }))
            }
            SessionUpdate::CurrentModeUpdate { .. }
            | SessionUpdate::AvailableCommandsUpdate { .. } => None,
        }
    }

    fn stream(&mut self, content: &ContentBlock, thought: bool) -> AcpEntry {
        let text = content.as_text();
        let open = if thought { self.thinking } else { self.speaking };
        if let Some(index) = open {
            let grown = match &self.entries[index].body {
                AcpBody::Agent { text: before } | AcpBody::Thought { text: before } => {
                    format!("{before}{text}")
                }
                _ => text.clone(),
            };
            self.entries[index].body = if thought {
                AcpBody::Thought { text: grown }
            } else {
                AcpBody::Agent { text: grown }
            };
            return self.entries[index].clone();
        }

        let body = if thought {
            AcpBody::Thought { text }
        } else {
            AcpBody::Agent { text }
        };
        let entry = self.push(body);
        let index = entry.index as usize;
        if thought {
            self.thinking = Some(index);
            self.speaking = None;
        } else {
            self.speaking = Some(index);
            self.thinking = None;
        }
        entry
    }

    fn tool(&mut self, call: ToolCall) -> AcpEntry {
        self.speaking = None;
        self.thinking = None;

        if let Some(index) = self.tools.get(&call.tool_call_id).copied()
            && let AcpBody::Tool { call: known } = &self.entries[index].body
        {
            let merged = merge(known.clone(), call);
            self.entries[index].body = AcpBody::Tool { call: merged };
            return self.entries[index].clone();
        }

        let id = call.tool_call_id.clone();
        let entry = self.push(AcpBody::Tool { call: convert(call) });
        self.tools.insert(id, entry.index as usize);
        entry
    }

    fn push(&mut self, body: AcpBody) -> AcpEntry {
        let entry = AcpEntry { index: self.entries.len() as u32, body };
        self.entries.push(entry.clone());
        entry
    }
}

fn convert(call: ToolCall) -> AcpToolCall {
    let mut diffs = Vec::new();
    let mut text = String::new();
    for piece in &call.content {
        match piece {
            ToolContent::Content { content } => {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(&content.as_text());
            }
            ToolContent::Diff { path, old_text, new_text } => diffs.push(AcpDiff {
                path: path.clone(),
                old_text: old_text.clone(),
                new_text: new_text.clone(),
            }),
            ToolContent::Terminal { terminal_id } => {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(&format!("[terminal {terminal_id}]"));
            }
        }
    }

    AcpToolCall {
        title: call.title.unwrap_or_else(|| call.tool_call_id.clone()),
        kind: call.kind.unwrap_or_else(|| "other".to_owned()),
        status: status_of(call.status),
        call_id: call.tool_call_id,
        text,
        diffs,
        locations: call.locations.into_iter().map(|place| place.path).collect(),
    }
}

fn merge(known: AcpToolCall, update: ToolCall) -> AcpToolCall {
    let fresh = convert(update);
    AcpToolCall {
        call_id: known.call_id,
        title: if fresh.title == fresh.call_id { known.title } else { fresh.title },
        kind: if fresh.kind == "other" { known.kind } else { fresh.kind },
        status: fresh.status,
        text: if fresh.text.is_empty() { known.text } else { fresh.text },
        diffs: if fresh.diffs.is_empty() { known.diffs } else { fresh.diffs },
        locations: if fresh.locations.is_empty() { known.locations } else { fresh.locations },
    }
}

fn sign_in_hint(hello: &apex_acp::Initialized) -> Option<String> {
    let ways: Vec<String> = hello
        .auth_methods
        .iter()
        .filter_map(|method| method.description.clone().or_else(|| Some(method.name.clone())))
        .filter(|way| !way.is_empty())
        .collect();
    match ways.is_empty() {
        true => None,
        false => Some(format!("If it never answers, it may not be signed in: {}", ways.join(" · "))),
    }
}

fn status_of(status: Option<ToolStatus>) -> AcpToolStatus {
    match status {
        Some(ToolStatus::Pending) | None => AcpToolStatus::Pending,
        Some(ToolStatus::InProgress) => AcpToolStatus::Running,
        Some(ToolStatus::Completed) => AcpToolStatus::Completed,
        Some(ToolStatus::Failed) => AcpToolStatus::Failed,
    }
}

use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use apex_acp::{Agent, Client, PermissionOutcome, PermissionRequest, StopReason};
use apex_core::{BinaryResolver, ProfileSet, Store};
use apex_proto::{AgentMode, Event, SessionState, SessionSummary, TerminalSize};
use tokio::sync::{Mutex, RwLock, broadcast, oneshot};
use uuid::Uuid;

type Decisions = Arc<Mutex<std::collections::HashMap<u32, oneshot::Sender<Option<String>>>>>;
const HANDSHAKE_PATIENCE: std::time::Duration = std::time::Duration::from_secs(90);

type Shared = Arc<Mutex<SessionSummary>>;
type Commands = Arc<Mutex<Vec<AcpCommand>>>;

pub struct AcpSession {
    pub summary: Shared,
    agent: Agent,
    remote: String,
    transcript: Arc<Mutex<Transcript>>,
    decisions: Decisions,
    commands: Commands,
    auth: Option<String>,
}

impl AcpSession {
    pub async fn snapshot_summary(&self) -> SessionSummary {
        self.summary.lock().await.clone()
    }

    pub async fn snapshot(&self) -> AcpSnapshot {
        AcpSnapshot {
            entries: self.transcript.lock().await.entries(),
            commands: self.commands.lock().await.clone(),
        }
    }

    async fn explain(&self, reason: StopReason) -> String {
        let headline = match reason {
            StopReason::EndTurn => "The agent finished the turn without saying anything.",
            StopReason::MaxTokens => "The agent ran out of tokens before saying anything.",
            StopReason::MaxTurnRequests => "The agent hit its request limit before saying anything.",
            StopReason::Refusal => "The agent refused to answer.",
            StopReason::Cancelled => "The turn was cancelled.",
        };
        let complaints = self.agent.complaints().await;
        let hint = match &self.auth {
            Some(hint) if complaints.is_empty() => format!("\n{hint}"),
            _ => String::new(),
        };
        match complaints.is_empty() {
            true => format!("{headline}{hint}"),
            false => format!("{headline}\n{complaints}"),
        }
    }

    pub async fn decide(&self, request: u32, option: Option<String>) -> Result<()> {
        let waiting = self.decisions.lock().await.remove(&request);
        waiting
            .context("that question is no longer open")?
            .send(option)
            .map_err(|_| anyhow::anyhow!("nobody is waiting for that answer"))
    }

    pub fn cancel(&self) -> Result<()> {
        self.agent.cancel(&self.remote)
    }

    pub async fn wait(&self) -> i32 {
        self.agent.wait().await
    }

    pub async fn kill(&self) -> Result<()> {
        self.agent.kill().await
    }
}

struct Relay {
    id: Uuid,
    summary: Shared,
    transcript: Arc<Mutex<Transcript>>,
    decisions: Decisions,
    commands: Commands,
    events: broadcast::Sender<Event>,
    root: PathBuf,
}

impl Relay {
    fn publish(&self, entry: AcpEntry) {
        let _ = self.events.send(Event::AcpUpdated { id: self.id, entry });
    }

    async fn moved_to(&self, state: SessionState) {
        {
            let mut summary = self.summary.lock().await;
            if summary.exit_code.is_some() {
                return;
            }
            summary.state = state;
        }
        let _ = self.events.send(Event::SessionStateChanged { id: self.id, state });
    }

    fn within_project(&self, path: &str) -> Result<PathBuf> {
        let candidate = PathBuf::from(path);
        if !candidate.is_absolute() || !candidate.starts_with(&self.root) {
            bail!("{path} is outside this project")
        }
        Ok(candidate)
    }
}

#[async_trait::async_trait]
impl Client for Relay {
    async fn update(&mut self, _session: &str, update: apex_acp::SessionUpdate) {
        if let apex_acp::SessionUpdate::AvailableCommandsUpdate { available_commands } = update {
            let offered: Vec<AcpCommand> = available_commands
                .into_iter()
                .map(|command| AcpCommand {
                    name: command.name,
                    description: command.description,
                })
                .collect();
            *self.commands.lock().await = offered.clone();
            let _ = self.events.send(Event::AcpCommands { id: self.id, commands: offered });
            return;
        }
        if let Some(entry) = self.transcript.lock().await.absorb(update) {
            self.publish(entry);
        }
    }

    async fn permission(&mut self, request: PermissionRequest) -> PermissionOutcome {
        let title = request
            .tool_call
            .title
            .clone()
            .unwrap_or_else(|| request.tool_call.tool_call_id.clone());
        let options: Vec<AcpOption> = request
            .options
            .iter()
            .map(|option| AcpOption {
                id: option.option_id.clone(),
                name: option.name.clone(),
                kind: option.kind.clone().unwrap_or_else(|| "other".to_owned()),
            })
            .collect();

        let (number, entry) = self.transcript.lock().await.asked(&title, options);
        self.publish(entry);

        let (answer, wait) = oneshot::channel();
        self.decisions.lock().await.insert(number, answer);
        self.moved_to(SessionState::Blocked).await;

        let chosen = wait.await.unwrap_or(None);
        if let Some(entry) = self.transcript.lock().await.decided(number, chosen.clone()) {
            self.publish(entry);
        }
        self.moved_to(SessionState::Working).await;

        match chosen {
            Some(option_id) => PermissionOutcome::Selected { option_id },
            None => PermissionOutcome::Cancelled,
        }
    }

    async fn read_file(&mut self, path: &str) -> Result<String> {
        let path = self.within_project(path)?;
        Ok(tokio::fs::read_to_string(&path).await?)
    }

    async fn write_file(&mut self, path: &str, content: &str) -> Result<()> {
        let path = self.within_project(path)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        Ok(tokio::fs::write(&path, content).await?)
    }
}

pub struct AcpRegistry {
    profiles: ProfileSet,
    resolver: Arc<Mutex<BinaryResolver>>,
    store: Arc<Mutex<Store>>,
    base_env: std::collections::BTreeMap<String, String>,
    sessions: Arc<RwLock<std::collections::HashMap<Uuid, Arc<AcpSession>>>>,
    events: broadcast::Sender<Event>,
}

impl AcpRegistry {
    pub fn new(
        profiles: ProfileSet,
        resolver: Arc<Mutex<BinaryResolver>>,
        store: Arc<Mutex<Store>>,
        base_env: std::collections::BTreeMap<String, String>,
        events: broadcast::Sender<Event>,
    ) -> Self {
        Self {
            profiles,
            resolver,
            store,
            base_env,
            sessions: Arc::new(RwLock::new(std::collections::HashMap::new())),
            events,
        }
    }

    pub async fn list(&self) -> Vec<SessionSummary> {
        let sessions = self.sessions.read().await;
        let mut summaries = Vec::with_capacity(sessions.len());
        for session in sessions.values() {
            summaries.push(session.snapshot_summary().await);
        }
        summaries
    }

    pub async fn get(&self, id: Uuid) -> Option<Arc<AcpSession>> {
        self.sessions.read().await.get(&id).cloned()
    }

    pub async fn speaks_acp(&self, agent: &str) -> bool {
        self.profiles.get(agent).is_some_and(|profile| profile.acp_command.is_some())
    }

    pub async fn mode_of(&self, agent: &str) -> AgentMode {
        self.profiles.get(agent).map(|profile| profile.mode).unwrap_or_default()
    }

    pub async fn open(
        self: &Arc<Self>,
        project: Uuid,
        agent: &str,
        cwd: &Path,
        title: String,
        size: TerminalSize,
        worktree: Option<apex_proto::WorktreeInfo>,
    ) -> Result<SessionSummary> {
        let profile = self
            .profiles
            .get(agent)
            .cloned()
            .with_context(|| format!("unknown profile {agent}"))?;
        let command = profile
            .acp_command
            .clone()
            .with_context(|| format!("{agent} does not speak acp"))?;
        let binary = {
            let mut resolver = self.resolver.lock().await;
            resolver
                .resolve(&command)
                .with_context(|| format!("\"{command}\" was not found in PATH"))?
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

        let summary = Arc::new(Mutex::new(SessionSummary {
            id: record.id,
            project_id: project,
            agent: profile.name.clone(),
            title,
            cwd: cwd.display().to_string(),
            state: SessionState::Idle,
            size,
            exit_code: None,
            worktree,
            task: None,
            mode: AgentMode::Acp,
        }));

        let transcript: Arc<Mutex<Transcript>> = Arc::default();
        let decisions: Decisions = Arc::default();
        let commands: Commands = Arc::default();
        let relay = Relay {
            id: record.id,
            summary: Arc::clone(&summary),
            transcript: Arc::clone(&transcript),
            decisions: Arc::clone(&decisions),
            commands: Arc::clone(&commands),
            events: self.events.clone(),
            root: cwd.to_path_buf(),
        };

        let mut env: Vec<(String, String)> = self.base_env.clone().into_iter().collect();
        env.extend(profile.env.clone());
        let agent =
            Agent::spawn(&binary.display().to_string(), &profile.acp_args, &env, cwd, relay).await?;

        let greeting = tokio::time::timeout(HANDSHAKE_PATIENCE, async {
            let hello = agent.initialize().await?;
            let remote = agent.new_session(cwd, &self.mcp_servers(record.id)).await?;
            anyhow::Ok((remote, sign_in_hint(&hello)))
        })
        .await;

        let (remote, auth) = match greeting {
            Ok(Ok(greeted)) => greeted,
            outcome => {
                let _ = agent.kill().await;
                let store = self.store.lock().await;
                let _ = store.close_session(record.id);
                let complaints = agent.complaints().await;
                let reason = match outcome {
                    Err(_) => format!(
                        "{} did not answer in {} seconds",
                        profile.name,
                        HANDSHAKE_PATIENCE.as_secs()
                    ),
                    Ok(Err(error)) => format!("{error:#}"),
                    Ok(Ok(_)) => unreachable!(),
                };
                if complaints.is_empty() {
                    bail!("{reason}")
                }
                bail!("{reason}: {complaints}")
            }
        };

        let session = Arc::new(AcpSession {
            summary: Arc::clone(&summary),
            agent,
            remote,
            transcript,
            decisions,
            commands,
            auth,
        });
        self.sessions.write().await.insert(record.id, Arc::clone(&session));

        let opened = session.snapshot_summary().await;
        let _ = self.events.send(Event::SessionOpened { session: opened.clone() });
        self.watch_exit(record.id, session);
        Ok(opened)
    }

    pub async fn prompt(self: &Arc<Self>, id: Uuid, text: String) -> Result<()> {
        let session = self.require(id).await?;
        let entry = session.transcript.lock().await.said(&text);
        let _ = self.events.send(Event::AcpUpdated { id, entry });
        self.moved(&session, id, SessionState::Working).await;

        let spoken = session.transcript.lock().await.entries().len();
        let registry = Arc::clone(self);
        tokio::spawn(async move {
            let outcome = session.agent.prompt(&session.remote, &text).await;
            let state = match outcome {
                Ok(StopReason::Cancelled) => SessionState::Idle,
                Ok(reason) => {
                    if session.transcript.lock().await.entries().len() == spoken {
                        let told = session.explain(reason).await;
                        let entry = session.transcript.lock().await.noticed(&told);
                        let _ = registry.events.send(Event::AcpUpdated { id, entry });
                    }
                    SessionState::Done
                }
                Err(error) => {
                    let told = match session.agent.complaints().await {
                        complaints if complaints.is_empty() => format!("{error:#}"),
                        complaints => format!("{error:#}\n{complaints}"),
                    };
                    let entry = session.transcript.lock().await.noticed(&told);
                    let _ = registry.events.send(Event::AcpUpdated { id, entry });
                    SessionState::Idle
                }
            };
            registry.moved(&session, id, state).await;
        });
        Ok(())
    }

    pub async fn close(&self, id: Uuid) -> Result<()> {
        let Some(session) = self.sessions.write().await.remove(&id) else {
            bail!("session {id} does not exist")
        };
        let _ = session.cancel();
        let _ = session.kill().await;
        {
            let store = self.store.lock().await;
            store.close_session(id)?;
        }
        let _ = self.events.send(Event::SessionClosed { id });
        Ok(())
    }

    fn mcp_servers(&self, session: Uuid) -> Vec<apex_acp::McpServer> {
        match crate::mcp_delivery::launcher() {
            Ok(command) => vec![apex_acp::McpServer {
                name: "apex".to_owned(),
                command,
                args: vec!["mcp".to_owned(), "--session".to_owned(), session.to_string()],
                env: Vec::new(),
            }],
            Err(error) => {
                tracing::warn!(%error, "could not offer the MCP server to this acp session");
                Vec::new()
            }
        }
    }

    pub async fn require(&self, id: Uuid) -> Result<Arc<AcpSession>> {
        self.get(id).await.with_context(|| format!("session {id} does not exist"))
    }

    fn watch_exit(self: &Arc<Self>, id: Uuid, session: Arc<AcpSession>) {
        let registry = Arc::clone(self);
        tokio::spawn(async move {
            let code = session.wait().await;
            let gone = {
                let mut summary = session.summary.lock().await;
                if summary.exit_code.is_some() {
                    return;
                }
                summary.exit_code = Some(code.max(0) as u32);
                summary.state = SessionState::Done;
                summary.exit_code
            };
            for (_, waiting) in session.decisions.lock().await.drain() {
                let _ = waiting.send(None);
            }
            if let Some(code) = gone {
                let _ = registry.events.send(Event::SessionExited { id, code });
            }
        });
    }

    async fn moved(&self, session: &AcpSession, id: Uuid, state: SessionState) {
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
