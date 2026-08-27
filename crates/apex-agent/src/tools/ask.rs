use anyhow::Result;
use rig_core::completion::ToolDefinition;
use serde::Deserialize;
use serde_json::{Value, json};

use super::asked;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Choice {
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Question {
    pub question: String,
    #[serde(default)]
    pub options: Vec<Choice>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Asking {
    #[serde(default)]
    pub questions: Vec<Question>,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "ask".to_owned(),
        description: "Ask the person one or more questions and wait for their answers. Use it when a choice is theirs to make, not to check work you can check yourself. Put every question you have into the one call: they are answered together as a set. Each question carries the answers to that question, never other questions, and never Yes/No as a single option: one option per answer."
            .to_owned(),
        parameters: json!({
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "description": "Everything you need to know, asked together.",
                    "minItems": 1,
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": {
                                "type": "string",
                                "description": "What you need to know, in one sentence."
                            },
                            "options": {
                                "type": "array",
                                "description": "The answers to this question, at least two. Each is one answer the person could give, not another question.",
                                "minItems": 2,
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "label": {
                                            "type": "string",
                                            "description": "The answer itself, a few words."
                                        },
                                        "description": {
                                            "type": "string",
                                            "description": "One short line on what picking it means."
                                        }
                                    },
                                    "required": ["label"]
                                }
                            }
                        },
                        "required": ["question", "options"]
                    }
                }
            },
            "required": ["questions"]
        }),
    }
}

pub fn read(args: &Value) -> Result<Asking> {
    let asking: Asking = asked(args)?;
    if asking.questions.is_empty() {
        anyhow::bail!("ask needs at least one question")
    }

    let mut kept = Vec::new();
    for question in asking.questions {
        if question.question.trim().is_empty() {
            anyhow::bail!("ask needs a question")
        }
        let options: Vec<Choice> = question
            .options
            .into_iter()
            .filter(|choice| !choice.label.trim().is_empty())
            .map(|choice| Choice {
                label: choice.label.trim().to_owned(),
                description: choice
                    .description
                    .map(|line| line.trim().to_owned())
                    .filter(|line| !line.is_empty()),
            })
            .collect();
        if options.len() < 2 {
            anyhow::bail!(
                "a question with nothing to pick from cannot be answered, offer at least two options"
            )
        }
        kept.push(Question { question: question.question.trim().to_owned(), options });
    }

    Ok(Asking { questions: kept })
}

pub fn spell(questions: &[Question], answers: &[Option<String>]) -> String {
    if let ([one], [Some(answer)]) = (questions, answers) {
        let _ = one;
        return answer.clone();
    }
    questions
        .iter()
        .zip(answers.iter())
        .map(|(question, answer)| match answer {
            Some(said) => format!("{}: {said}", question.question),
            None => format!("{}: no answer", question.question),
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
#[path = "ask_tests.rs"]
mod tests;
