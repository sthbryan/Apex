use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

#[derive(Default)]
struct Pane {
    project: Uuid,
    name: Option<String>,
    seen: u64,
}

#[derive(Default)]
pub struct BrowsersService {
    panes: Arc<Mutex<HashMap<String, Pane>>>,
    clock: Arc<Mutex<u64>>,
    waiting: Arc<Mutex<HashMap<Uuid, oneshot::Sender<Result<String, String>>>>>,
}

impl BrowsersService {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn report(&self, project: Uuid, pane: String, name: Option<String>) {
        let seen = {
            let mut clock = self.clock.lock().await;
            *clock += 1;
            *clock
        };
        let mut panes = self.panes.lock().await;
        let held = panes.entry(pane).or_default();
        held.project = project;
        held.name = name;
        held.seen = seen;
    }

    pub async fn forget(&self, pane: &str) {
        self.panes.lock().await.remove(pane);
    }

    pub async fn resolve(&self, project: Uuid, name: Option<&str>) -> Result<String, String> {
        let panes = self.panes.lock().await;
        let mine = panes.iter().filter(|(_, pane)| pane.project == project);
        let wanted: Vec<(&String, &Pane)> = match name {
            Some(name) => mine.filter(|(_, pane)| pane.name.as_deref() == Some(name)).collect(),
            None => mine.collect(),
        };
        if let Some((label, _)) = wanted.iter().max_by_key(|(_, pane)| pane.seen) {
            return Ok((*label).clone());
        }
        let Some(name) = name else {
            return Err("no browser pane is open right now".into());
        };
        let named: Vec<&str> = panes
            .values()
            .filter(|pane| pane.project == project)
            .filter_map(|pane| pane.name.as_deref())
            .collect();
        if named.is_empty() {
            return Err(format!("no browser pane is called {name}"));
        }
        Err(format!("no browser pane is called {name}, only {}", named.join(", ")))
    }

    pub async fn expect(&self, request: Uuid) -> oneshot::Receiver<Result<String, String>> {
        let (sender, receiver) = oneshot::channel();
        self.waiting.lock().await.insert(request, sender);
        receiver
    }

    pub async fn settle(&self, request: Uuid, answer: Result<String, String>) {
        if let Some(sender) = self.waiting.lock().await.remove(&request) {
            let _ = sender.send(answer);
        }
    }

    pub async fn give_up(&self, request: Uuid) {
        self.waiting.lock().await.remove(&request);
    }
}

#[derive(serde::Deserialize)]
pub struct Snapshot {
    pub url: String,
    pub title: Option<String>,
    pub text: Option<String>,
    #[serde(default)]
    pub logs: Vec<Entry>,
}

#[derive(serde::Deserialize)]
pub struct Entry {
    pub level: String,
    pub text: String,
}

pub fn describe_page(taken: &Snapshot) -> String {
    let mut out = taken.url.clone();
    if let Some(title) = &taken.title {
        out.push_str(" - ");
        out.push_str(title);
    }
    if let Some(text) = &taken.text {
        out.push('\n');
        out.push_str(text);
    }
    out
}

pub fn describe_logs(taken: &Snapshot) -> String {
    if taken.logs.is_empty() {
        return format!("{} logged nothing.", taken.url);
    }
    let lines = taken
        .logs
        .iter()
        .map(|entry| format!("[{}] {}", entry.level, entry.text))
        .collect::<Vec<_>>()
        .join("\n");
    format!("{}\n{lines}", taken.url)
}
