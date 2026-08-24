use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;

use apex_core::ApexPaths;
use apex_proto::IDLE_GRACE_NEVER;
use apexd::sessions::SessionManager;
use apexd::state;
use apexd::watchdog::watch_for_idle;
use tokio::time::timeout;

const POLL: Duration = Duration::from_millis(10);

async fn daemon(home: &tempfile::TempDir) -> Arc<SessionManager> {
    state::bootstrap(&ApexPaths::rooted_at(home.path())).await.expect("bootstrap apexd")
}

#[tokio::test]
async fn it_quits_once_the_last_client_leaves() {
    let home = tempfile::tempdir().expect("temp home");
    let manager = daemon(&home).await;
    manager.set_idle_grace(0);

    let clients = manager.clients();
    clients.store(1, Ordering::SeqCst);
    let mut quitting = manager.quitting();
    tokio::spawn(watch_for_idle(manager.clone(), POLL));

    tokio::time::sleep(POLL * 3).await;
    clients.store(0, Ordering::SeqCst);

    timeout(Duration::from_secs(2), quitting.changed())
        .await
        .expect("the watchdog never fired")
        .expect("the quit channel closed");

    assert!(*quitting.borrow());
}

#[tokio::test]
async fn it_stands_down_when_the_grace_never_ends() {
    let home = tempfile::tempdir().expect("temp home");
    let manager = daemon(&home).await;
    manager.set_idle_grace(IDLE_GRACE_NEVER);

    let clients = manager.clients();
    clients.store(1, Ordering::SeqCst);
    let mut quitting = manager.quitting();
    tokio::spawn(watch_for_idle(manager.clone(), POLL));

    tokio::time::sleep(POLL * 3).await;
    clients.store(0, Ordering::SeqCst);

    let fired = timeout(Duration::from_millis(200), quitting.changed()).await;

    assert!(fired.is_err());
}
