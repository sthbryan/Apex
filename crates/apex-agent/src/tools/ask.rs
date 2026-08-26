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
        description: "Ask the person a question and wait for their answer. Use it when a choice is theirs to make, not to check work you can check yourself. Always offer at least two answers to pick from, kept short."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "question": { "type": "string", "description": "What you need to know, in one sentence." },
                "options": {
                    "type": "array",
                    "description": "The answers to offer, at least two, each a few words long.",
                    "minItems": 2,
                    "items": { "type": "string" }
                }
            },
            "required": ["question", "options"]
        }),
    }
}

pub fn read(args: &Value) -> Result<Asking> {
    let asking: Asking = asked(args)?;
    if asking.question.trim().is_empty() {
        anyhow::bail!("ask needs a question")
    }
    let kept: Vec<String> = asking
        .options
        .iter()
        .map(|option| option.trim().to_owned())
        .filter(|option| !option.is_empty())
        .collect();
    if kept.len() < 2 {
        anyhow::bail!(
            "a question with nothing to pick from cannot be answered, offer at least two options"
        )
    }
    Ok(Asking { question: asking.question, options: kept })
}

#[cfg(test)]
#[path = "ask_tests.rs"]
mod tests;
