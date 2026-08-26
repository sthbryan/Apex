use std::sync::Arc;

use anyhow::Result;
use futures_util::StreamExt;
use rig_core::completion::{CompletionRequestBuilder, Message, Usage};
use rig_core::message::AssistantContent;
use rig_core::streaming::StreamedAssistantContent;

use crate::brain::Brain;

pub trait Surface {
    fn said(&mut self, text: &str);
    fn thought(&mut self, text: &str) {
        let _ = text;
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Spent {
    pub sent: u64,
    pub back: u64,
}

impl Spent {
    pub fn total(&self) -> u64 {
        self.sent + self.back
    }

    fn add(&mut self, usage: &Usage) {
        self.sent += usage.input_tokens;
        self.back += usage.output_tokens;
    }
}

pub struct Chat {
    brain: Arc<Brain>,
    preamble: String,
    history: Vec<Message>,
    spent: Spent,
}

impl Chat {
    pub fn new(brain: Brain, preamble: impl Into<String>) -> Self {
        Self {
            brain: Arc::new(brain),
            preamble: preamble.into(),
            history: Vec::new(),
            spent: Spent::default(),
        }
    }

    pub fn spent(&self) -> Spent {
        self.spent
    }

    pub fn history(&self) -> &[Message] {
        &self.history
    }

    pub async fn turn(&mut self, said: &str, surface: &mut impl Surface) -> Result<()> {
        let asked = Message::user(said);
        let mut stream = CompletionRequestBuilder::new(Arc::clone(&self.brain), asked.clone())
            .preamble(self.preamble.clone())
            .messages(self.history.clone())
            .stream()
            .await?;

        while let Some(part) = stream.next().await {
            match part? {
                StreamedAssistantContent::Text(text) => surface.said(&text.text),
                StreamedAssistantContent::ReasoningDelta { reasoning, .. } => {
                    surface.thought(&reasoning);
                }
                StreamedAssistantContent::Final(ending) => self.spent.add(&ending.usage),
                _ => {}
            }
        }

        remember(&mut self.history, asked, std::mem::take(&mut stream.choice));
        Ok(())
    }
}

fn remember(history: &mut Vec<Message>, asked: Message, choice: Vec<AssistantContent>) {
    history.push(asked);
    if said_nothing(&choice) {
        return;
    }
    history.push(Message::Assistant { id: None, content: choice });
}

fn said_nothing(choice: &[AssistantContent]) -> bool {
    choice.iter().all(|part| match part {
        AssistantContent::Text(text) => text.text.trim().is_empty(),
        _ => false,
    })
}

#[cfg(test)]
#[path = "chat_tests.rs"]
mod tests;
