use serde::{Deserialize, Serialize};
use ts_rs::TS;

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum AgentMode {
    Pty,
    Acp,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Ping,
    ListAgents,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Reply {
    Pong,
    Agents { agents: Vec<AgentSummary> },
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
