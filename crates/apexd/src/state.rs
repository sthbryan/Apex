use std::sync::Arc;

use anyhow::Result;
use apex_core::{ApexPaths, BinaryResolver, ProfileSet, ShellEnvironment, Store};
use apex_proto::AgentSummary;
use tokio::sync::Mutex;

pub struct Daemon {
    profiles: ProfileSet,
    resolver: Mutex<BinaryResolver>,
}

impl Daemon {
    pub async fn bootstrap(paths: &ApexPaths) -> Result<Arc<Self>> {
        paths.ensure_dirs()?;

        let store = Store::open(&paths.database())?;
        tracing::info!(
            database = %paths.database().display(),
            schema = store.schema_version()?,
            "store listo"
        );
        drop(store);

        let profiles = ProfileSet::load(&paths.agents_dir())?;
        let environment = ShellEnvironment::probe().await;
        tracing::info!(
            source = ?environment.source(),
            entries = environment.search_path().len(),
            "PATH resuelto"
        );

        Ok(Arc::new(Self {
            profiles,
            resolver: Mutex::new(BinaryResolver::with_environment(environment)),
        }))
    }

    pub async fn list_agents(&self) -> Vec<AgentSummary> {
        let mut resolver = self.resolver.lock().await;
        self.profiles.summarize(&mut resolver)
    }
}
