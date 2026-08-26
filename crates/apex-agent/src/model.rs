use anyhow::Result;
use rig_core::client::ModelListingClient;
use rig_core::model::ModelList;

use crate::provider::Wire;

const NOT_FOR_CODING: &[&str] = &[
    "embed",
    "tts",
    "whisper",
    "transcribe",
    "moderation",
    "dall-e",
    "image",
    "rerank",
    "audio",
    "realtime",
    "guard",
    "sora",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Model {
    pub id: String,
    pub label: String,
    pub context: Option<u32>,
}

pub async fn list(wire: &Wire) -> Result<Vec<Model>> {
    let listed = match wire {
        Wire::Openai(client) => client.list_models().await,
        Wire::Compatible(client) => client.list_models().await,
        Wire::Anthropic(client) => client.list_models().await,
        Wire::Gemini(client) => client.list_models().await,
    }?;
    Ok(shape(listed))
}

fn shape(listed: ModelList) -> Vec<Model> {
    let mut models: Vec<Model> = listed
        .iter()
        .filter(|model| useful(&model.id))
        .map(|model| Model {
            id: model.id.clone(),
            label: model.display_name().to_owned(),
            context: model.context_length,
        })
        .collect();
    models.sort_by(|one, other| one.id.cmp(&other.id));
    models.dedup_by(|one, other| one.id == other.id);
    models
}

fn useful(id: &str) -> bool {
    if id.trim().is_empty() {
        return false;
    }
    let id = id.to_lowercase();
    !NOT_FOR_CODING.iter().any(|kind| id.contains(kind))
}

#[cfg(test)]
#[path = "model_tests.rs"]
mod tests;
