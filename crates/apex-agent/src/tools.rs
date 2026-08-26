pub mod ask;
mod bash;
mod edit;
mod fetch;
mod find;
mod read;
mod search;
pub mod todo;
mod write;

use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use anyhow::{Result, anyhow, bail};

use crate::mcp::Servers;
use crate::mode::Mode;
use rig_core::completion::ToolDefinition;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Call {
    pub id: String,
    pub name: String,
    pub args: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Done {
    Said(String),
    Failed(String),
}

impl Done {
    pub fn text(&self) -> &str {
        match self {
            Self::Said(text) | Self::Failed(text) => text,
        }
    }

    pub fn went_well(&self) -> bool {
        matches!(self, Self::Said(_))
    }
}

pub struct Kit {
    root: PathBuf,
    seen: Mutex<HashSet<PathBuf>>,
    todo: Mutex<Vec<todo::Todo>>,
    mode: Mutex<Mode>,
    servers: Servers,
}

impl Kit {
    pub fn new(root: impl AsRef<Path>) -> Self {
        let root = root.as_ref();
        Self {
            root: root.canonicalize().unwrap_or_else(|_| root.to_path_buf()),
            seen: Mutex::default(),
            todo: Mutex::default(),
            mode: Mutex::default(),
            servers: Servers::default(),
        }
    }

    pub fn saw(&self, path: &Path) {
        if let Ok(mut seen) = self.seen.lock() {
            seen.insert(path.to_path_buf());
        }
    }

    pub fn has_seen(&self, path: &Path) -> bool {
        self.seen.lock().is_ok_and(|seen| seen.contains(path))
    }

    pub fn plans(&self, items: Vec<todo::Todo>) {
        if let Ok(mut held) = self.todo.lock() {
            *held = items;
        }
    }

    pub fn todo(&self) -> Vec<todo::Todo> {
        self.todo.lock().map(|held| held.clone()).unwrap_or_default()
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn plugs(&mut self, servers: Servers) {
        self.servers = servers;
    }

    pub fn works_in(&self, mode: Mode) {
        if let Ok(mut held) = self.mode.lock() {
            *held = mode;
        }
    }

    pub fn mode(&self) -> Mode {
        self.mode.lock().map(|held| *held).unwrap_or_default()
    }

    pub fn offered(&self) -> Vec<ToolDefinition> {
        let mode = self.mode();
        let every = vec![
            read::offered(),
            search::offered(),
            find::offered(),
            write::offered(),
            edit::offered(),
            bash::offered(),
            fetch::offered(),
            todo::offered(),
            ask::offered(),
        ];
        let mut offered: Vec<ToolDefinition> =
            every.into_iter().filter(|tool| mode.allows(&tool.name)).collect();
        if mode == Mode::Auto {
            offered.extend(self.servers.offered());
        }
        offered
    }

    pub async fn run(&self, call: &Call) -> Done {
        let mode = self.mode();
        if self.servers.holds(&call.name) {
            if mode != Mode::Auto {
                return Done::Failed(format!(
                    "{} comes from a plugged in server and only runs in auto mode",
                    call.name
                ));
            }
            return match self.servers.run(&call.name, &call.args).await {
                Ok(said) => Done::Said(said),
                Err(cause) => Done::Failed(format!("{cause:#}")),
            };
        }
        if !mode.allows(&call.name) {
            return Done::Failed(format!("{} is not open in {} mode", call.name, mode.as_str()));
        }
        let done = match call.name.as_str() {
            "read" => read::run(self, &call.args).await,
            "search" => search::run(&self.root, &call.args).await,
            "find" => find::run(&self.root, &call.args).await,
            "write" => write::run(self, &call.args).await,
            "edit" => edit::run(self, &call.args).await,
            "bash" => bash::run(self, &call.args).await,
            "fetch" => fetch::run(&call.args).await,
            "todo" => todo::run(self, &call.args).await,
            "ask" => Err(anyhow!("ask is answered by the person, not by the kit")),
            other => Err(anyhow!("there is no tool called {other}")),
        };
        match done {
            Ok(said) => Done::Said(said),
            Err(cause) => Done::Failed(format!("{cause:#}")),
        }
    }
}

pub fn within(root: &Path, path: &str) -> Result<PathBuf> {
    if path.trim().is_empty() {
        bail!("that needs a path")
    }
    let asked = Path::new(path.trim());
    let joined = match asked.is_absolute() {
        true => asked.to_path_buf(),
        false => root.join(asked),
    };
    let tidied = tidy(&joined);
    let real = tidied.canonicalize().unwrap_or_else(|_| tidied.clone());
    if !real.starts_with(root) {
        bail!("{path} is outside this project")
    }
    Ok(real)
}

pub const OURS: &[&str] =
    &["read", "search", "find", "write", "edit", "bash", "fetch", "todo", "ask"];

pub fn our_names() -> Vec<String> {
    OURS.iter().map(|name| (*name).to_owned()).collect()
}

pub fn sketch(call: &Call) -> String {
    let key = match call.name.as_str() {
        "read" | "write" | "edit" => "path",
        "bash" => "command",
        "fetch" => "url",
        "ask" => "question",
        "search" => "pattern",
        "find" => "glob",
        _ => "",
    };
    let told = call.args.get(key).and_then(Value::as_str).unwrap_or_default();
    match told.is_empty() {
        true => call
            .args
            .as_object()
            .into_iter()
            .flatten()
            .find_map(|(_, value)| value.as_str())
            .map(clipped)
            .unwrap_or_default(),
        false => clipped(told),
    }
}

fn clipped(text: &str) -> String {
    const MOST: usize = 60;
    let one = text.lines().next().unwrap_or_default().trim();
    match one.chars().count() > MOST {
        true => format!("{}…", one.chars().take(MOST).collect::<String>()),
        false => one.to_owned(),
    }
}

pub fn shown(root: &Path, path: &Path) -> String {
    path.strip_prefix(root).unwrap_or(path).display().to_string()
}

fn tidy(path: &Path) -> PathBuf {
    let mut tidied = PathBuf::new();
    for part in path.components() {
        match part {
            Component::ParentDir => {
                tidied.pop();
            }
            Component::CurDir => {}
            other => tidied.push(other),
        }
    }
    tidied
}

fn asked<T: serde::de::DeserializeOwned>(args: &Value) -> Result<T> {
    serde_json::from_value(args.clone()).map_err(|cause| anyhow!("bad arguments: {cause}"))
}

#[cfg(test)]
#[path = "tools_tests.rs"]
mod tests;
