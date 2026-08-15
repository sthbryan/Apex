use anyhow::{Context, Result, bail};
use apex_proto::{Command, SessionSummary};
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
            format!(
                "- {} ({}) is {} on {}, id {}",
                session.title,
                session.agent,
                session.state.as_str(),
                branch,
                session.id
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
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
mod tests {
    use super::*;
    use apex_proto::{SessionState, TerminalSize, WorktreeInfo};

    fn session(title: &str, worktree: Option<WorktreeInfo>) -> SessionSummary {
        SessionSummary {
            id: Uuid::new_v4(),
            project_id: Uuid::nil(),
            agent: "claude".into(),
            title: title.into(),
            cwd: "/tmp/project".into(),
            state: SessionState::Working,
            size: TerminalSize::default(),
            exit_code: None,
            worktree,
            task: None,
            mode: apex_proto::AgentMode::Pty,
        }
    }

    fn caller(summary: SessionSummary) -> Caller {
        Caller {
            session: summary.id,
            project: summary.project_id,
            title: summary.title.clone(),
            summary,
        }
    }

    #[test]
    fn every_tool_publishes_an_object_schema() {
        for tool in TOOLS {
            let schema = (tool.schema)();
            assert_eq!(schema["type"], "object", "{} has no object schema", tool.name);
            assert!(!tool.description.is_empty());
        }
    }

    #[test]
    fn reading_without_a_key_lists_the_context() {
        let me = caller(session("claude", None));
        assert!(matches!(
            command_for(&me, "apex_context_read", &json!({})).expect("command"),
            Command::ContextList { .. }
        ));
        assert!(matches!(
            command_for(&me, "apex_context_read", &json!({ "key": "architecture" })).expect("command"),
            Command::ContextRead { key, .. } if key == "architecture"
        ));
    }

    #[test]
    fn a_note_is_signed_with_the_calling_session() {
        let me = caller(session("codex 2", None));
        let command = command_for(&me, "apex_note", &json!({ "message": "done" })).expect("command");
        assert!(matches!(command, Command::ContextNote { from, to: None, .. } if from == "codex 2"));
    }

    #[test]
    fn missing_arguments_are_refused_before_reaching_the_daemon() {
        let me = caller(session("claude", None));
        assert!(command_for(&me, "apex_context_write", &json!({ "key": "a" })).is_err());
        assert!(command_for(&me, "apex_session_transcript", &json!({ "session": "nope" })).is_err());
        assert!(command_for(&me, "apex_unknown", &json!({})).is_err());
    }

    #[test]
    fn the_listing_hides_the_caller_and_other_projects() {
        let me = caller(session("claude", None));
        let mate = session("codex", None);
        let stranger = SessionSummary { project_id: Uuid::new_v4(), ..session("elsewhere", None) };

        let text = describe_sessions(&me, &[me.summary.clone(), mate.clone(), stranger]);
        assert!(text.contains("codex"));
        assert!(!text.contains("elsewhere"));
        assert!(!text.contains(&me.session.to_string()));
        assert!(text.contains(&mate.id.to_string()));

        assert_eq!(
            describe_sessions(&me, std::slice::from_ref(&me.summary)),
            "No other agents are running on this project."
        );
    }

    #[test]
    fn the_worktree_answer_says_whether_you_are_isolated() {
        let isolated = caller(session(
            "claude",
            Some(WorktreeInfo { path: "/tmp/wt".into(), branch: "apex/claude".into() }),
        ));
        assert!(describe_worktree(&isolated).contains("apex/claude"));
        assert!(describe_worktree(&isolated).contains("cannot collide"));

        let shared = caller(session("claude", None));
        assert!(describe_worktree(&shared).contains("/tmp/project"));
    }
}
