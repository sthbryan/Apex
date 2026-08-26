use anyhow::Result;
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::asked;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Asking {
    pub question: String,
    #[serde(default)]
    pub options: Vec<String>,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "ask".to_owned(),
        description: "Ask the person a question and wait for their answer. Use it when a choice is theirs to make, not to check work you can check yourself."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "question": { "type": "string", "description": "What you need to know, in one sentence." },
                "options": {
                    "type": "array",
                    "description": "Answers to offer. Leave it out when the answer is open.",
                    "items": { "type": "string" }
                }
            },
            "required": ["question"]
        }),
    }
}

pub fn read(args: &Value) -> Result<Asking> {
    let asking: Asking = asked(args)?;
    Ok(asking)
}

#[cfg(test)]
#[path = "ask_tests.rs"]
mod tests;
