use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

#[derive(Default)]
struct Pane {
    project: Uuid,
    url: String,
    seen: u64,
}

type Waiting = Arc<Mutex<HashMap<Uuid, oneshot::Sender<Result<String, String>>>>>;

#[derive(Default)]
pub struct BrowsersService {
    panes: Arc<Mutex<HashMap<String, Pane>>>,
    clock: Arc<Mutex<u64>>,
    waiting: Waiting,
}

impl BrowsersService {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn report(&self, project: Uuid, pane: String, url: String) {
        let seen = {
            let mut clock = self.clock.lock().await;
            *clock += 1;
            *clock
        };
        let mut panes = self.panes.lock().await;
        let held = panes.entry(pane).or_default();
        held.project = project;
        held.url = url;
        held.seen = seen;
    }

    pub async fn forget(&self, pane: &str) {
        self.panes.lock().await.remove(pane);
    }

    pub async fn showing(&self, project: Uuid) -> Result<(), String> {
        let panes = self.panes.lock().await;
        if panes.values().any(|pane| pane.project == project) {
            return Ok(());
        }
        Err("no browser is open right now".into())
    }

    pub async fn page(&self, project: Uuid) -> String {
        let panes = self.panes.lock().await;
        match panes.values().filter(|pane| pane.project == project).max_by_key(|pane| pane.seen) {
            Some(pane) => format!("The browser is showing {}.", pane.url),
            None => "No browser is open on this project.".into(),
        }
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
    #[serde(default)]
    pub logs: Vec<Entry>,
}

#[derive(serde::Deserialize)]
pub struct Entry {
    pub level: String,
    pub text: String,
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

    async fn showing() -> (BrowsersService, Uuid) {
        let browsers = BrowsersService::new();
        let project = Uuid::new_v4();
        browsers.report(project, "browser".into(), "http://localhost:6006".into()).await;
        (browsers, project)
    }

    #[tokio::test]
    async fn the_page_is_the_address_the_browser_holds() {
        let (browsers, project) = showing().await;
        assert!(browsers.page(project).await.contains("http://localhost:6006"));

        browsers.report(project, "browser".into(), "http://localhost:5173".into()).await;
        let page = browsers.page(project).await;
        assert!(page.contains("http://localhost:5173"));
        assert!(!page.contains("6006"));
    }

    #[tokio::test]
    async fn a_shut_browser_has_no_page_and_answers_nothing() {
        let (browsers, project) = showing().await;
        assert_eq!(browsers.showing(project).await, Ok(()));

        browsers.forget("browser").await;
        assert_eq!(browsers.page(project).await, "No browser is open on this project.");
        assert!(browsers.showing(project).await.is_err());
    }

    #[tokio::test]
    async fn a_remount_that_beats_its_own_cleanup_still_reads_the_new_page() {
        let (browsers, project) = showing().await;
        browsers.report(project, "browser-2".into(), "http://localhost:5173".into()).await;
        assert!(browsers.page(project).await.contains("http://localhost:5173"));

        browsers.forget("browser").await;
        assert!(browsers.page(project).await.contains("http://localhost:5173"));
    }

    #[tokio::test]
    async fn another_project_browser_is_not_mine() {
        let (browsers, project) = showing().await;
        let other = Uuid::new_v4();
        assert!(browsers.showing(other).await.is_err());
        assert_eq!(browsers.page(other).await, "No browser is open on this project.");
        assert_eq!(browsers.showing(project).await, Ok(()));
    }
}
