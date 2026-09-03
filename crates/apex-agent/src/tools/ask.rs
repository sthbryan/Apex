use anyhow::Result;
use rig_core::completion::ToolDefinition;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::asked;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Choice {
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub example: Option<Example>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Example {
    #[serde(default)]
    pub title: Option<String>,
    pub content: String,
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Question {
    pub question: String,
    #[serde(default)]
    pub options: Vec<Choice>,
    #[serde(default)]
    pub example: Option<Example>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Asking {
    #[serde(default)]
    pub questions: Vec<Question>,
}

pub fn offered() -> ToolDefinition {
    ToolDefinition {
        name: "ask".to_owned(),
        description: "Ask the person one or more questions and wait for their answers. Use it when a choice is theirs to make, not to check work you can check yourself. Put every question you have into the one call: they are answered together as a set. Each question carries the answers to that question, never other questions, and never Yes/No as a single option: one option per answer. Add an optional example to a question or option only when seeing concrete text or code would make the choice clearer."
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
                            "example": example_schema("An optional example that makes the choice concrete."),
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
                                        },
                                        "example": example_schema("An optional example shown when this answer is selected.")
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
                example: choice.example.and_then(clean_example),
            })
            .collect();
        if options.len() < 2 {
            anyhow::bail!(
                "a question with nothing to pick from cannot be answered, offer at least two options"
            )
        }
        kept.push(Question {
            question: question.question.trim().to_owned(),
            options,
            example: question.example.and_then(clean_example),
        });
    }

    Ok(Asking { questions: kept })
}

fn clean_example(example: Example) -> Option<Example> {
    let content = example.content.trim().to_owned();
    (!content.is_empty()).then(|| Example {
        title: example.title.map(|title| title.trim().to_owned()).filter(|title| !title.is_empty()),
        content,
        language: example
            .language
            .map(|language| language.trim().to_owned())
            .filter(|language| !language.is_empty()),
    })
}

fn example_schema(description: &str) -> Value {
    json!({
        "type": "object",
        "description": description,
        "properties": {
            "title": { "type": "string", "description": "A short heading for the example." },
            "content": { "type": "string", "description": "The example itself. Use meaningful line breaks and indentation for code, trees, diagrams, or structured text." },
            "language": { "type": "string", "description": "Optional language hint such as text, json, typescript, or bash." }
        },
        "required": ["content"]
    })
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
