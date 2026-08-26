use std::io::{IsTerminal, Write};

use anyhow::{Context, Result};
use apex_agent::chat::{Chat, Spent, Surface};
use apex_agent::choice::{self, Choice};
use apex_agent::log::{self, Head, Kept, Log};
use apex_agent::mode::Mode;
use apex_agent::settings::{self, Settings};
use apex_agent::tools::todo::Todo;
use apex_agent::tools::{Call, Done, Kit, sketch};
use apex_agent::{ProviderSet, key, model, preamble, window};
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
    let here = std::env::current_dir().context("finding where you are")?;

    if run.list {
        let kept = log::list(&agent_dir);
        match kept.is_empty() {
            true => println!("no conversations yet"),
            false => print!("{}", spell_sessions(&kept, &here)),
        }
        return Ok(0);
    }

    let picked_up = match &run.resume {
        Some(which) => {
            let kept = log::list(&agent_dir);
            let Some(found) = wanted(&kept, which.as_deref(), &here) else {
                match which {
                    Some(id) => eprintln!("apex: there is no conversation called {id}"),
                    None => eprintln!("apex: nothing was said in this folder yet"),
                }
                eprintln!("apex: run apex agent --list to see them");
                return Ok(2);
            };
            Some(log::open(&agent_dir, &found.head.id)?)
        }
        None => None,
    };

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

    let before = match &picked_up {
        Some((head, _)) => {
            Some(Choice { provider: head.provider.clone(), model: head.model.clone() })
        }
        None => choice::read(&agent_dir),
    };

    let picked = match pick(&run, before.as_ref()) {
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

    let wire = provider.dial(&key)?;
    let kept = settings::read(&agent_dir);
    let window = match kept.window_for(&picked.model).or_else(|| window::guess(&picked.model)) {
        Some(window) => Some(window),
        None => listed_window(&wire, &picked.model).await,
    };
    let brain = wire.brain(&picked.model);
    let mut chat = Chat::new(brain, Kit::new(&here), preamble::read(&agent_dir));
    chat.works_in(mode);
    chat.holds(window);
    choice::write(&agent_dir, &picked)?;

    let carried = match picked_up {
        Some((head, messages)) => {
            let turns = messages.len();
            chat.picks_up(messages);
            chat.keeps(Log::reopen(&agent_dir, &head.id));
            Some(turns)
        }
        None => {
            let now = chrono::Local::now();
            let head = Head {
                id: log::newest_id(now),
                provider: picked.provider.clone(),
                model: picked.model.clone(),
                cwd: here.display().to_string(),
                at: now.timestamp(),
            };
            chat.keeps(Log::start(&agent_dir, &head)?);
            None
        }
    };

    talk(&mut chat, &picked, &here, carried, &kept).await
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

async fn listed_window(wire: &apex_agent::Wire, model: &str) -> Option<u32> {
    let listed = model::list(wire).await.ok()?;
    listed.into_iter().find(|one| one.id == model)?.context
}

async fn talk(
    chat: &mut Chat,
    picked: &Choice,
    here: &std::path::Path,
    carried: Option<usize>,
    kept: &Settings,
) -> Result<i32> {
    let tty = std::io::stdout().is_terminal();
    println!(
        "{} on {} in {}, {} mode",
        picked.model,
        picked.provider,
        here.display(),
        chat.mode().as_str()
    );
    if let Some(turns) = carried {
        println!("picked up where it was left, {} back", spell_messages(turns));
    }
    println!("/help for the few commands there are");

    let mut ink = Ink::new(tty);
    let mut warned = false;
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
            Ok(()) => ink.ended(chat.spent(), chat.how_full()),
            Err(cause) => {
                ink.ended(chat.spent(), chat.how_full());
                eprintln!("apex: {cause:#}");
            }
        }

        let full = chat.how_full();
        let over = crowded(full, kept.warns_at());
        if over && !warned {
            println!("the window is {}% full, /compact when you want room", full.unwrap_or(0));
        }
        warned = over;
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

    fn ended(&mut self, spent: Spent, full: Option<u8>) {
        self.plain();
        if self.wrote {
            println!();
        }
        if self.tty {
            println!("{DIM}{}{PLAIN}", spell_spent(spent, full));
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

pub fn wanted<'a>(
    kept: &'a [Kept],
    which: Option<&str>,
    here: &std::path::Path,
) -> Option<&'a Kept> {
    match which {
        Some(id) => kept.iter().find(|one| one.head.id == id),
        None => kept.iter().find(|one| one.head.cwd == here.display().to_string()),
    }
}

pub fn spell_sessions(kept: &[Kept], here: &std::path::Path) -> String {
    let widest = kept.iter().map(|one| one.head.id.len()).max().unwrap_or(0);
    let mut lines = String::new();
    for one in kept {
        let elsewhere = match one.head.cwd == here.display().to_string() {
            true => String::new(),
            false => format!("  ({})", one.head.cwd),
        };
        lines.push_str(&format!(
            "{:widest$}  {:>8}  {}{elsewhere}\n",
            one.head.id,
            spell_turns(one.turns),
            one.title
        ));
    }
    lines
}

pub fn spell_spent(spent: Spent, full: Option<u8>) -> String {
    match full {
        Some(full) => format!("{} tokens so far, window {full}% full", spent.total()),
        None => format!("{} tokens so far", spent.total()),
    }
}

pub fn crowded(full: Option<u8>, warn_at: Option<u8>) -> bool {
    match (full, warn_at) {
        (Some(full), Some(at)) => full >= at,
        _ => false,
    }
}

fn spell_messages(messages: usize) -> String {
    match messages {
        1 => "1 message".to_owned(),
        many => format!("{many} messages"),
    }
}

fn spell_turns(turns: usize) -> String {
    match turns {
        1 => "1 turn".to_owned(),
        many => format!("{many} turns"),
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
