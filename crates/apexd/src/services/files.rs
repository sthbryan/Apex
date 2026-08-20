use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use apex_core::{BinaryResolver, Store, editors, files};
use apex_proto::{EditorSummary, FileContents, FileEntry};
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct FilesService {
    store: Arc<Mutex<Store>>,
    resolver: Arc<Mutex<BinaryResolver>>,
}

impl FilesService {
    pub fn new(store: Arc<Mutex<Store>>, resolver: Arc<Mutex<BinaryResolver>>) -> Self {
        Self { store, resolver }
    }

    pub async fn list_directory(&self, project: Uuid, path: &str) -> Result<Vec<FileEntry>> {
        let root = PathBuf::from(self.project_root(project).await?);
        let path = path.to_owned();
        tokio::task::spawn_blocking(move || files::list_directory(&root, &path)).await?
    }

    pub async fn read_file(&self, project: Uuid, path: &str) -> Result<FileContents> {
        let root = PathBuf::from(self.project_root(project).await?);
        let path = path.to_owned();
        tokio::task::spawn_blocking(move || files::read_file(&root, &path)).await?
    }

    pub async fn write_file(
        &self,
        project: Uuid,
        path: &str,
        text: String,
        revision: Option<String>,
    ) -> Result<String> {
        let root = PathBuf::from(self.project_root(project).await?);
        let path = path.to_owned();
        tokio::task::spawn_blocking(move || {
            files::write_file(&root, &path, &text, revision.as_deref())
        })
        .await?
    }

    pub async fn search_files(
        &self,
        project: Uuid,
        query: &str,
        limit: usize,
    ) -> Result<Vec<FileEntry>> {
        let root = PathBuf::from(self.project_root(project).await?);
        let query = query.to_owned();
        Ok(tokio::task::spawn_blocking(move || files::search_files(&root, &query, limit)).await?)
    }

    pub async fn list_editors(&self) -> Vec<EditorSummary> {
        let home = home_directory();
        let mut resolver = self.resolver.lock().await;
        editors::EDITORS
            .iter()
            .map(|editor| EditorSummary {
                id: editor.id.to_owned(),
                name: editor.name.to_owned(),
                command: editor.command.to_owned(),
                resolved_path: resolver
                    .resolve(editor.command)
                    .or_else(|| editors::bundle(editor, &home))
                    .map(|path| path.display().to_string()),
            })
            .collect()
    }

    pub fn open_url(&self, url: &str) -> Result<()> {
        let parsed = url::Url::parse(url)?;
        if !matches!(parsed.scheme(), "http" | "https") {
            anyhow::bail!("{url} is not a web address");
        }
        std::process::Command::new(editors::system_opener())
            .arg(parsed.as_str())
            .spawn()
            .with_context(|| format!("opening {url}"))?;
        Ok(())
    }

    pub async fn open_externally(
        &self,
        project: Uuid,
        path: &str,
        editor: Option<&str>,
    ) -> Result<()> {
        let root = PathBuf::from(self.project_root(project).await?);
        let target = files::resolve(&root, path)?;

        let launcher = match editor {
            Some(id) => {
                let spec = editors::find(id).context("unknown editor")?;
                let mut resolver = self.resolver.lock().await;
                resolver
                    .resolve(spec.command)
                    .or_else(|| editors::bundle(spec, &home_directory()))
                    .with_context(|| format!("{} is not installed", spec.name))?
            }
            None => PathBuf::from(editors::system_opener()),
        };

        let mut command = if editors::is_bundle(&launcher) {
            let mut open = tokio::process::Command::new(editors::system_opener());
            open.arg("-a").arg(&launcher);
            open
        } else {
            tokio::process::Command::new(&launcher)
        };

        command.arg(&target).spawn().with_context(|| format!("spawning {}", launcher.display()))?;
        Ok(())
    }

    async fn project_root(&self, project: Uuid) -> Result<String> {
        let store = self.store.lock().await;
        Ok(store.project(project)?.with_context(|| format!("unknown project {project}"))?.root)
    }
}

fn home_directory() -> PathBuf {
    directories::UserDirs::new()
        .map(|dirs| dirs.home_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("/"))
}
