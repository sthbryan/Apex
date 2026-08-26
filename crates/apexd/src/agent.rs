use std::io::{IsTerminal, Write};

use anyhow::{Context, Result};
use apex_agent::chat::{Chat, Spent, Surface};
use apex_agent::choice::{self, Choice};
use apex_agent::log::{self, Head, Log};
use apex_agent::mode::Mode;
use apex_agent::tools::todo::Todo;
use apex_agent::tools::{Call, Done, Kit, sketch};
use apex_agent::{ProviderSet, key, preamble};
use apex_core::ApexPaths;
use tokio::io::{AsyncBufReadExt, BufReader, Lines, Stdin};

use crate::cli::Run;

const DIM: &str = "\x1b[2m";
const PLAIN: &str = "\x1b[0m";

const HELP: &str = "  /help          print this
  /mode <name>   switch to auto, plan or chat
  /exit          leave the agent
";

pub async fn run(run: Run) -> Result<i32> {
    if let Some(wrong) = run.wrong {
        eprintln!("apex: {wrong}");
        return Ok(2);
    }

    let paths = ApexPaths::discover()?;
    let set = ProviderSet::load(&paths.providers_dir())?;
    let agent_dir = paths.agent_dir();

    let mode = match run.mode.as_deref().map(str::trim) {
        Some(name) => match Mode::parse(name) {
            Some(mode) => mode,
            None => {
                eprintln!("apex: there is no {name} mode, only auto, plan and chat");
                return Ok(2);
            }
        },
        None => Mode::default(),
    };

    let picked = match pick(&run, choice::read(&agent_dir).as_ref()) {
        Ok(picked) => picked,
        Err(complaint) => {
            eprintln!("apex: {complaint}");
            return Ok(2);
        }
    };

    let Some(provider) = set.get(&picked.provider) else {
        eprintln!("apex: there is no provider called {}", picked.provider);
        eprintln!("apex: known ones are {}", crate::auth::spell_names(&set));
        return Ok(2);
    };

    let key = match key::find(provider)? {
        Some(held) => held.key,
        None if provider.keyless => String::new(),
        None => {
            eprintln!(
                "apex: {} has no key yet, run apex auth add {}",
                provider.name, provider.name
            );
            return Ok(2);
        }
    };

    let here = std::env::current_dir().context("finding where you are")?;
    let brain = provider.dial(&key)?.brain(&picked.model);
    let mut chat = Chat::new(brain, Kit::new(&here), preamble::read(&agent_dir));
    chat.works_in(mode);
    choice::write(&agent_dir, &picked)?;

    let now = chrono::Local::now();
    let head = Head {
        id: log::newest_id(now),
        provider: picked.provider.clone(),
        model: picked.model.clone(),
        cwd: here.display().to_string(),
        at: now.timestamp(),
    };
    chat.keeps(Log::start(&agent_dir, &head)?);

    talk(&mut chat, &picked).await
}

pub fn pick(run: &Run, last: Option<&Choice>) -> Result<Choice, String> {
    let provider = run.provider.clone().or_else(|| last.map(|last| last.provider.clone()));
    let Some(provider) = provider else {
        return Err("apex agent needs a provider, try --provider openai --model gpt-5".to_owned());
    };
    let model = run
        .model
        .clone()
        .or_else(|| last.filter(|last| last.provider == provider).map(|last| last.model.clone()));
    match model {
        Some(model) => Ok(Choice { provider, model }),
        None => {
            Err(format!("{provider} needs a model, run apex auth models {provider} to see them"))
        }
    }
}

async fn talk(chat: &mut Chat, picked: &Choice) -> Result<i32> {
    let tty = std::io::stdout().is_terminal();
    let here = std::env::current_dir().context("finding where you are")?;
    println!(
        "{} on {} in {}, {} mode",
        picked.model,
        picked.provider,
        here.display(),
        chat.mode().as_str()
    );
    println!("/help for the few commands there are");

    let mut ink = Ink::new(tty);
    loop {
        let Some(line) = ink.line("› ").await? else {
            break;
        };
        let said = line.trim();
        if said.is_empty() {
            continue;
        }
        if said == "/exit" || said == "/quit" {
            break;
        }
        if said == "/help" {
            print!("{HELP}");
            continue;
        }
        if let Some(asked) = said.strip_prefix("/mode") {
            match Mode::parse(asked) {
                Some(mode) => {
                    chat.works_in(mode);
                    println!("{} mode", mode.as_str());
                }
                None => println!("{} mode, switch with auto, plan or chat", chat.mode().as_str()),
            }
            continue;
        }

        match chat.turn(said, &mut ink).await {
            Ok(()) => ink.ended(chat.spent()),
            Err(cause) => {
                ink.ended(chat.spent());
                eprintln!("apex: {cause:#}");
            }
        }
    }
    Ok(0)
}

struct Ink {
    tty: bool,
    thinking: bool,
    wrote: bool,
    lines: Lines<BufReader<Stdin>>,
}

impl Ink {
    fn new(tty: bool) -> Self {
        Self {
            tty,
            thinking: false,
            wrote: false,
            lines: BufReader::new(tokio::io::stdin()).lines(),
        }
    }

    async fn line(&mut self, prompt: &str) -> Result<Option<String>> {
        self.plain();
        if self.tty {
            print!("\n{prompt}");
            std::io::stdout().flush().ok();
        }
        Ok(self.lines.next_line().await?)
    }

    fn plain(&mut self) {
        if self.thinking {
            print!("{PLAIN}");
            self.thinking = false;
        }
    }

    fn broke(&mut self) {
        self.plain();
        if self.wrote {
            println!();
            self.wrote = false;
        }
    }

    fn ended(&mut self, spent: Spent) {
        self.plain();
        if self.wrote {
            println!();
        }
        if self.tty {
            println!("{DIM}{} tokens so far{PLAIN}", spent.total());
        }
        std::io::stdout().flush().ok();
    }
}

impl Surface for Ink {
    fn running(&mut self, call: &Call) {
        if matches!(call.name.as_str(), "todo" | "ask") {
            return;
        }
        self.broke();
        println!("{DIM}· {} {}{PLAIN}", call.name, sketch(call));
        std::io::stdout().flush().ok();
    }

    fn ran(&mut self, _call: &Call, done: &Done) {
        if done.went_well() {
            return;
        }
        println!("{DIM}  {}{PLAIN}", first_line(done.text()));
        std::io::stdout().flush().ok();
    }

    fn planned(&mut self, items: &[Todo]) {
        self.broke();
        for item in items {
            println!("{DIM}{} {}{PLAIN}", item.status.mark(), item.content);
        }
        std::io::stdout().flush().ok();
    }

    async fn asked(&mut self, question: &str, options: &[String]) -> Option<String> {
        self.broke();
        println!("{question}");
        for (number, option) in options.iter().enumerate() {
            println!("  {}. {option}", number + 1);
        }
        let said = self.line("» ").await.ok().flatten()?;
        let said = said.trim().to_owned();
        Some(chosen(&said, options).unwrap_or(said))
    }

    fn noted(&mut self, text: &str) {
        self.broke();
        println!("{DIM}{text}{PLAIN}");
        std::io::stdout().flush().ok();
    }

    fn said(&mut self, text: &str) {
        self.plain();
        print!("{text}");
        std::io::stdout().flush().ok();
        self.wrote = true;
    }

    fn thought(&mut self, text: &str) {
        if !self.tty {
            return;
        }
        if !self.thinking {
            print!("{DIM}");
            self.thinking = true;
        }
        print!("{text}");
        std::io::stdout().flush().ok();
        self.wrote = true;
    }
}

fn chosen(said: &str, options: &[String]) -> Option<String> {
    let number: usize = said.trim().parse().ok()?;
    options.get(number.checked_sub(1)?).cloned()
}

fn first_line(text: &str) -> &str {
    text.lines().next().unwrap_or_default()
}

#[cfg(test)]
#[path = "agent_tests.rs"]
mod tests;
