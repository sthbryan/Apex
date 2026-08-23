mod common;

use apex_proto::{Isolation, TerminalSize};
use apexd::sessions::NewSession;
use common::Harness;
use tokio::time::timeout;

#[tokio::test]
async fn spawning_asks_the_ui_to_open_the_child() {
    let harness = Harness::start().await;
    let mut events = harness.manager.subscribe();
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let child =
        harness.manager.spawn(parent.id, "sh", None, Isolation::Directory).await.expect("child");

    let asked = timeout(std::time::Duration::from_secs(5), async {
        loop {
            if let Ok(apex_proto::Event::OpenView { target, asked_by }) = events.recv().await {
                return (target, asked_by);
            }
        }
    })
    .await
    .expect("the ui was never asked");

    assert_eq!(asked.1, parent.id);
    assert_eq!(asked.0, apex_proto::ViewTarget::Session { id: child.id });
}

#[tokio::test]
async fn an_agent_cannot_ask_to_open_a_session_that_is_gone() {
    let harness = Harness::start().await;
    let asking = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("session");

    let refused = harness
        .manager
        .open_view(asking.id, apex_proto::ViewTarget::Session { id: uuid::Uuid::new_v4() })
        .await
        .expect_err("a ghost session got opened");
    assert!(format!("{refused:#}").contains("does not exist"));
}

#[tokio::test]
async fn a_broadcast_starts_one_session_per_agent() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let started = harness
        .manager
        .broadcast(
            parent.id,
            vec!["sh".into(), "sh".into()],
            "look at the readme".into(),
            Isolation::Directory,
        )
        .await
        .expect("broadcast");

    assert_eq!(started.len(), 2);
    assert!(started.iter().all(|session| session.parent == Some(parent.id)));
    assert_ne!(started[0].id, started[1].id);
}

#[tokio::test]
async fn a_broadcast_that_names_nobody_is_refused() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let refused = harness
        .manager
        .broadcast(parent.id, Vec::new(), "do it".into(), Isolation::Directory)
        .await
        .expect_err("an empty broadcast got through");
    assert!(format!("{refused:#}").contains("at least one agent"));
}

#[tokio::test]
async fn spawning_an_unknown_agent_names_the_ones_that_exist() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let refused = harness
        .manager
        .spawn(parent.id, "general", None, Isolation::Directory)
        .await
        .expect_err("an unknown agent got through");
    let said = format!("{refused:#}");
    assert!(said.contains("no agent called general"), "{said}");
    assert!(said.contains("sh"), "it never said what is available: {said}");
}

#[tokio::test]
async fn a_plain_terminal_does_not_take_a_spawned_task() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let refused = harness
        .manager
        .spawn(parent.id, "shell", Some("echo hi".into()), Isolation::Directory)
        .await
        .expect_err("a terminal took a task");
    assert!(format!("{refused:#}").contains("plain terminal"), "{refused:#}");
}

#[tokio::test]
async fn an_agent_only_closes_the_sessions_it_started() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let child =
        harness.manager.spawn(parent.id, "sh", None, Isolation::Directory).await.expect("child");

    let refused = harness
        .manager
        .dismiss(parent.id, parent.id)
        .await
        .expect_err("it closed a session it never started");
    assert!(format!("{refused:#}").contains("only close the sessions you started"));

    harness.manager.dismiss(parent.id, child.id).await.expect("its own child");
    assert!(!harness.manager.list_sessions().await.iter().any(|s| s.id == child.id));
}

#[tokio::test]
async fn a_task_handed_to_a_terminal_agent_is_actually_submitted() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let child = harness
        .manager
        .spawn(parent.id, "sh", Some("echo apex-ran-the-task".into()), Isolation::Directory)
        .await
        .expect("child");

    let ran = timeout(std::time::Duration::from_secs(30), async {
        loop {
            let seen = harness.manager.transcript(child.id, 8192, true).await.expect("transcript");
            if seen.matches("apex-ran-the-task").count() > 1 {
                return seen;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
    })
    .await;

    assert!(ran.is_ok(), "the task was typed but never submitted");
}

#[tokio::test]
async fn a_child_calls_itself_done_without_dying() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let child =
        harness.manager.spawn(parent.id, "sh", None, Isolation::Directory).await.expect("child");

    harness
        .manager
        .call_it_done(child.id, Some("read the readme, nothing to change".into()))
        .await
        .expect("done");

    let still = harness
        .manager
        .list_sessions()
        .await
        .into_iter()
        .find(|session| session.id == child.id)
        .expect("it killed itself instead of standing down");
    assert_eq!(still.state, apex_proto::SessionState::Done);
    assert!(still.is_alive(), "the process should still be readable");

    let notes = harness.manager.context_read(harness.project, "notes").await.expect("notes");
    assert!(notes.contains("read the readme"), "the summary never reached the parent: {notes}");
}

#[tokio::test]
async fn only_a_spawned_session_can_call_itself_done() {
    let harness = Harness::start().await;
    let alone = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("session");

    let refused = harness
        .manager
        .call_it_done(alone.id, None)
        .await
        .expect_err("a session nobody started called itself done");
    assert!(format!("{refused:#}").contains("an agent started"));
}

#[tokio::test]
async fn an_agent_cannot_spawn_a_third_generation() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let child =
        harness.manager.spawn(parent.id, "sh", None, Isolation::Directory).await.expect("child");
    assert_eq!(child.parent, Some(parent.id));

    let refused = harness
        .manager
        .spawn(child.id, "sh", None, Isolation::Directory)
        .await
        .expect_err("a third generation got through");
    assert!(format!("{refused:#}").contains("third generation"), "unexpected refusal: {refused:#}");
}

#[tokio::test]
async fn a_race_hands_the_same_task_to_every_agent_under_one_run() {
    let harness = Harness::start_in_repo().await;
    let started = harness
        .manager
        .race(harness.project, vec!["sh".into(), "sh".into()], "count to three".into(), vec![])
        .await
        .expect("race");

    assert_eq!(started.len(), 2);
    let run = started[0].run.expect("the first one carries a run");
    assert!(started.iter().all(|session| session.run == Some(run)));
    assert!(started.iter().all(|session| session.worktree.is_some()));
    assert_ne!(started[0].id, started[1].id);
}

#[tokio::test]
async fn a_race_needs_agents_and_a_task() {
    let harness = Harness::start_in_repo().await;
    assert!(
        harness.manager.race(harness.project, vec![], "something".into(), vec![]).await.is_err()
    );
    assert!(
        harness
            .manager
            .race(harness.project, vec!["sh".into()], "   ".into(), vec![])
            .await
            .is_err()
    );
}

#[tokio::test]
async fn a_broadcast_groups_its_sessions_like_a_race() {
    let harness = Harness::start().await;
    let parent = harness
        .manager
        .create(NewSession {
            project: harness.project,
            agent: "sh".into(),
            cwd: None,
            size: TerminalSize::default(),
            isolation: Isolation::Directory,
            slug: None,
            mode: None,
            parent: None,
            run: None,
            unattended: false,
        })
        .await
        .expect("parent");

    let started = harness
        .manager
        .broadcast(
            parent.id,
            vec!["sh".into(), "sh".into()],
            "look around".into(),
            Isolation::Directory,
        )
        .await
        .expect("broadcast");

    let run = started[0].run.expect("a broadcast names its run");
    assert!(started.iter().all(|session| session.run == Some(run)));
    assert_eq!(parent.run, None);
}
