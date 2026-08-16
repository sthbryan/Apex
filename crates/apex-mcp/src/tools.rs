use anyhow::{Context, Result, bail};
use apex_proto::{Command, Isolation, SessionSummary};
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
        "apex_spawn_agent" => Ok(Command::SessionSpawn {
            parent: caller.session,
            agent: text("agent").context("agent is required")?,
            task: text("task"),
            isolation: match text("isolation").as_deref() {
                Some("worktree") => Isolation::Worktree,
                Some("directory") | None => Isolation::Directory,
                Some(other) => bail!("{other} is not an isolation, use directory or worktree"),
            },
        }),
        "apex_session_transcript" => {
            let raw = text("session").context("session is required")?;
            let id = Uuid::parse_str(&raw).with_context(|| format!("{raw} is not a session id"))?;
            Ok(Command::SessionTranscript { id, tail: TRANSCRIPT_TAIL })
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
            format!(
                "- {} ({}) is {} on {}{}, id {}",
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

pub fn describe_spawn(session: &SessionSummary) -> String {
    let where_at = match &session.worktree {
        Some(tree) => format!("on branch {} at {}", tree.branch, tree.path),
        None => format!("in the project folder at {}", session.cwd),
    };
    format!(
        "{} ({}) is running {}, id {}. Read what it does with apex_session_transcript.",
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
