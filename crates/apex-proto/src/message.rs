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
pub struct SessionSummary {
    #[ts(type = "string")]
    pub id: Uuid,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Ping,
    ListAgents,
    ListSessions,
    SessionCreate {
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Reply {
    Pong,
    Agents { agents: Vec<AgentSummary> },
    Sessions { sessions: Vec<SessionSummary> },
    Session { session: SessionSummary },
    Done,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
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
