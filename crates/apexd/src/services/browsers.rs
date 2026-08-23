use std::collections::HashMap;
use std::sync::Arc;

use apex_proto::BrowserLog;
use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

const KEPT: usize = 200;

#[derive(Default)]
struct Page {
    project: Uuid,
    url: String,
    title: Option<String>,
    text: Option<String>,
    logs: Vec<BrowserLog>,
    seen: u64,
}

#[derive(Default)]
pub struct BrowsersService {
    panes: Arc<Mutex<HashMap<String, Page>>>,
    clock: Arc<Mutex<u64>>,
    waiting: Arc<Mutex<HashMap<Uuid, oneshot::Sender<Result<String, String>>>>>,
}

impl BrowsersService {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn report(
        &self,
        project: Uuid,
        pane: String,
        url: String,
        title: Option<String>,
        text: Option<String>,
        logs: Vec<BrowserLog>,
    ) {
        let seen = {
            let mut clock = self.clock.lock().await;
            *clock += 1;
            *clock
        };
        let mut panes = self.panes.lock().await;
        let page = panes.entry(pane).or_default();
        page.project = project;
        page.seen = seen;
        if page.url != url {
            page.url = url;
            page.logs.clear();
        }
        if title.is_some() {
            page.title = title;
        }
        if text.is_some() {
            page.text = text;
        }
        page.logs.extend(logs);
        if page.logs.len() > KEPT {
            page.logs.drain(..page.logs.len() - KEPT);
        }
    }

    pub async fn forget(&self, pane: &str) {
        self.panes.lock().await.remove(pane);
    }

    pub async fn read(&self, project: Uuid) -> String {
        self.describe(project, |page| {
            let mut out = page.url.clone();
            if let Some(title) = &page.title {
                out.push_str(" — ");
                out.push_str(title);
            }
            if let Some(text) = &page.text {
                out.push('\n');
                out.push_str(text);
            }
            out
        })
        .await
    }

    pub async fn logs(&self, project: Uuid) -> String {
        self.describe(project, |page| {
            let lines = page
                .logs
                .iter()
                .map(|entry| format!("[{}] {}", entry.level, entry.text))
                .collect::<Vec<_>>()
                .join("\n");
            if lines.is_empty() {
                format!("{} logged nothing.", page.url)
            } else {
                format!("{}\n{lines}", page.url)
            }
        })
        .await
    }

    pub async fn latest(&self, project: Uuid) -> Option<String> {
        let panes = self.panes.lock().await;
        panes
            .iter()
            .filter(|(_, page)| page.project == project)
            .max_by_key(|(_, page)| page.seen)
            .map(|(pane, _)| pane.clone())
    }

    pub async fn expect_shot(&self, request: Uuid) -> oneshot::Receiver<Result<String, String>> {
        let (sender, receiver) = oneshot::channel();
        self.waiting.lock().await.insert(request, sender);
        receiver
    }

    pub async fn settle_shot(&self, request: Uuid, answer: Result<String, String>) {
        if let Some(sender) = self.waiting.lock().await.remove(&request) {
            let _ = sender.send(answer);
        }
    }

    pub async fn drop_shot(&self, request: Uuid) {
        self.waiting.lock().await.remove(&request);
    }

    async fn describe(&self, project: Uuid, shape: impl Fn(&Page) -> String) -> String {
        let panes = self.panes.lock().await;
        let mut mine: Vec<&Page> = panes.values().filter(|page| page.project == project).collect();
        mine.sort_by_key(|page| std::cmp::Reverse(page.seen));
        mine.iter().map(|page| shape(page)).collect::<Vec<_>>().join("\n\n")
    }
}
