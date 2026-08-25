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
            let ServerMessage::Event(event) =
                frame.parse_control::<ServerMessage>().expect("parse")
            else {
                continue;
            };
            let Event::AskPage { request, .. } = *event else {
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

async fn with_browser(harness: &Harness) -> TestClient {
    let mut desktop = harness.client().await;
    desktop
        .request(Command::BrowserReport {
            project: harness.project,
            pane: "browser".into(),
            url: "http://localhost:6006".into(),
        })
        .await;
    desktop
}

#[tokio::test]
async fn the_console_comes_from_the_open_browser() {
    let harness = Harness::start().await;
    let desktop = with_browser(&harness).await;
    let mut agent = harness.client().await;

    tokio::spawn(answer_once(desktop, Some(PAGE.to_owned())));

    let reply = agent.request(Command::BrowserLogs { project: harness.project }).await;
    let Reply::Text { text } = reply else { panic!("expected text, got {reply:?}") };
    assert!(text.contains("[error] boom"));
    assert!(text.contains("[log] hello"));
}

#[tokio::test]
async fn a_browser_that_cannot_answer_says_so_instead_of_hanging() {
    let harness = Harness::start().await;
    let desktop = with_browser(&harness).await;
    let mut agent = harness.client().await;

    tokio::spawn(answer_once(desktop, None));

    let complaint = agent
        .try_request(Command::BrowserLogs { project: harness.project })
        .await
        .expect_err("the browser blew up");
    assert!(complaint.contains("blew up"), "{complaint}");
}

#[tokio::test]
async fn asking_a_browser_nobody_opened_fails_at_once() {
    let harness = Harness::start().await;
    let mut agent = harness.client().await;

    let complaint = agent
        .try_request(Command::BrowserLogs { project: harness.project })
        .await
        .expect_err("no browser");
    assert!(complaint.contains("no browser is open"), "{complaint}");
}

#[tokio::test]
async fn the_page_never_bothers_the_desktop() {
    let harness = Harness::start().await;
    let _desktop = with_browser(&harness).await;
    let mut agent = harness.client().await;

    let reply = timeout(
        Duration::from_secs(1),
        agent.request(Command::BrowserPage { project: harness.project }),
    )
    .await
    .expect("the page waited for someone");
    let Reply::Text { text } = reply else { panic!("expected text, got {reply:?}") };
    assert!(text.contains("http://localhost:6006"), "{text}");
}

#[tokio::test]
async fn a_silent_desktop_gives_up_and_leaves_the_daemon_well() {
    let harness = Harness::start().await;
    let _desktop = with_browser(&harness).await;
    let mut agent = harness.client().await;

    let complaint = agent
        .try_request(Command::BrowserShot { project: harness.project })
        .await
        .expect_err("nobody answered");
    assert!(complaint.contains("in time"), "{complaint}");

    let reply = agent.request(Command::BrowserPage { project: harness.project }).await;
    assert!(matches!(reply, Reply::Text { .. }));
}
