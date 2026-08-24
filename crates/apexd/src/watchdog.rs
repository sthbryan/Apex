use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use apex_proto::IDLE_GRACE_NEVER;

use crate::sessions::SessionManager;

pub const IDLE_POLL: Duration = Duration::from_secs(1);

pub async fn watch_for_idle(
    clients: Arc<AtomicUsize>,
    manager: Arc<SessionManager>,
    poll: Duration,
) {
    let idle_grace = manager.idle_grace();
    let mut seen_client = false;
    let mut idle_since: Option<Instant> = None;

    loop {
        tokio::time::sleep(poll).await;

        let active = clients.load(Ordering::SeqCst);
        if active > 0 {
            seen_client = true;
            idle_since = None;
            continue;
        }

        if !seen_client {
            continue;
        }

        let seconds = idle_grace.load(Ordering::Relaxed);
        if seconds == u64::from(IDLE_GRACE_NEVER) {
            idle_since = None;
            continue;
        }

        let grace = Duration::from_secs(seconds);
        match idle_since {
            None => idle_since = Some(Instant::now()),
            Some(start) if start.elapsed() >= grace => {
                tracing::info!("no clients for {grace:?}, shutting down");
                manager.quit();
                return;
            }
            Some(_) => {}
        }
    }
}
