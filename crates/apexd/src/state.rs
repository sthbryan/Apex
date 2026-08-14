use std::sync::Arc;

use anyhow::Result;
use apex_core::{ApexPaths, BinaryResolver, ProfileSet, ShellEnvironment, Store};

use crate::sessions::SessionManager;

pub async fn bootstrap(paths: &ApexPaths) -> Result<Arc<SessionManager>> {
    paths.ensure_dirs()?;

    let store = Store::open(&paths.database())?;
    let orphaned = store.close_orphaned_sessions()?;
    tracing::info!(
        database = %paths.database().display(),
        schema = store.schema_version()?,
        projects = store.list_projects()?.len(),
        orphaned,
        "store ready"
    );

    let profiles = ProfileSet::load(&paths.agents_dir())?;
    let environment = ShellEnvironment::probe().await;
    tracing::info!(
        source = ?environment.source(),
        entries = environment.search_path().len(),
        "PATH resolved"
    );

    Ok(Arc::new(SessionManager::new(
        profiles,
        BinaryResolver::with_environment(environment),
        store,
    )))
}
