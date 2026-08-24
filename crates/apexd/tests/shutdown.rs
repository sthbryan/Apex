use apex_core::ApexPaths;
use apex_proto::{Command, Event, Reply};
use apexd::commands::Dispatch;
use apexd::sessions::SessionManager;
use apexd::state;
use std::sync::Arc;

async fn daemon(home: &tempfile::TempDir) -> Arc<SessionManager> {
    let paths = ApexPaths::rooted_at(home.path());
    state::bootstrap(&paths).await.expect("bootstrap apexd")
}

#[tokio::test]
async fn the_shutdown_command_makes_the_daemon_quit() {
    let home = tempfile::tempdir().expect("temp home");
    let manager = daemon(&home).await;

    let mut quitting = manager.quitting();
    assert!(!*quitting.borrow_and_update());

    let reply = manager.dispatch(Command::DaemonShutdown).await.expect("dispatch shutdown");

    assert!(matches!(reply, Reply::Done));
    assert!(*quitting.borrow_and_update());
}

#[tokio::test]
async fn the_daemon_says_goodbye_before_it_goes() {
    let home = tempfile::tempdir().expect("temp home");
    let manager = daemon(&home).await;
    let mut heard = manager.subscribe();

    manager.quit();

    assert!(matches!(heard.recv().await, Ok(Event::DaemonShutdown)));
}
