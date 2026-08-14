use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Result, bail};
use apex_core::Store;
use apex_proto::ProjectSummary;
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct ProjectsService {
    store: Arc<Mutex<Store>>,
}

impl ProjectsService {
    pub fn new(store: Arc<Mutex<Store>>) -> Self {
        Self { store }
    }

    pub async fn list(&self) -> Result<Vec<ProjectSummary>> {
        let store = self.store.lock().await;
        Ok(store
            .list_projects()?
            .into_iter()
            .map(|project| ProjectSummary {
                id: project.id,
                name: project.name,
                root: project.root,
                is_git: project.is_git,
            })
            .collect())
    }

    pub async fn open(&self, root: &str) -> Result<ProjectSummary> {
        let path = PathBuf::from(root);
        if !path.is_dir() {
            bail!("{root} is not a folder")
        }
        let canonical = path.canonicalize().unwrap_or(path);

        let store = self.store.lock().await;
        let project = store.open_project(&canonical)?;
        Ok(ProjectSummary {
            id: project.id,
            name: project.name,
            root: project.root,
            is_git: project.is_git,
        })
    }

    pub async fn save_layout(&self, project: Uuid, payload: &str) -> Result<()> {
        self.store.lock().await.save_layout(project, payload)
    }

    pub async fn load_layout(&self, project: Uuid) -> Result<Option<String>> {
        self.store.lock().await.load_layout(project)
    }
}
