use std::collections::HashMap;
use std::path::Path;

use apex_acp::{AskExample, ContentBlock, SessionUpdate, ToolCall, ToolContent, ToolStatus};
use apex_proto::{
    AcpBody, AcpChoice, AcpCommand, AcpDiff, AcpEntry, AcpExample, AcpOption, AcpPermission,
    AcpPicker, AcpPlanEntry, AcpSnapshot, AcpToolCall, AcpToolStatus,
};

fn example_of(example: AskExample) -> AcpExample {
    AcpExample { title: example.title, content: example.content, language: example.language }
}

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

    pub fn asked(
        &mut self,
        title: &str,
        options: Vec<AcpOption>,
        group: Option<apex_acp::AskGroup>,
        example: Option<AcpExample>,
    ) -> (u32, AcpEntry) {
        self.speaking = None;
        self.thinking = None;
        self.next_request += 1;
        let request = self.next_request;
        let ask = AcpPermission {
            request,
            title: title.to_owned(),
            options,
            example,
            decided: None,
            group: group.as_ref().map(|held| held.id.clone()),
            at: group.as_ref().map_or(0, |held| held.at),
            of: group.as_ref().map_or(0, |held| held.of),
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

        let body = if thought { AcpBody::Thought { text } } else { AcpBody::Agent { text } };
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
        let entry = AcpEntry { index: self.entries.len() as u32, at: now(), body };
        self.entries.push(entry.clone());
        entry
    }
}

fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis() as i64)
        .unwrap_or_default()
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

fn models_of(opened: &apex_acp::NewSession) -> AcpPicker {
    match &opened.models {
        Some(models) => AcpPicker {
            choices: models
                .available_models
                .iter()
                .map(|model| AcpChoice {
                    id: model.model_id.clone(),
                    name: match model.name.is_empty() {
                        true => model.model_id.clone(),
                        false => model.name.clone(),
                    },
                })
                .collect(),
            chosen: models.current_model_id.clone(),
        },
        None => from_config(opened, "model"),
    }
}

fn from_config(opened: &apex_acp::NewSession, wanted: &str) -> AcpPicker {
    let found = opened.config_options.iter().find(|option| match wanted {
        "model" => option.id == "model",
        _ => option.id != "model",
    });
    match found {
        Some(option) => AcpPicker {
            choices: option
                .options
                .iter()
                .map(|choice| AcpChoice {
                    id: choice.value.clone(),
                    name: match choice.name.is_empty() {
                        true => choice.value.clone(),
                        false => choice.name.clone(),
                    },
                })
                .collect(),
            chosen: option.current_value.clone(),
        },
        None => AcpPicker::default(),
    }
}

fn modes_of(opened: &apex_acp::NewSession) -> AcpPicker {
    match &opened.modes {
        Some(modes) => AcpPicker {
            choices: modes
                .available_modes
                .iter()
                .map(|mode| AcpChoice {
                    id: mode.id.clone(),
                    name: match mode.name.is_empty() {
                        true => mode.id.clone(),
                        false => mode.name.clone(),
                    },
                })
                .collect(),
            chosen: modes.current_mode_id.clone(),
        },
        None => from_config(opened, "mode"),
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
        false => {
            Some(format!("If it never answers, it may not be signed in: {}", ways.join(" · ")))
        }
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

use std::path::PathBuf;
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

const ACP_ENV_KEYS: &[&str] = &[
    "APEX_HOME",
    "HOME",
    "LANG",
    "LOGNAME",
    "PATH",
    "SHELL",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "TEMP",
    "TMP",
    "TMPDIR",
    "USER",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
];

pub(crate) fn acp_environment(
    environment: std::collections::BTreeMap<String, String>,
) -> std::collections::BTreeMap<String, String> {
    environment
        .into_iter()
        .filter(|(key, _)| ACP_ENV_KEYS.contains(&key.as_str()) || key.starts_with("LC_"))
        .collect()
}

pub struct AcpSession {
    pub summary: Shared,
    agent: Agent,
    remote: String,
    transcript: Arc<Mutex<Transcript>>,
    decisions: Decisions,
    commands: Commands,
    auth: Option<String>,
    models: Mutex<AcpPicker>,
    modes: Mutex<AcpPicker>,
}

impl AcpSession {
    pub async fn snapshot_summary(&self) -> SessionSummary {
        self.summary.lock().await.clone()
    }

    pub async fn snapshot(&self) -> AcpSnapshot {
        AcpSnapshot {
            entries: self.transcript.lock().await.entries(),
            commands: self.commands.lock().await.clone(),
            models: self.models.lock().await.clone(),
            modes: self.modes.lock().await.clone(),
        }
    }

    pub async fn choose(&self, model: Option<String>, mode: Option<String>) -> Result<()> {
        if let Some(model) = model {
            self.agent.set_model(&self.remote, &model).await?;
            self.models.lock().await.chosen = Some(model);
        }
        if let Some(mode) = mode {
            self.agent.set_mode(&self.remote, &mode).await?;
            self.modes.lock().await.chosen = Some(mode);
        }
        Ok(())
    }

    async fn explain(&self, reason: StopReason) -> String {
        let headline = match reason {
            StopReason::EndTurn => "The agent finished the turn without saying anything.",
            StopReason::MaxTokens => "The agent ran out of tokens before saying anything.",
            StopReason::MaxTurnRequests => {
                "The agent hit its request limit before saying anything."
            }
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
        if let Some(waiting) = self.decisions.lock().await.remove(&request) {
            let _ = waiting.send(option);
        }
        Ok(())
    }

    pub async fn cancel(&self) -> Result<()> {
        for (_, waiting) in self.decisions.lock().await.drain() {
            let _ = waiting.send(None);
        }
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
}

async fn project_root(root: &Path) -> Result<PathBuf> {
    tokio::fs::canonicalize(root)
        .await
        .with_context(|| format!("could not resolve project root {}", root.display()))
}

pub(crate) async fn readable_path(root: &Path, path: &str) -> Result<PathBuf> {
    let candidate = PathBuf::from(path);
    if !candidate.is_absolute() {
        bail!("{path} is outside this project")
    }
    let root = project_root(root).await?;
    let resolved = tokio::fs::canonicalize(&candidate)
        .await
        .with_context(|| format!("could not resolve {path}"))?;
    if !resolved.starts_with(&root) {
        bail!("{path} is outside this project")
    }
    Ok(resolved)
}

pub(crate) async fn writable_path(root: &Path, path: &str) -> Result<PathBuf> {
    let candidate = PathBuf::from(path);
    if !candidate.is_absolute() {
        bail!("{path} is outside this project")
    }
    if tokio::fs::symlink_metadata(&candidate).await.is_ok() {
        return readable_path(root, path).await;
    }
    let parent = candidate.parent().context("a file path is required")?;
    let name = candidate.file_name().context("a file path is required")?;
    tokio::fs::create_dir_all(parent).await?;
    let root = project_root(root).await?;
    let parent = tokio::fs::canonicalize(parent).await?;
    if !parent.starts_with(&root) {
        bail!("{path} is outside this project")
    }
    Ok(parent.join(name))
}

#[async_trait::async_trait]
impl Client for Relay {
    async fn update(&self, _session: &str, update: apex_acp::SessionUpdate) {
        if let apex_acp::SessionUpdate::AvailableCommandsUpdate { available_commands } = update {
            let offered: Vec<AcpCommand> = available_commands
                .into_iter()
                .map(|command| AcpCommand { name: command.name, description: command.description })
                .collect();
            *self.commands.lock().await = offered.clone();
            let _ = self.events.send(Event::AcpCommands { id: self.id, commands: offered });
            return;
        }
        if let Some(entry) = self.transcript.lock().await.absorb(update) {
            self.publish(entry);
        }
    }

    async fn permission(&self, request: PermissionRequest) -> PermissionOutcome {
        let question = request.meta.as_ref().is_some_and(|meta| meta.apex_question);
        let group = request.meta.as_ref().and_then(|meta| meta.apex_group.clone());
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
                about: option
                    .description
                    .clone()
                    .or_else(|| option.meta.as_ref().and_then(|meta| meta.description.clone())),
                example: option
                    .meta
                    .as_ref()
                    .and_then(|meta| meta.apex_example.clone())
                    .map(example_of),
                kind: if question {
                    "other".to_owned()
                } else {
                    option.kind.clone().unwrap_or_else(|| "allow_once".to_owned())
                },
            })
            .collect();

        let (answer, wait) = oneshot::channel();
        let example =
            request.meta.as_ref().and_then(|meta| meta.apex_example.clone()).map(example_of);
        let (number, entry) = self.transcript.lock().await.asked(&title, options, group, example);
        self.decisions.lock().await.insert(number, answer);
        self.publish(entry);
        self.moved_to(SessionState::Blocked).await;

        let chosen = wait.await.unwrap_or(None);
        if let Some(entry) = self.transcript.lock().await.decided(number, chosen.clone()) {
            self.publish(entry);
        }
        if self.decisions.lock().await.is_empty() {
            self.moved_to(SessionState::Working).await;
        }

        match chosen {
            Some(option_id) => PermissionOutcome::Selected { option_id },
            None => PermissionOutcome::Cancelled,
        }
    }

    async fn read_file(&self, path: &str) -> Result<String> {
        let path = readable_path(&self.root, path).await?;
        Ok(tokio::fs::read_to_string(&path).await?)
    }

    async fn write_file(&self, path: &str, content: &str) -> Result<()> {
        let path = writable_path(&self.root, path).await?;
        Ok(tokio::fs::write(&path, content).await?)
    }
}

pub struct OpenAcp {
    pub project: Uuid,
    pub agent: String,
    pub cwd: PathBuf,
    pub title: String,
    pub size: TerminalSize,
    pub worktree: Option<apex_proto::WorktreeInfo>,
    pub parent: Option<Uuid>,
    pub run: Option<Uuid>,
}

pub struct AcpRegistry {
    owner: std::sync::OnceLock<std::sync::Weak<dyn crate::commands::Dispatch>>,
    http: tokio::sync::OnceCell<Arc<crate::mcp_http::HttpMcp>>,
    profiles: ProfileSet,
    resolver: Arc<Mutex<BinaryResolver>>,
    store: Arc<Mutex<Store>>,
    base_env: std::collections::BTreeMap<String, String>,
    sessions: Arc<RwLock<std::collections::HashMap<Uuid, Arc<AcpSession>>>>,
    greeting: Arc<RwLock<std::collections::HashMap<Uuid, Shared>>>,
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
            owner: std::sync::OnceLock::new(),
            http: tokio::sync::OnceCell::new(),
            profiles,
            resolver,
            store,
            base_env: acp_environment(base_env),
            sessions: Arc::new(RwLock::new(std::collections::HashMap::new())),
            greeting: Arc::new(RwLock::new(std::collections::HashMap::new())),
            events,
        }
    }

    pub async fn list(&self) -> Vec<SessionSummary> {
        let sessions = self.sessions.read().await;
        let mut summaries = Vec::with_capacity(sessions.len());
        for session in sessions.values() {
            summaries.push(session.snapshot_summary().await);
        }
        for (id, summary) in self.greeting.read().await.iter() {
            if !sessions.contains_key(id) {
                summaries.push(summary.lock().await.clone());
            }
        }
        summaries
    }

    pub async fn running(&self) -> Vec<(Uuid, String, u32)> {
        let sessions = self.sessions.read().await;
        let mut found = Vec::with_capacity(sessions.len());
        for (id, session) in sessions.iter() {
            if let Some(pid) = session.agent.pid() {
                found.push((*id, session.summary.lock().await.title.clone(), pid));
            }
        }
        found
    }

    pub async fn get(&self, id: Uuid) -> Option<Arc<AcpSession>> {
        self.sessions.read().await.get(&id).cloned()
    }

    pub async fn kill_all(&self) {
        let ids: Vec<Uuid> = self.sessions.read().await.keys().cloned().collect();
        for id in ids {
            match self.close(id).await {
                Ok(()) => {}
                Err(error) => tracing::warn!(%id, %error, "could not close session on shutdown"),
            }
        }
    }

    pub async fn speaks_acp(&self, agent: &str) -> bool {
        self.profiles.get(agent).is_some_and(|profile| profile.acp_command.is_some())
    }

    pub async fn mode_of(&self, agent: &str) -> AgentMode {
        self.profiles.get(agent).map(|profile| profile.mode).unwrap_or_default()
    }

    pub async fn open(self: &Arc<Self>, request: OpenAcp) -> Result<SessionSummary> {
        let OpenAcp { project, agent, cwd, title, size, worktree, parent, run } = request;
        let agent = agent.as_str();
        let cwd = cwd.as_path();
        let profile = self
            .profiles
            .get(agent)
            .cloned()
            .with_context(|| format!("unknown profile {agent}"))?;
        let command =
            profile.acp_command.clone().with_context(|| format!("{agent} does not speak acp"))?;
        let binary = {
            let mut resolver = self.resolver.lock().await;
            resolver
                .resolve(&command)
                .with_context(|| format!("\"{command}\" was not found in PATH"))?
        };

        let (record, tools_off) = {
            let store = self.store.lock().await;
            (
                store.insert_session(
                    project,
                    &profile.name,
                    &title,
                    &cwd.display().to_string(),
                    worktree.as_ref().map(|tree| (tree.path.as_str(), tree.branch.as_str())),
                )?,
                store.tools_off()?,
            )
        };

        let summary = Arc::new(Mutex::new(SessionSummary {
            id: record.id,
            project_id: project,
            agent: profile.name.clone(),
            title,
            cwd: cwd.display().to_string(),
            started_at: record.created_at,
            state: SessionState::Idle,
            size,
            exit_code: None,
            worktree,
            task: None,
            mode: AgentMode::Acp,
            parent,
            run,
            url: None,
            tools_off,
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
        env.push((
            "APEX_PREVIEW_DIR".to_owned(),
            apex_core::preview::dir(cwd).display().to_string(),
        ));
        let agent =
            Agent::spawn(&binary.display().to_string(), &profile.acp_args, &env, cwd, relay)
                .await?;

        self.greeting.write().await.insert(record.id, Arc::clone(&summary));
        let greeting = tokio::time::timeout(HANDSHAKE_PATIENCE, async {
            let hello = agent.initialize().await?;
            let servers =
                self.mcp_servers(record.id, hello.agent_capabilities.mcp_capabilities).await;
            let opened = agent.new_session(cwd, &servers).await?;
            anyhow::Ok((opened, sign_in_hint(&hello)))
        })
        .await;

        self.greeting.write().await.remove(&record.id);
        let (opened, auth) = match greeting {
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
            transcript,
            decisions,
            commands,
            auth,
            models: Mutex::new(models_of(&opened)),
            modes: Mutex::new(modes_of(&opened)),
            remote: opened.session_id,
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
        let _ = session.cancel().await;
        let _ = session.kill().await;
        if let Some(http) = self.http.get() {
            http.revoke(id).await;
        }
        {
            let store = self.store.lock().await;
            store.close_session(id)?;
        }
        let _ = self.events.send(Event::SessionClosed { id });
        Ok(())
    }

    pub fn bind(&self, owner: std::sync::Weak<dyn crate::commands::Dispatch>) {
        let _ = self.owner.set(owner);
    }

    async fn http_mcp(&self) -> Option<&Arc<crate::mcp_http::HttpMcp>> {
        let owner = self.owner.get()?.clone();
        let started =
            self.http.get_or_try_init(|| crate::mcp_http::HttpMcp::start(owner.clone())).await;
        match started {
            Ok(http) => Some(http),
            Err(error) => {
                tracing::warn!(%error, "could not open the http mcp port");
                None
            }
        }
    }

    async fn mcp_servers(
        &self,
        session: Uuid,
        accepts: apex_acp::McpCapabilities,
    ) -> Vec<apex_acp::McpServer> {
        if accepts.http
            && let Some(http) = self.http_mcp().await
        {
            return vec![apex_acp::McpServer::Http {
                name: "apex".to_owned(),
                url: http.url(),
                headers: vec![apex_acp::EnvVar {
                    name: "Authorization".to_owned(),
                    value: format!("Bearer {}", http.issue(session).await),
                }],
            }];
        }

        match crate::mcp_delivery::launcher() {
            Ok(command) => vec![apex_acp::McpServer::Stdio {
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

    pub async fn finish(&self, id: Uuid) -> Result<()> {
        let session = self.require(id).await?;
        {
            let mut summary = session.summary.lock().await;
            if summary.exit_code.is_some() {
                return Ok(());
            }
            summary.state = SessionState::Done;
        }
        let _ = self.events.send(Event::SessionStateChanged { id, state: SessionState::Done });
        Ok(())
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
