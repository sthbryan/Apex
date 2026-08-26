use anyhow::Result;
use rig_core::completion::ToolDefinition;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::{Kit, asked};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Pending,
    InProgress,
    Completed,
}

impl Status {
    pub fn mark(self) -> &'static str {
        match self {
            Self::Pending => "○",
            Self::InProgress => "◐",
            Self::Completed => "●",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Todo {
    pub content: String,
    pub status: Status,
}

#[derive(Debug, Deserialize)]
struct Args {
    items: Vec<Todo>,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "todo".to_owned(),
        description: "Put up the list of steps you are working through, or replace it with an updated one. Use it for work with several steps, not for a single change."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "description": "The whole list, in order. Send it entire every time, not just what changed.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "content": { "type": "string", "description": "What the step is." },
                            "status": { "type": "string", "enum": ["pending", "in_progress", "completed"] }
                        },
                        "required": ["content", "status"]
                    }
                }
            },
            "required": ["items"]
        }),
    }
}

pub async fn run(kit: &Kit, args: &Value) -> Result<String> {
    let args: Args = asked(args)?;
    kit.plans(args.items.clone());
    Ok(spell(&args.items))
}

fn spell(items: &[Todo]) -> String {
    if items.is_empty() {
        return "the list is empty now\n".to_owned();
    }
    let left = items.iter().filter(|item| item.status != Status::Completed).count();
    format!("{} steps, {left} still to do\n", items.len())
}

#[cfg(test)]
#[path = "todo_tests.rs"]
mod tests;
