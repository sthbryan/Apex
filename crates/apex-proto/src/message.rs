use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::error::ProtocolError;

pub const PROTOCOL_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RequestId(pub u64);

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
    pub supports_resume: bool,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FileContents {
    pub path: String,
    pub text: Option<String>,
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
    pub state: SessionState,
    pub size: TerminalSize,
    pub exit_code: Option<u32>,
}

impl SessionSummary {
    pub fn is_alive(&self) -> bool {
        self.exit_code.is_none()
    }
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
pub struct MetricsSnapshot {
    pub system: SystemUsage,
    pub sessions: Vec<SessionUsage>,
    pub quotas: Vec<QuotaReport>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Ping,
    ListAgents,
    ListSessions,
    ListProjects,
    ProjectOpen {
        root: String,
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
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Reply {
    Pong,
    Agents { agents: Vec<AgentSummary> },
    Sessions { sessions: Vec<SessionSummary> },
    Session { session: SessionSummary },
    Projects { projects: Vec<ProjectSummary> },
    Project { project: ProjectSummary },
    Layout { payload: Option<String> },
    History { entries: Vec<HistoryEntry> },
    Directory { entries: Vec<FileEntry> },
    Editors { editors: Vec<EditorSummary> },
    File { contents: FileContents },
    Metrics { snapshot: MetricsSnapshot },
    Done,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum CommandOutcome {
    Ok { reply: Reply },
    Err { error: ProtocolError },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
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
    SessionClosed {
        #[ts(type = "string")]
        id: Uuid,
    },
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
    Event(Event),
}

impl ServerMessage {
    pub fn ok(id: RequestId, reply: Reply) -> Self {
        Self::Response { id, outcome: CommandOutcome::Ok { reply } }
    }

    pub fn err(id: RequestId, error: ProtocolError) -> Self {
        Self::Response { id, outcome: CommandOutcome::Err { error } }
    }
}
