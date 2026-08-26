use std::sync::Arc;

use anyhow::Result;
use apex_core::{ApexPaths, BinaryResolver, ProfileSet, ShellEnvironment, Store};

use crate::sessions::SessionManager;

pub const OURSELVES: &str = "apexd";

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

    let swept = paths.clone();
    tokio::task::spawn_blocking(move || apex_core::sweep(&swept));

    let profiles = ProfileSet::load(&paths.agents_dir())?;
    let environment = ShellEnvironment::probe().await;
    tracing::info!(
        source = ?environment.source(),
        entries = environment.search_path().len(),
        "PATH resolved"
    );

    let mut resolver = BinaryResolver::with_environment(environment);
    if let Ok(ourselves) = std::env::current_exe() {
        resolver.knows(OURSELVES, ourselves);
    }

    let manager = SessionManager::new(paths.clone(), profiles, resolver, store);
    let housekeeping = Arc::clone(&manager);
    tokio::spawn(async move { housekeeping.sweep_rejects().await });
    Ok(manager)
}
