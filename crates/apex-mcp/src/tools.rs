use anyhow::{Context, Result, bail};
use apex_proto::{Command, Isolation, SessionSummary, ViewTarget};
use serde_json::{Value, json};
use uuid::Uuid;

const TRANSCRIPT_TAIL: u32 = 8 * 1024;

pub struct Tool {
    pub name: &'static str,
    pub description: &'static str,
    pub schema: fn() -> Value,
}

pub const TOOLS: &[Tool] = &[
    Tool {
        name: "apex_context_read",
        description: "Read the shared context every agent on this project can see. \
                      Without a key it lists what is there.",
        schema: || {
            json!({
                "type": "object",
                "properties": { "key": { "type": "string", "description": "Entry to read" } }
            })
        },
    },
    Tool {
        name: "apex_context_write",
        description: "Write an entry of shared context, replacing it. \
                      Use it for findings the other agents should have.",
        schema: || {
            json!({
                "type": "object",
                "required": ["key", "content"],
                "properties": {
                    "key": { "type": "string" },
                    "content": { "type": "string", "description": "Markdown" }
                }
            })
        },
    },
    Tool {
        name: "apex_sessions_list",
        description: "List the other agents running on this project, with their state and branch.",
        schema: || json!({ "type": "object", "properties": {} }),
    },
    Tool {
        name: "apex_session_transcript",
        description: "Read the recent output of another agent, to see what it is doing.",
        schema: || {
            json!({
                "type": "object",
                "required": ["session"],
                "properties": {
                    "session": { "type": "string", "description": "Session id from apex_sessions_list" }
                }
            })
        },
    },
    Tool {
        name: "apex_note",
        description: "Leave a note for the next agent, or for one in particular.",
        schema: || {
            json!({
                "type": "object",
                "required": ["message"],
                "properties": {
                    "message": { "type": "string" },
                    "to": { "type": "string", "description": "Agent this is meant for" }
                }
            })
        },
    },
    Tool {
        name: "apex_spawn_agent",
        description: "Start another agent on this project and hand it a task. \
                      Read what it does afterwards with apex_session_transcript.",
        schema: || {
            json!({
                "type": "object",
                "required": ["agent"],
                "properties": {
                    "agent": { "type": "string", "description": "Agent name, as apex knows it" },
                    "task": { "type": "string", "description": "What it should do first" },
                    "isolation": {
                        "type": "string",
                        "enum": ["directory", "worktree"],
                        "description": "worktree gives it its own branch and folder"
                    }
                }
            })
        },
    },
    Tool {
        name: "apex_agents_list",
        description: "List the agents you can start here, and whether each one can take a \
                      written task on its own or only works as an interactive terminal.",
        schema: || json!({ "type": "object", "properties": {} }),
    },
    Tool {
        name: "apex_session_tell",
        description: "Send more instructions to a session that is already running.",
        schema: || {
            json!({
                "type": "object",
                "required": ["session", "message"],
                "properties": {
                    "session": { "type": "string" },
                    "message": { "type": "string" }
                }
            })
        },
    },
    Tool {
        name: "apex_done",
        description: "Say your task is finished. Your session stays alive so whoever \
                      started you can still read it, but it stops showing as running.",
        schema: || {
            json!({
                "type": "object",
                "properties": {
                    "summary": { "type": "string", "description": "What you did, for whoever started you" }
                }
            })
        },
    },
    Tool {
        name: "apex_close_session",
        description: "Close a session you started yourself. Its worktree, if any, stays on disk.",
        schema: || {
            json!({
                "type": "object",
                "required": ["session"],
                "properties": { "session": { "type": "string" } }
            })
        },
    },
    Tool {
        name: "apex_broadcast",
        description: "Hand the same task to several agents at once, each in its own session. \
                      Read what each one did with apex_session_transcript.",
        schema: || {
            json!({
                "type": "object",
                "required": ["agents", "task"],
                "properties": {
                    "agents": { "type": "array", "items": { "type": "string" } },
                    "task": { "type": "string" },
                    "isolation": { "type": "string", "enum": ["directory", "worktree"] }
                }
            })
        },
    },
    Tool {
        name: "apex_open_view",
        description: "Ask Apex to open something for the person watching: another session, \
                      a file of this project, or a url. They decide where it lands.",
        schema: || {
            json!({
                "type": "object",
                "required": ["kind"],
                "properties": {
                    "kind": { "type": "string", "enum": ["session", "file", "url"] },
                    "session": { "type": "string", "description": "Session id, for kind session" },
                    "path": { "type": "string", "description": "Path in the project, for kind file" },
                    "url": { "type": "string", "description": "Address, for kind url" }
                }
            })
        },
    },
    Tool {
        name: "apex_worktree_info",
        description: "Report which branch and folder this session is working in.",
        schema: || json!({ "type": "object", "properties": {} }),
    },
];

pub struct Caller {
    pub session: Uuid,
    pub project: Uuid,
    pub title: String,
    pub summary: SessionSummary,
}

pub fn command_for(caller: &Caller, tool: &str, arguments: &Value) -> Result<Command> {
    let text = |key: &str| -> Option<String> {
        arguments.get(key).and_then(Value::as_str).map(str::to_owned)
    };

    match tool {
        "apex_context_read" => Ok(match text("key") {
            Some(key) => Command::ContextRead { project: caller.project, key },
            None => Command::ContextList { project: caller.project },
        }),
        "apex_context_write" => Ok(Command::ContextWrite {
            project: caller.project,
            key: text("key").context("key is required")?,
            contents: text("content").context("content is required")?,
        }),
        "apex_sessions_list" => Ok(Command::ListSessions),
        "apex_open_view" => Ok(Command::OpenView {
            asked_by: caller.session,
            target: match text("kind").as_deref() {
                Some("session") => {
                    let raw = text("session").context("session is required")?;
                    let id = Uuid::parse_str(&raw)
                        .with_context(|| format!("{raw} is not a session id"))?;
                    ViewTarget::Session { id }
                }
                Some("file") => ViewTarget::File {
                    project: caller.project,
                    path: text("path").context("path is required")?,
                },
                Some("url") => ViewTarget::Url {
                    url: text("url").context("url is required")?,
                },
                other => bail!("{} is not a kind, use session, file or url", other.unwrap_or("nothing")),
            },
        }),
        "apex_agents_list" => Ok(Command::ListAgents),
        "apex_session_tell" => Ok(Command::SessionTell {
            id: session_id(&text("session"))?,
            text: text("message").context("message is required")?,
        }),
        "apex_done" => Ok(Command::SessionDone {
            id: caller.session,
            summary: text("summary"),
        }),
        "apex_close_session" => Ok(Command::SessionDismiss {
            asked_by: caller.session,
            id: session_id(&text("session"))?,
        }),
        "apex_broadcast" => Ok(Command::SessionBroadcast {
            parent: caller.session,
            agents: arguments
                .get("agents")
                .and_then(Value::as_array)
                .map(|named| named.iter().filter_map(Value::as_str).map(str::to_owned).collect())
                .unwrap_or_default(),
            task: text("task").context("task is required")?,
            isolation: isolation_from(text("isolation").as_deref())?,
        }),
        "apex_spawn_agent" => Ok(Command::SessionSpawn {
            parent: caller.session,
            agent: text("agent").context("agent is required")?,
            task: text("task"),
            isolation: isolation_from(text("isolation").as_deref())?,
        }),
        "apex_session_transcript" => {
            let raw = text("session").context("session is required")?;
            let id = Uuid::parse_str(&raw).with_context(|| format!("{raw} is not a session id"))?;
            Ok(Command::SessionTranscript { id, tail: TRANSCRIPT_TAIL, plain: true })
        }
        "apex_note" => Ok(Command::ContextNote {
            project: caller.project,
            from: caller.title.clone(),
            to: text("to"),
            message: text("message").context("message is required")?,
        }),
        _ => bail!("unknown tool {tool}"),
    }
}

pub fn describe_sessions(caller: &Caller, sessions: &[SessionSummary]) -> String {
    let mine: Vec<&SessionSummary> = sessions
        .iter()
        .filter(|session| session.project_id == caller.project && session.id != caller.session)
        .collect();

    if mine.is_empty() {
        return "No other agents are running on this project.".to_owned();
    }

    mine.iter()
        .map(|session| {
            let branch = session
                .worktree
                .as_ref()
                .map(|tree| tree.branch.as_str())
                .unwrap_or("the project folder");
            let origin = match session.parent {
                Some(id) if id == caller.session => ", spawned by you",
                Some(_) => ", spawned by another agent",
                None => "",
            };
            let how = match session.mode {
                apex_proto::AgentMode::Acp => "reachable with apex_session_tell",
                apex_proto::AgentMode::Pty => "a terminal, only typed into",
            };
            format!(
                "- {} ({}, {how}) is {} on {}{}, id {}",
                session.title,
                session.agent,
                session.state.as_str(),
                branch,
                origin,
                session.id
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn session_id(raw: &Option<String>) -> Result<Uuid> {
    let raw = raw.as_deref().context("session is required")?;
    Uuid::parse_str(raw).with_context(|| format!("{raw} is not a session id"))
}

pub fn describe_agents(agents: &[apex_proto::AgentSummary]) -> String {
    let usable: Vec<&apex_proto::AgentSummary> =
        agents.iter().filter(|agent| agent.is_available()).collect();
    if usable.is_empty() {
        return "No agents are installed here.".to_owned();
    }
    usable
        .iter()
        .map(|agent| {
            let how = if agent.speaks_acp {
                "takes a written task on its own"
            } else {
                "interactive terminal, a task is only typed into it"
            };
            format!("- {} — {how}", agent.name)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn isolation_from(wanted: Option<&str>) -> Result<Isolation> {
    match wanted {
        Some("worktree") => Ok(Isolation::Worktree),
        Some("directory") | None => Ok(Isolation::Directory),
        Some(other) => bail!("{other} is not an isolation, use directory or worktree"),
    }
}

pub fn describe_broadcast(sessions: &[SessionSummary]) -> String {
    let started = sessions
        .iter()
        .map(|session| format!("- {} ({}), id {}", session.title, session.agent, session.id))
        .collect::<Vec<_>>()
        .join("\n");
    format!("{} agents took the task:\n{started}", sessions.len())
}

pub fn describe_spawn(session: &SessionSummary) -> String {
    let where_at = match &session.worktree {
        Some(tree) => format!("on branch {} at {}", tree.branch, tree.path),
        None => format!("in the project folder at {}", session.cwd),
    };
    let handed = match session.mode {
        apex_proto::AgentMode::Acp => "It took your task as a prompt",
        apex_proto::AgentMode::Pty => {
            "It is an interactive terminal, so your task was only typed into it"
        }
    };
    format!(
        "{} ({}) is running {}, id {}. {handed}. Read what it does with apex_session_transcript.",
        session.title, session.agent, where_at, session.id
    )
}

pub fn describe_worktree(caller: &Caller) -> String {
    match &caller.summary.worktree {
        Some(tree) => format!(
            "You are on branch {} in an isolated worktree at {}. \
             Your changes cannot collide with the other agents.",
            tree.branch, tree.path
        ),
        None => format!(
            "You are working directly in the project folder at {}, \
             shared with anyone else who is not isolated.",
            caller.summary.cwd
        ),
    }
}

#[cfg(test)]
#[path = "tools_tests.rs"]
mod tests;
