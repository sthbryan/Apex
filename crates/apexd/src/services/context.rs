use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context as _, Result};
use apex_core::{Store, context};
use apex_proto::ContextEntry;
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct ContextService {
    store: Arc<Mutex<Store>>,
}

impl ContextService {
    pub fn new(store: Arc<Mutex<Store>>) -> Self {
        Self { store }
    }

    pub async fn list(&self, project: Uuid) -> Result<Vec<ContextEntry>> {
        let root = self.project_root(project).await?;
        let entries = tokio::task::spawn_blocking(move || context::list(&root)).await??;
        Ok(entries
            .into_iter()
            .map(|entry| ContextEntry {
                key: entry.key,
                bytes: entry.bytes,
                updated_at: entry.updated_at,
            })
            .collect())
    }

    pub async fn read(&self, project: Uuid, key: &str) -> Result<String> {
        let root = self.project_root(project).await?;
        let key = key.to_owned();
        tokio::task::spawn_blocking(move || context::read(&root, &key)).await?
    }

    pub async fn write(&self, project: Uuid, key: &str, contents: &str) -> Result<()> {
        let root = self.project_root(project).await?;
        let key = key.to_owned();
        let contents = contents.to_owned();
        tokio::task::spawn_blocking(move || context::write(&root, &key, &contents)).await?
    }

    pub async fn note(
        &self,
        project: Uuid,
        from: &str,
        to: Option<&str>,
        message: &str,
    ) -> Result<()> {
        let root = self.project_root(project).await?;
        let from = from.to_owned();
        let to = to.map(str::to_owned);
        let message = message.to_owned();
        tokio::task::spawn_blocking(move || {
            context::append_note(&root, &from, to.as_deref(), &message)
        })
        .await?
    }

    async fn project_root(&self, project: Uuid) -> Result<PathBuf> {
        let store = self.store.lock().await;
        Ok(PathBuf::from(
            store
                .project(project)?
                .with_context(|| format!("unknown project {project}"))?
                .root,
        ))
    }
}
