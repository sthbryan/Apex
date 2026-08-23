mod common;

use std::time::Duration;

use apex_proto::{ClientMessage, Command, Event, Frame, Reply, RequestId, ServerMessage};
use common::{Harness, TestClient};
use tokio::time::timeout;

const PAGE: &str = r#"{
    "url": "http://localhost:6006",
    "logs": [{ "level": "error", "text": "boom" }, { "level": "log", "text": "hello" }]
}"#;

async fn answer_once(mut desktop: TestClient, page: Option<String>) {
    let answered = timeout(Duration::from_secs(10), async {
        loop {
            let frame = desktop.connection.recv().await.expect("frame").expect("no error");
            if !matches!(frame, Frame::Control(_)) {
                continue;
            }
            let ServerMessage::Event(Event::AskPage { request, .. }) =
                frame.parse_control::<ServerMessage>().expect("parse")
            else {
                continue;
            };
            desktop
                .connection
                .send_control(&ClientMessage::Request {
                    id: RequestId(999),
                    command: Command::PageDone {
                        request,
                        page: page.clone(),
                        error: page.is_none().then(|| "the pane blew up".to_owned()),
                    },
                })
                .await
                .expect("answer");
            return;
        }
    })
    .await;
    answered.expect("the desktop was never asked");
}

async fn with_pane(harness: &Harness, name: Option<&str>) -> TestClient {
    let mut desktop = harness.client().await;
    desktop
        .request(Command::BrowserReport {
            project: harness.project,
            pane: "browser-1".into(),
            url: "http://localhost:6006".into(),
            name: name.map(str::to_owned),
        })
        .await;
    desktop
}

#[tokio::test]
async fn the_console_comes_from_the_pane_the_agent_named() {
    let harness = Harness::start().await;
    let desktop = with_pane(&harness, Some("storybook")).await;
    let mut agent = harness.client().await;

    tokio::spawn(answer_once(desktop, Some(PAGE.to_owned())));

    let reply = agent
        .request(Command::BrowserLogs { project: harness.project, pane: Some("storybook".into()) })
        .await;
    let Reply::Text { text } = reply else { panic!("expected text, got {reply:?}") };
    assert!(text.contains("[error] boom"));
    assert!(text.contains("[log] hello"));
}

#[tokio::test]
async fn a_pane_that_cannot_answer_says_so_instead_of_hanging() {
    let harness = Harness::start().await;
    let desktop = with_pane(&harness, None).await;
    let mut agent = harness.client().await;

    tokio::spawn(answer_once(desktop, None));

    let complaint = agent
        .try_request(Command::BrowserLogs { project: harness.project, pane: None })
        .await
        .expect_err("the pane blew up");
    assert!(complaint.contains("blew up"), "{complaint}");
}

#[tokio::test]
async fn asking_a_pane_nobody_opened_fails_at_once() {
    let harness = Harness::start().await;
    let mut agent = harness.client().await;

    let complaint = agent
        .try_request(Command::BrowserLogs { project: harness.project, pane: None })
        .await
        .expect_err("no pane");
    assert!(complaint.contains("no browser pane is open"), "{complaint}");
}

#[tokio::test]
async fn the_listing_never_bothers_the_desktop() {
    let harness = Harness::start().await;
    let _desktop = with_pane(&harness, Some("storybook")).await;
    let mut agent = harness.client().await;

    let reply = timeout(
        Duration::from_secs(1),
        agent.request(Command::BrowserList { project: harness.project }),
    )
    .await
    .expect("the listing waited for someone");
    let Reply::Text { text } = reply else { panic!("expected text, got {reply:?}") };
    assert!(text.contains("storybook"));
    assert!(text.contains("in use"));
}

#[tokio::test]
async fn a_silent_desktop_gives_up_and_leaves_the_daemon_well() {
    let harness = Harness::start().await;
    let _desktop = with_pane(&harness, None).await;
    let mut agent = harness.client().await;

    let complaint = agent
        .try_request(Command::BrowserShot { project: harness.project, pane: None })
        .await
        .expect_err("nobody answered");
    assert!(complaint.contains("in time"), "{complaint}");

    let reply = agent.request(Command::BrowserList { project: harness.project }).await;
    assert!(matches!(reply, Reply::Text { .. }));
}
