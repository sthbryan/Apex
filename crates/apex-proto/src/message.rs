use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::error::ProtocolError;

pub const PROTOCOL_VERSION: u32 = 18;

pub const IDLE_GRACE_NEVER: u32 = u32::MAX;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequestId(pub u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum ToolGroup {
    Context,
    Observation,
    Orchestration,
    Lifecycle,
    Views,
    Browser,
    Worktree,
}

impl ToolGroup {
    pub const OPTIONAL: &'static [Self] =
        &[Self::Observation, Self::Orchestration, Self::Views, Self::Browser];

    pub fn is_optional(self) -> bool {
        Self::OPTIONAL.contains(&self)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Scope {
    Local,
    Remote,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Identity {
    pub device_id: String,
    pub token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Hello {
    pub protocol_version: u32,
    pub client_name: String,
    pub identity: Option<Identity>,
    pub probe: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Welcome {
    pub protocol_version: u32,
    pub daemon_version: String,
    pub scope: Scope,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum AgentMode {
    #[default]
    Pty,
    Acp,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum SessionState {
    #[default]
    Idle,
    Working,
    Blocked,
    Done,
}

impl SessionState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Working => "working",
            Self::Blocked => "blocked",
            Self::Done => "done",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "idle" => Some(Self::Idle),
            "working" => Some(Self::Working),
            "blocked" => Some(Self::Blocked),
            "done" => Some(Self::Done),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AgentSummary {
    pub name: String,
    pub command: String,
    pub resolved_path: Option<String>,
    pub mode: AgentMode,
    pub agentic: bool,
    pub supports_resume: bool,
    pub speaks_acp: bool,
    pub shares_config: bool,
    #[serde(default)]
    pub mcp_blocked: bool,
    #[serde(default)]
    pub mcp_hint: Option<String>,
}

impl AgentSummary {
    pub fn is_available(&self) -> bool {
        self.resolved_path.is_some()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TerminalSize {
    pub rows: u16,
    pub cols: u16,
}

impl Default for TerminalSize {
    fn default() -> Self {
        Self { rows: 24, cols: 80 }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ProjectSummary {
    #[ts(type = "string")]
    pub id: Uuid,
    pub name: String,
    pub root: String,
    pub is_git: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[ts(type = "number")]
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EditorSummary {
    pub id: String,
    pub name: String,
    pub command: String,
    pub resolved_path: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ImagePair {
    pub before: Option<String>,
    pub after: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FileContents {
    pub path: String,
    pub text: Option<String>,
    pub image: Option<String>,
    pub revision: Option<String>,
    #[ts(type = "number")]
    pub size: u64,
    pub truncated: bool,
    pub binary: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HistoryEntry {
    pub agent: String,
    pub session_id: String,
    pub label: Option<String>,
    pub updated_at: u32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum Isolation {
    #[default]
    Directory,
    Worktree,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum WorktreeDisposal {
    #[default]
    Keep,
    Discard,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RejectedHunk {
    pub id: String,
    pub path: String,
    #[ts(type = "number")]
    pub at: i64,
    pub added: u32,
    pub removed: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PendingReview {
    pub target: GitTarget,
    pub branch: String,
    pub title: Option<String>,
    pub state: Option<SessionState>,
    pub files: u32,
    pub added: u32,
    pub removed: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorktreeEntry {
    pub path: String,
    pub branch: String,
    pub changed: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
    pub worktree: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GitChange {
    pub path: String,
    pub kind: String,
    pub staged: bool,
    pub added: u32,
    pub removed: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GitTarget {
    Project,
    Session {
        #[ts(type = "string")]
        id: Uuid,
    },
    Worktree {
        path: String,
    },
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum DiffScope {
    Unstaged,
    Staged,
    #[default]
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum GitSyncOp {
    Fetch,
    Pull,
    Push,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TaskSummary {
    pub name: String,
    pub command: String,
    pub source: String,
    pub group: Option<String>,
    pub risky: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ContextEntry {
    pub key: String,
    #[ts(type = "number")]
    pub bytes: u64,
    #[ts(type = "number")]
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GitCommit {
    pub id: String,
    pub short: String,
    pub author: String,
    #[ts(type = "number")]
    pub when: i64,
    pub summary: String,
    pub refs: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GitStatus {
    pub branch: String,
    pub base: String,
    pub changes: Vec<GitChange>,
    pub isolated: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MergeReport {
    Merged,
    Conflicted { files: Vec<String> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SessionSummary {
    #[ts(type = "string")]
    pub id: Uuid,
    #[ts(type = "string")]
    pub project_id: Uuid,
    pub agent: String,
    pub title: String,
    pub cwd: String,
    #[ts(type = "number")]
    pub started_at: i64,
    pub state: SessionState,
    pub size: TerminalSize,
    pub exit_code: Option<u32>,
    pub worktree: Option<WorktreeInfo>,
    pub task: Option<String>,
    pub mode: AgentMode,
    #[ts(type = "string | null")]
    pub parent: Option<Uuid>,
    #[ts(type = "string | null")]
    pub run: Option<Uuid>,
    pub url: Option<String>,
    #[serde(default)]
    pub tools_off: Vec<ToolGroup>,
}

impl SessionSummary {
    pub fn is_alive(&self) -> bool {
        self.exit_code.is_none()
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum AcpToolStatus {
    #[default]
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpDiff {
    pub path: String,
    pub old_text: Option<String>,
    pub new_text: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpToolCall {
    pub call_id: String,
    pub title: String,
    pub kind: String,
    pub status: AcpToolStatus,
    pub text: String,
    pub diffs: Vec<AcpDiff>,
    pub locations: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpOption {
    pub id: String,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpPermission {
    pub request: u32,
    pub title: String,
    pub options: Vec<AcpOption>,
    pub decided: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpPlanEntry {
    pub content: String,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AcpBody {
    User { text: String },
    Agent { text: String },
    Thought { text: String },
    Tool { call: AcpToolCall },
    Permission { ask: AcpPermission },
    Plan { entries: Vec<AcpPlanEntry> },
    Notice { text: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpCommand {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpChoice {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpPicker {
    pub choices: Vec<AcpChoice>,
    pub chosen: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpSnapshot {
    pub entries: Vec<AcpEntry>,
    pub commands: Vec<AcpCommand>,
    pub models: AcpPicker,
    pub modes: AcpPicker,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AcpEntry {
    pub index: u32,
    pub body: AcpBody,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SystemUsage {
    pub cpu_percent: f32,
    pub gpu_percent: Option<f32>,
    pub memory_used: f64,
    pub memory_total: f64,
    pub swap_used: f64,
    pub swap_total: f64,
    pub cores: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ProcessUsage {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f32,
    pub memory: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SessionUsage {
    #[ts(type = "string")]
    pub id: Uuid,
    pub title: String,
    pub cpu_percent: f32,
    pub memory: f64,
    pub processes: Vec<ProcessUsage>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct QuotaWindow {
    pub label: Option<String>,
    pub used_percent: u8,
    pub expected_percent: Option<u8>,
    pub lasts_to_reset: Option<bool>,
    pub eta_seconds: Option<u32>,
    pub resets_at: Option<String>,
    pub reset_description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct QuotaReport {
    pub agent: String,
    pub windows: Vec<QuotaWindow>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ApexUsage {
    pub cpu_percent: f32,
    pub memory: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MetricsSnapshot {
    pub apex: ApexUsage,
    pub system: SystemUsage,
    pub sessions: Vec<SessionUsage>,
    pub quotas: Vec<QuotaReport>,
    pub quota_failures: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Ping,
    DaemonShutdown,
    DaemonStatus,
    ListAgents,
    ListToolGroups,
    SetToolGroups {
        tools_off: Vec<ToolGroup>,
    },
    ListSessions,
    ListProjects,
    ProjectOpen {
        root: String,
    },
    ProjectRemove {
        #[ts(type = "string")]
        project: Uuid,
    },
    ReadMetrics {
        #[serde(default)]
        refresh_quota: bool,
    },
    KillProcess {
        pid: u32,
    },
    ListHistory {
        #[ts(type = "string")]
        project: Uuid,
    },
    DirList {
        #[ts(type = "string")]
        project: Uuid,
        path: String,
    },
    FileRead {
        #[ts(type = "string")]
        project: Uuid,
        path: String,
    },
    FileWrite {
        #[ts(type = "string")]
        project: Uuid,
        path: String,
        text: String,
        revision: Option<String>,
    },
    FileSearch {
        #[ts(type = "string")]
        project: Uuid,
        query: String,
        limit: u32,
    },
    ListEditors,
    FileOpenExternal {
        #[ts(type = "string")]
        project: Uuid,
        path: String,
        editor: Option<String>,
    },
    UrlOpen {
        url: String,
    },
    BrowserReport {
        #[ts(type = "string")]
        project: Uuid,
        pane: String,
        url: String,
        #[serde(default)]
        name: Option<String>,
    },
    BrowserForget {
        pane: String,
    },
    BrowserList {
        #[ts(type = "string")]
        project: Uuid,
    },
    BrowserLogs {
        #[ts(type = "string")]
        project: Uuid,
        #[serde(default)]
        pane: Option<String>,
    },
    BrowserShot {
        #[ts(type = "string")]
        project: Uuid,
        #[serde(default)]
        pane: Option<String>,
    },
    ShotDone {
        #[ts(type = "string")]
        request: Uuid,
        path: Option<String>,
        error: Option<String>,
    },
    PageDone {
        #[ts(type = "string")]
        request: Uuid,
        page: Option<String>,
        error: Option<String>,
    },
    SessionResume {
        #[ts(type = "string")]
        project: Uuid,
        agent: String,
        session_id: String,
        size: TerminalSize,
    },
    LayoutSave {
        #[ts(type = "string")]
        project: Uuid,
        payload: String,
    },
    LayoutLoad {
        #[ts(type = "string")]
        project: Uuid,
    },
    SessionCreate {
        #[ts(type = "string")]
        project: Uuid,
        agent: String,
        cwd: Option<String>,
        size: TerminalSize,
        #[serde(default)]
        isolation: Isolation,
        #[serde(default)]
        slug: Option<String>,
        #[serde(default)]
        mode: Option<AgentMode>,
    },
    OpenView {
        #[ts(type = "string")]
        asked_by: Uuid,
        target: ViewTarget,
    },
    CloseView {
        #[ts(type = "string")]
        asked_by: Uuid,
        target: ViewTarget,
    },
    Preview {
        #[ts(type = "string")]
        asked_by: Uuid,
        path: String,
        #[serde(default)]
        name: Option<String>,
    },
    SessionTell {
        #[ts(type = "string")]
        id: Uuid,
        text: String,
    },
    SessionDone {
        #[ts(type = "string")]
        id: Uuid,
        #[serde(default)]
        summary: Option<String>,
    },
    SessionDismiss {
        #[ts(type = "string")]
        asked_by: Uuid,
        #[ts(type = "string")]
        id: Uuid,
    },
    SessionRace {
        #[ts(type = "string")]
        project: Uuid,
        agents: Vec<String>,
        task: String,
        #[serde(default)]
        unattended: Vec<String>,
    },
    SessionBroadcast {
        #[ts(type = "string")]
        parent: Uuid,
        agents: Vec<String>,
        task: String,
        #[serde(default)]
        isolation: Isolation,
    },
    SessionSpawn {
        #[ts(type = "string")]
        parent: Uuid,
        agent: String,
        #[serde(default)]
        task: Option<String>,
        #[serde(default)]
        isolation: Isolation,
    },
    SessionAttach {
        #[ts(type = "string")]
        id: Uuid,
    },
    SessionDetach {
        #[ts(type = "string")]
        id: Uuid,
    },
    SessionInput {
        #[ts(type = "string")]
        id: Uuid,
        data: String,
    },
    SessionResize {
        #[ts(type = "string")]
        id: Uuid,
        size: TerminalSize,
    },
    SessionClose {
        #[ts(type = "string")]
        id: Uuid,
        #[serde(default)]
        worktree: WorktreeDisposal,
    },
    GitRead {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
    },
    WorktreeList {
        #[ts(type = "string")]
        project: Uuid,
    },
    GitBranches {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
    },
    GitCheckout {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        branch: String,
    },
    ListTasks {
        #[ts(type = "string")]
        project: Uuid,
    },
    TaskRun {
        #[ts(type = "string")]
        project: Uuid,
        task: String,
        command: String,
        size: TerminalSize,
    },
    ContextList {
        #[ts(type = "string")]
        project: Uuid,
    },
    ContextRead {
        #[ts(type = "string")]
        project: Uuid,
        key: String,
    },
    ContextWrite {
        #[ts(type = "string")]
        project: Uuid,
        key: String,
        contents: String,
    },
    ContextNote {
        #[ts(type = "string")]
        project: Uuid,
        from: String,
        to: Option<String>,
        message: String,
    },
    SessionTranscript {
        #[ts(type = "string")]
        id: Uuid,
        tail: u32,
        #[serde(default)]
        plain: bool,
    },
    GitDiff {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        path: String,
        #[serde(default)]
        commit: Option<String>,
        #[serde(default)]
        scope: DiffScope,
    },
    GitPending {
        #[ts(type = "string")]
        project: Uuid,
    },
    GitRejectHunk {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        patch: String,
    },
    GitRejects {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
    },
    GitRestoreReject {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        id: String,
    },
    GitClearRejects {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
    },
    GitHunks {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        path: String,
        scope: DiffScope,
    },
    GitImages {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        path: String,
        #[serde(default)]
        commit: Option<String>,
    },
    GitStage {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        paths: Vec<String>,
        staged: bool,
    },
    GitStageHunk {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        patch: String,
        staged: bool,
    },
    GitCommitStaged {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        message: String,
    },
    GitLog {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        limit: u32,
    },
    GitSync {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
        op: GitSyncOp,
    },
    WorktreeMerge {
        #[ts(type = "string")]
        project: Uuid,
        target: GitTarget,
    },
    WorktreeRemove {
        #[ts(type = "string")]
        project: Uuid,
        path: String,
        branch: Option<String>,
    },
    WorktreePrune {
        #[ts(type = "string")]
        project: Uuid,
    },
    AcpTranscript {
        #[ts(type = "string")]
        id: Uuid,
    },
    AcpPrompt {
        #[ts(type = "string")]
        id: Uuid,
        text: String,
    },
    AcpCancel {
        #[ts(type = "string")]
        id: Uuid,
    },
    AcpDecide {
        #[ts(type = "string")]
        id: Uuid,
        request: u32,
        option: Option<String>,
    },
    AcpChoose {
        #[ts(type = "string")]
        id: Uuid,
        model: Option<String>,
        mode: Option<String>,
    },
    McpAdopt {
        agent: String,
        enabled: bool,
    },
    SetIdleGrace {
        seconds: u32,
    },
    Notify {
        title: Option<String>,
        body: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Reply {
    Pong,
    Agents { agents: Vec<AgentSummary> },
    ToolGroups { tools_off: Vec<ToolGroup> },
    Sessions { sessions: Vec<SessionSummary> },
    Spawned { sessions: Vec<SessionSummary> },
    Session { session: SessionSummary },
    Projects { projects: Vec<ProjectSummary> },
    Project { project: ProjectSummary },
    Layout { payload: Option<String> },
    History { entries: Vec<HistoryEntry> },
    Directory { entries: Vec<FileEntry> },
    Editors { editors: Vec<EditorSummary> },
    Git { status: GitStatus },
    Log { commits: Vec<GitCommit> },
    Committed { commit: GitCommit },
    Hunks { patches: Vec<String> },
    Pending { reviews: Vec<PendingReview> },
    Rejects { rejects: Vec<RejectedHunk> },
    Worktrees { worktrees: Vec<WorktreeEntry> },
    Pruned { removed: Vec<String> },
    Branches { branches: Vec<GitBranch> },
    Context { entries: Vec<ContextEntry> },
    Tasks { tasks: Vec<TaskSummary> },
    Text { text: String },
    Diff { patch: String },
    Images { pair: ImagePair },
    Merge { report: MergeReport },
    File { contents: FileContents },
    Wrote { revision: String },
    Metrics { snapshot: MetricsSnapshot },
    Acp { snapshot: AcpSnapshot },
    Daemon { report: DaemonReport },
    Done,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DaemonReport {
    pub daemon_version: String,
    pub protocol_version: u32,
    pub uptime: u64,
    pub idle_grace: u32,
    pub idle_for: Option<u64>,
    pub remaining: Option<u64>,
    pub clients: u32,
    pub sessions: u32,
    pub live: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum CommandOutcome {
    Ok { reply: Box<Reply> },
    Err { error: ProtocolError },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ViewTarget {
    Session {
        #[ts(type = "string")]
        id: Uuid,
    },
    File {
        #[ts(type = "string")]
        project: Uuid,
        path: String,
    },
    Url {
        url: String,
        #[serde(default)]
        name: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    OpenView {
        target: ViewTarget,
        #[ts(type = "string")]
        asked_by: Uuid,
    },
    CloseView {
        target: ViewTarget,
        #[ts(type = "string")]
        asked_by: Uuid,
    },
    AskShot {
        pane: String,
        #[ts(type = "string")]
        request: Uuid,
    },
    AskPage {
        pane: String,
        #[ts(type = "string")]
        request: Uuid,
    },
    DaemonShutdown,
    SessionOpened {
        session: SessionSummary,
    },
    SessionStateChanged {
        #[ts(type = "string")]
        id: Uuid,
        state: SessionState,
    },
    SessionExited {
        #[ts(type = "string")]
        id: Uuid,
        code: u32,
    },
    SessionUrl {
        #[ts(type = "string")]
        id: Uuid,
        url: String,
    },
    SessionClosed {
        #[ts(type = "string")]
        id: Uuid,
    },
    AcpUpdated {
        #[ts(type = "string")]
        id: Uuid,
        entry: AcpEntry,
    },
    AcpCommands {
        #[ts(type = "string")]
        id: Uuid,
        commands: Vec<AcpCommand>,
    },
    Notify {
        #[ts(type = "string | null")]
        session: Option<Uuid>,
        notice: NotifyKind,
        title: Option<String>,
        body: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum NotifyKind {
    Terminal,
    Exited,
    Quiet,
    Message,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ClientMessage {
    Hello(Hello),
    Request { id: RequestId, command: Command },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ServerMessage {
    Welcome(Welcome),
    Response { id: RequestId, outcome: CommandOutcome },
    Event(Box<Event>),
}

impl ServerMessage {
    pub fn ok(id: RequestId, reply: Reply) -> Self {
        Self::Response { id, outcome: CommandOutcome::Ok { reply: Box::new(reply) } }
    }

    pub fn err(id: RequestId, error: ProtocolError) -> Self {
        Self::Response { id, outcome: CommandOutcome::Err { error } }
    }
}
