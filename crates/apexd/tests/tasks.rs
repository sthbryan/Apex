mod common;

use apex_proto::{Command, Reply, TerminalSize, WorktreeDisposal};
use common::Harness;
use tokio::time::timeout;

#[tokio::test]
async fn a_task_runs_as_a_session_and_will_not_run_twice() {
    let harness = Harness::start().await;
    std::fs::write(
        harness.root.path().join("package.json"),
        r#"{"scripts":{"greet":"echo hola-desde-la-tarea"}}"#,
    )
    .expect("write");
    let mut client = harness.client().await;

    let Reply::Tasks { tasks } =
        client.request(Command::ListTasks { project: harness.project }).await
    else {
        panic!("expected the task list");
    };
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].name, "greet");
    assert_eq!(tasks[0].source, "package.json");

    let session = harness
        .manager
        .run_task(harness.project, "greet", "echo hola-desde-la-tarea", TerminalSize::default())
        .await
        .expect("task");
    assert_eq!(session.task.as_deref(), Some("greet"));
    assert_eq!(session.title, "greet");

    assert!(
        harness
            .manager
            .run_task(harness.project, "greet", "echo otra vez", TerminalSize::default())
            .await
            .is_err(),
        "the same task should not be started twice"
    );

    let printed = timeout(std::time::Duration::from_secs(30), async {
        loop {
            let text =
                harness.manager.transcript(session.id, 4096, false).await.expect("transcript");
            if text.contains("hola-desde-la-tarea") {
                return text;
            }
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        }
    })
    .await;
    assert!(printed.is_ok(), "the task never ran");

    harness.manager.close(session.id, WorktreeDisposal::Keep).await.expect("close");
    harness
        .manager
        .run_task(harness.project, "greet", "echo de nuevo", TerminalSize::default())
        .await
        .expect("a finished task can run again");
}
