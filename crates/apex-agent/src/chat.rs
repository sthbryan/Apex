use std::sync::Arc;

use anyhow::{Result, bail};
use futures_util::StreamExt;
use rig_core::completion::{CompletionRequestBuilder, Message, Usage};
use rig_core::message::{AssistantContent, ToolResultContent, UserContent};
use rig_core::streaming::StreamedAssistantContent;

use crate::brain::Brain;
use crate::log::{self, Log};
use crate::mode::Mode;
use crate::tools::todo::Todo;
use crate::tools::{Call, Done, Kit, ask};
use crate::window;

const MOST_ROUNDS: usize = 40;

const SUMMARISE: &str = "Sum this conversation up so it can carry on without the messages above. Keep what was asked, what was decided and why, what was changed and where, and what is still open. Leave out small talk and file contents you already acted on. Write it as notes, not prose.";

pub trait Surface {
    fn said(&mut self, text: &str);
    fn thought(&mut self, text: &str) {
        let _ = text;
    }
    fn running(&mut self, call: &Call) {
        let _ = call;
    }
    fn ran(&mut self, call: &Call, done: &Done) {
        let _ = (call, done);
    }
    fn noted(&mut self, text: &str) {
        let _ = text;
    }
    fn planned(&mut self, items: &[Todo]) {
        let _ = items;
    }
    fn asked(
        &mut self,
        group: &str,
        questions: &[ask::Question],
    ) -> impl std::future::Future<Output = Vec<Option<String>>> {
        let _ = group;
        std::future::ready(vec![None; questions.len()])
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
    kit: Kit,
    log: Option<Log>,
    window: Option<u32>,
    filled: u64,
    preamble: String,
    history: Vec<Message>,
    spent: Spent,
}

impl Chat {
    pub fn new(brain: Brain, kit: Kit, preamble: impl Into<String>) -> Self {
        Self {
            brain: Arc::new(brain),
            kit,
            log: None,
            window: None,
            filled: 0,
            preamble: preamble.into(),
            history: Vec::new(),
            spent: Spent::default(),
        }
    }

    pub fn holds(&mut self, window: Option<u32>) {
        self.window = window;
    }

    pub fn window(&self) -> Option<u32> {
        self.window
    }

    pub fn filled(&self) -> u64 {
        self.filled
    }

    pub fn how_full(&self) -> Option<u8> {
        window::how_full(self.filled, self.window)
    }

    pub fn keeps(&mut self, log: Log) {
        self.log = Some(log);
    }

    pub fn picks_up(&mut self, messages: Vec<Message>) {
        self.history = messages;
    }

    pub fn works_in(&mut self, mode: Mode) {
        self.kit.works_in(mode);
    }

    pub fn mode(&self) -> Mode {
        self.kit.mode()
    }

    pub fn spent(&self) -> Spent {
        self.spent
    }

    pub fn history(&self) -> &[Message] {
        &self.history
    }

    pub async fn turn(&mut self, said: &str, surface: &mut impl Surface) -> Result<()> {
        self.remember(Message::user(said));

        for round in 0..MOST_ROUNDS {
            let choice = self.round(surface).await?;
            let calls = wanted(&choice);
            if !said_nothing(&choice) {
                self.remember(Message::Assistant { id: None, content: choice });
            }
            if calls.is_empty() {
                return Ok(());
            }
            if round + 1 == MOST_ROUNDS {
                break;
            }
            let answers = self.serve(&calls, surface).await;
            self.remember(Message::User { content: answers });
        }

        surface.noted(&format!("stopped after {MOST_ROUNDS} rounds of tools"));
        Ok(())
    }

    fn remember(&mut self, message: Message) {
        if let Some(log) = &self.log {
            log.wrote(&message);
        }
        self.history.push(message);
    }

    pub async fn compact(&mut self) -> Result<String> {
        if self.history.is_empty() {
            bail!("there is nothing to sum up yet")
        }
        let answer =
            CompletionRequestBuilder::new(Arc::clone(&self.brain), Message::user(SUMMARISE))
                .preamble(self.preamble.clone())
                .messages(self.history.clone())
                .send()
                .await?;

        self.spent.add(&answer.usage);
        let summary = spoken(&answer.choice);
        if summary.trim().is_empty() {
            bail!("the model summed it up as nothing")
        }

        if let Some(log) = &self.log {
            log.compacted(&summary);
        }
        self.history = vec![Message::user(log::wrapped(&summary))];
        self.filled = 0;
        Ok(summary)
    }

    async fn round(&mut self, surface: &mut impl Surface) -> Result<Vec<AssistantContent>> {
        let (prior, prompt) = split(&self.history);
        let mut stream = CompletionRequestBuilder::new(Arc::clone(&self.brain), prompt)
            .preamble(told(&self.preamble, self.kit.mode()))
            .messages(prior)
            .tools(self.kit.offered())
            .stream()
            .await?;

        while let Some(part) = stream.next().await {
            match part? {
                StreamedAssistantContent::Text(text) => surface.said(&text.text),
                StreamedAssistantContent::ReasoningDelta { reasoning, .. } => {
                    surface.thought(&reasoning);
                }
                StreamedAssistantContent::Final(ending) => {
                    self.filled = ending.usage.input_tokens + ending.usage.output_tokens;
                    self.spent.add(&ending.usage);
                }
                _ => {}
            }
        }
        Ok(std::mem::take(&mut stream.choice))
    }

    async fn serve(&self, calls: &[Call], surface: &mut impl Surface) -> Vec<UserContent> {
        let mut answers = Vec::with_capacity(calls.len());
        for call in calls {
            surface.running(call);
            let done = match call.name.as_str() {
                "ask" => person(call, surface).await,
                _ => self.kit.run(call).await,
            };
            surface.ran(call, &done);
            if call.name == "todo" && done.went_well() {
                surface.planned(&self.kit.todo());
            }
            answers.push(UserContent::tool_result(
                call.id.clone(),
                call.name.clone(),
                vec![ToolResultContent::text(spell(&done))],
            ));
        }
        answers
    }
}

fn told(preamble: &str, mode: Mode) -> String {
    let hint = mode.hint();
    match hint.is_empty() {
        true => preamble.to_owned(),
        false => format!("{}\n\n{hint}\n", preamble.trim_end()),
    }
}

async fn person(call: &Call, surface: &mut impl Surface) -> Done {
    let asking = match ask::read(&call.args) {
        Ok(asking) => asking,
        Err(cause) => return Done::Failed(format!("{cause:#}")),
    };
    let answers = surface.asked(&call.id, &asking.questions).await;
    match answers.iter().any(Option::is_some) {
        true => Done::Said(ask::spell(&asking.questions, &answers)),
        false => Done::Failed("nobody answered".to_owned()),
    }
}

fn split(history: &[Message]) -> (Vec<Message>, Message) {
    match history.split_last() {
        Some((last, prior)) => (prior.to_vec(), last.clone()),
        None => (Vec::new(), Message::user("")),
    }
}

fn wanted(choice: &[AssistantContent]) -> Vec<Call> {
    choice
        .iter()
        .filter_map(|part| match part {
            AssistantContent::ToolCall(called) => Some(Call {
                id: called.id.as_str().to_owned(),
                name: called.function.name.clone(),
                args: called.function.arguments.clone(),
            }),
            _ => None,
        })
        .collect()
}

fn spell(done: &Done) -> String {
    match done {
        Done::Said(text) => text.clone(),
        Done::Failed(text) => format!("failed: {text}"),
    }
}

fn spoken(choice: &[AssistantContent]) -> String {
    choice
        .iter()
        .filter_map(|part| match part {
            AssistantContent::Text(text) => Some(text.text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("")
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
