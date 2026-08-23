use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

#[derive(Default)]
struct Pane {
    project: Uuid,
    url: String,
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

    pub async fn report(&self, project: Uuid, pane: String, url: String, name: Option<String>) {
        let seen = {
            let mut clock = self.clock.lock().await;
            *clock += 1;
            *clock
        };
        let mut panes = self.panes.lock().await;
        let held = panes.entry(pane).or_default();
        held.project = project;
        held.url = url;
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
            Some(name) => mine.filter(|(_, pane)| answers_to(pane, name)).collect(),
            None => mine.collect(),
        };
        if let Some((label, _)) = wanted.iter().max_by_key(|(_, pane)| pane.seen) {
            return Ok((*label).clone());
        }
        let Some(name) = name else {
            return Err("no browser pane is open right now".into());
        };
        let known: Vec<String> = panes
            .values()
            .filter(|pane| pane.project == project)
            .map(|pane| pane.name.clone().unwrap_or_else(|| pane.url.clone()))
            .collect();
        if known.is_empty() {
            return Err(format!("no browser pane is called {name}"));
        }
        Err(format!("no browser pane is called {name}, only {}", known.join(", ")))
    }

    pub async fn describe(&self, project: Uuid) -> Option<String> {
        let panes = self.panes.lock().await;
        let mut mine: Vec<&Pane> = panes.values().filter(|pane| pane.project == project).collect();
        if mine.len() < 2 {
            return None;
        }
        mine.sort_by_key(|pane| std::cmp::Reverse(pane.seen));
        let lines = mine
            .iter()
            .enumerate()
            .map(|(index, pane)| {
                let name = pane.name.as_deref().unwrap_or("no name");
                let mark = if index == 0 { ", in use" } else { "" };
                format!("- {} ({name}{mark})", pane.url)
            })
            .collect::<Vec<_>>()
            .join("\n");
        Some(format!("This project has {} browser panes:\n{lines}", mine.len()))
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

fn answers_to(pane: &Pane, name: &str) -> bool {
    pane.name.as_deref() == Some(name)
        || pane.url.trim_end_matches('/') == name.trim_end_matches('/')
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

#[cfg(test)]
mod tests {
    use super::*;

    async fn panes() -> (BrowsersService, Uuid) {
        let browsers = BrowsersService::new();
        let project = Uuid::new_v4();
        browsers
            .report(
                project,
                "browser-1".into(),
                "http://localhost:6006".into(),
                Some("book".into()),
            )
            .await;
        browsers.report(project, "browser-2".into(), "http://localhost:5173".into(), None).await;
        (browsers, project)
    }

    #[tokio::test]
    async fn a_pane_answers_to_its_name_or_its_address() {
        let (browsers, project) = panes().await;
        assert_eq!(browsers.resolve(project, Some("book")).await, Ok("browser-1".into()));
        assert_eq!(
            browsers.resolve(project, Some("http://localhost:5173/")).await,
            Ok("browser-2".into())
        );
        assert_eq!(browsers.resolve(project, None).await, Ok("browser-2".into()));
    }

    #[tokio::test]
    async fn asking_for_a_stranger_says_what_is_open() {
        let (browsers, project) = panes().await;
        let complaint = browsers.resolve(project, Some("mailpit")).await.expect_err("no pane");
        assert!(complaint.contains("book"));
        assert!(complaint.contains("http://localhost:5173"));
    }

    #[tokio::test]
    async fn a_lone_pane_is_not_worth_describing() {
        let (browsers, project) = panes().await;
        let listing = browsers.describe(project).await.expect("two panes");
        assert!(listing.contains("in use"));

        browsers.forget("browser-1").await;
        assert!(browsers.describe(project).await.is_none());
    }
}
