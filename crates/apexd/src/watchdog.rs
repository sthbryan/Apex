use std::sync::Arc;
use std::sync::Mutex;
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
    let idle_since = manager.idle_since();
    let mut seen_client = false;

    loop {
        tokio::time::sleep(poll).await;

        let active = clients.load(Ordering::SeqCst);
        if active > 0 {
            seen_client = true;
            mark(&idle_since, None);
            continue;
        }

        if !seen_client {
            continue;
        }

        let seconds = idle_grace.load(Ordering::Relaxed);
        if seconds == u64::from(IDLE_GRACE_NEVER) {
            mark(&idle_since, None);
            continue;
        }

        let grace = Duration::from_secs(seconds);
        match read(&idle_since) {
            None => mark(&idle_since, Some(Instant::now())),
            Some(start) if start.elapsed() >= grace => {
                tracing::info!("no clients for {grace:?}, shutting down");
                manager.quit();
                return;
            }
            Some(_) => {}
        }
    }
}

fn read(slot: &Mutex<Option<Instant>>) -> Option<Instant> {
    slot.lock().ok().and_then(|held| *held)
}

fn mark(slot: &Mutex<Option<Instant>>, at: Option<Instant>) {
    if let Ok(mut held) = slot.lock() {
        *held = at;
    }
}
