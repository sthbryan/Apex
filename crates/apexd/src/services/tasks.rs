use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context as _, Result};
use apex_core::Store;
use apex_proto::TaskSummary;
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct TasksService {
    store: Arc<Mutex<Store>>,
}

impl TasksService {
    pub fn new(store: Arc<Mutex<Store>>) -> Self {
        Self { store }
    }

    pub async fn list(&self, project: Uuid) -> Result<Vec<TaskSummary>> {
        let root = self.project_root(project).await?;
        let found = tokio::task::spawn_blocking(move || apex_tasks::discover(&root)).await?;
        Ok(found
            .into_iter()
            .map(|task| TaskSummary {
                name: task.name,
                command: task.command,
                source: task.source.as_str().to_owned(),
            })
            .collect())
    }

    async fn project_root(&self, project: Uuid) -> Result<PathBuf> {
        let store = self.store.lock().await;
        Ok(PathBuf::from(
            store.project(project)?.with_context(|| format!("unknown project {project}"))?.root,
        ))
    }
}
