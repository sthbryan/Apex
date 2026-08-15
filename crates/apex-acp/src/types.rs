use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROTOCOL_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsCapabilities {
    pub read_text_file: bool,
    pub write_text_file: bool,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientCapabilities {
    pub fs: FsCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Initialize {
    pub protocol_version: u32,
    pub client_capabilities: ClientCapabilities,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub version: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthMethod {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Initialized {
    pub protocol_version: u32,
    #[serde(default)]
    pub agent_capabilities: Value,
    #[serde(default)]
    pub auth_methods: Vec<AuthMethod>,
    #[serde(default)]
    pub agent_info: Option<AgentInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvVar {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: Vec<EnvVar>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub model_id: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionModels {
    #[serde(default)]
    pub available_models: Vec<ModelInfo>,
    #[serde(default)]
    pub current_model_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeInfo {
    pub id: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionModes {
    #[serde(default)]
    pub current_mode_id: Option<String>,
    #[serde(default)]
    pub available_modes: Vec<ModeInfo>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSession {
    pub session_id: String,
    #[serde(default)]
    pub models: Option<SessionModels>,
    #[serde(default)]
    pub modes: Option<SessionModes>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    EndTurn,
    MaxTokens,
    MaxTurnRequests,
    Refusal,
    Cancelled,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Prompted {
    pub stop_reason: StopReason,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    Image {
        #[serde(default)]
        mime_type: String,
    },
    Audio {
        #[serde(default)]
        mime_type: String,
    },
    ResourceLink {
        uri: String,
        #[serde(default)]
        name: String,
    },
    Resource {
        #[serde(default)]
        resource: Value,
    },
}

impl ContentBlock {
    pub fn text(body: impl Into<String>) -> Self {
        Self::Text { text: body.into() }
    }

    pub fn as_text(&self) -> String {
        match self {
            Self::Text { text } => text.clone(),
            Self::ResourceLink { uri, name } if name.is_empty() => uri.clone(),
            Self::ResourceLink { name, .. } => name.clone(),
            Self::Image { .. } => "[image]".to_owned(),
            Self::Audio { .. } => "[audio]".to_owned(),
            Self::Resource { .. } => "[resource]".to_owned(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum ToolContent {
    Content {
        content: ContentBlock,
    },
    Diff {
        path: String,
        #[serde(default)]
        old_text: Option<String>,
        new_text: String,
    },
    Terminal {
        terminal_id: String,
    },
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolLocation {
    pub path: String,
    #[serde(default)]
    pub line: Option<u32>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub tool_call_id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub status: Option<ToolStatus>,
    #[serde(default)]
    pub content: Vec<ToolContent>,
    #[serde(default)]
    pub locations: Vec<ToolLocation>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanEntry {
    pub content: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableCommand {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "sessionUpdate", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum SessionUpdate {
    UserMessageChunk {
        content: ContentBlock,
    },
    AgentMessageChunk {
        content: ContentBlock,
    },
    AgentThoughtChunk {
        content: ContentBlock,
    },
    ToolCall {
        #[serde(flatten)]
        call: ToolCall,
    },
    ToolCallUpdate {
        #[serde(flatten)]
        call: ToolCall,
    },
    Plan {
        #[serde(default)]
        entries: Vec<PlanEntry>,
    },
    CurrentModeUpdate {
        current_mode_id: String,
    },
    AvailableCommandsUpdate {
        #[serde(default)]
        available_commands: Vec<AvailableCommand>,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionNotification {
    pub session_id: String,
    pub update: SessionUpdate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionOption {
    pub option_id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequest {
    pub session_id: String,
    pub tool_call: ToolCall,
    #[serde(default)]
    pub options: Vec<PermissionOption>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum PermissionOutcome {
    Cancelled,
    Selected { option_id: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRequest {
    pub path: String,
    #[serde(default)]
    pub content: Option<String>,
}
