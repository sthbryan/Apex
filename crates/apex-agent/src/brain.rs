use rig_core::client::CompletionClient;
use rig_core::completion::{
    CompletionError, CompletionModel, CompletionRequest, CompletionResponse, ProviderCapabilities,
};
use rig_core::providers::{anthropic, gemini, openai};
use rig_core::streaming::StreamingCompletionResponse;

use crate::provider::Wire;

macro_rules! each {
    ($brain:expr, $model:ident => $body:expr) => {
        match $brain {
            Brain::Openai($model) => $body,
            Brain::Compatible($model) => $body,
            Brain::Anthropic($model) => $body,
            Brain::Gemini($model) => $body,
        }
    };
}

pub enum Brain {
    Openai(<openai::Client as CompletionClient>::CompletionModel),
    Compatible(<openai::CompletionsClient as CompletionClient>::CompletionModel),
    Anthropic(<anthropic::Client as CompletionClient>::CompletionModel),
    Gemini(<gemini::Client as CompletionClient>::CompletionModel),
}

impl Wire {
    pub fn brain(&self, model: &str) -> Brain {
        match self {
            Wire::Openai(client) => Brain::Openai(client.completion_model(model)),
            Wire::Compatible(client) => Brain::Compatible(client.completion_model(model)),
            Wire::Anthropic(client) => Brain::Anthropic(client.completion_model(model)),
            Wire::Gemini(client) => Brain::Gemini(client.completion_model(model)),
        }
    }
}

impl CompletionModel for Brain {
    async fn completion(
        &self,
        request: CompletionRequest,
    ) -> Result<CompletionResponse, CompletionError> {
        each!(self, model => model.completion(request).await)
    }

    async fn stream(
        &self,
        request: CompletionRequest,
    ) -> Result<StreamingCompletionResponse, CompletionError> {
        each!(self, model => model.stream(request).await)
    }

    fn capabilities(&self) -> ProviderCapabilities {
        each!(self, model => model.capabilities())
    }
}
