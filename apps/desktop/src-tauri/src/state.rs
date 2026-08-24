use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use crate::client::DaemonClient;

pub struct AppState {
    pub daemon: std::sync::Mutex<Option<Arc<DaemonClient>>>,
    pub socket: PathBuf,
    pub keep_alive: AtomicBool,
}

impl AppState {
    pub fn daemon(&self) -> Answer<Arc<DaemonClient>> {
        self.daemon
            .lock()
            .map_err(|_| "the daemon handle is poisoned".to_owned())?
            .clone()
            .ok_or_else(|| "apexd is not connected".to_owned())
    }

    pub async fn connect(&self) -> Answer<Arc<DaemonClient>> {
        if let Ok(existing) = self.daemon() {
            return Ok(existing);
        }
        let client = DaemonClient::attach(&self.socket).await.map_err(failed)?;
        if let Ok(mut slot) = self.daemon.lock() {
            *slot = Some(Arc::clone(&client));
        }
        Ok(client)
    }
}

pub type Answer<T> = Result<T, String>;

pub fn failed(error: anyhow::Error) -> String {
    format!("{error:#}")
}
