use std::collections::HashMap;
use std::sync::Arc;

use apex_proto::BrowserLog;
use tokio::sync::Mutex;
use uuid::Uuid;

const KEPT: usize = 200;

#[derive(Default)]
struct Page {
    url: String,
    title: Option<String>,
    text: Option<String>,
    logs: Vec<BrowserLog>,
}

#[derive(Default)]
pub struct BrowsersService {
    pages: Arc<Mutex<HashMap<Uuid, Page>>>,
}

impl BrowsersService {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn report(
        &self,
        project: Uuid,
        url: String,
        title: Option<String>,
        text: Option<String>,
        logs: Vec<BrowserLog>,
    ) {
        let mut pages = self.pages.lock().await;
        let page = pages.entry(project).or_default();
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

    pub async fn forget(&self, project: Uuid) {
        self.pages.lock().await.remove(&project);
    }

    pub async fn read(&self, project: Uuid) -> String {
        let pages = self.pages.lock().await;
        let Some(page) = pages.get(&project) else {
            return String::new();
        };
        let mut out = format!("{}\n", page.url);
        if let Some(title) = &page.title {
            out.push_str(title);
            out.push('\n');
        }
        if let Some(text) = &page.text {
            out.push('\n');
            out.push_str(text);
        }
        out
    }

    pub async fn logs(&self, project: Uuid) -> String {
        let pages = self.pages.lock().await;
        let Some(page) = pages.get(&project) else {
            return String::new();
        };
        page.logs
            .iter()
            .map(|entry| format!("[{}] {}", entry.level, entry.text))
            .collect::<Vec<_>>()
            .join("\n")
    }
}
