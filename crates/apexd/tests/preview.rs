mod common;

use apex_proto::{Command, Event, Frame, Isolation, Reply, ServerMessage, TerminalSize};
use common::{Harness, TestClient};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{Duration, timeout};

async fn a_session(client: &mut TestClient, harness: &Harness) -> uuid::Uuid {
    let reply = client
        .request(Command::SessionCreate {
            mode: None,
            isolation: Isolation::Directory,
            slug: None,
            project: harness.project,
            agent: "mute".into(),
            cwd: Some(harness.root.path().display().to_string()),
            size: TerminalSize { rows: 24, cols: 80 },
        })
        .await;
    match reply {
        Reply::Session { session } => session.id,
        other => panic!("expected a session, got {other:?}"),
    }
}

async fn fetch(url: &str) -> String {
    let rest = url.strip_prefix("http://127.0.0.1:").expect("a loopback url");
    let (port, path) = rest.split_once('/').expect("a path");
    let mut stream = TcpStream::connect(("127.0.0.1", port.parse::<u16>().expect("a port")))
        .await
        .expect("connect");
    stream
        .write_all(format!("GET /{path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n").as_bytes())
        .await
        .expect("request");
    stream.flush().await.expect("flush");
    let mut answer = String::new();
    stream.read_to_string(&mut answer).await.expect("answer");
    answer
}

async fn opened(client: &mut TestClient) -> String {
    let seen = timeout(Duration::from_secs(10), async {
        loop {
            let frame = client.connection.recv().await.expect("frame").expect("no error");
            if !matches!(frame, Frame::Control(_)) {
                continue;
            }
            if let ServerMessage::Event(event) =
                frame.parse_control::<ServerMessage>().expect("parse")
                && let Event::OpenView { target: apex_proto::ViewTarget::Url { url, .. }, .. } =
                    *event
            {
                return url;
            }
        }
    })
    .await;
    seen.expect("no pane was ever opened")
}

#[tokio::test]
async fn serves_the_page_the_agent_left_and_opens_it_in_a_pane() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = a_session(&mut client, &harness).await;

    let dir = harness.root.path().join(".apex").join("preview");
    std::fs::create_dir_all(&dir).expect("folder");
    std::fs::write(dir.join("index.html"), "<h1>hola</h1>").expect("page");

    let reply = client
        .request(Command::Preview {
            asked_by: session,
            path: "index.html".into(),
            name: Some("proto".into()),
        })
        .await;
    let Reply::Text { text: url } = reply else { panic!("expected a url, got {reply:?}") };

    assert_eq!(url, opened(&mut client).await);

    let answer = fetch(&url).await;
    assert!(answer.starts_with("HTTP/1.1 200 OK"), "{answer}");
    assert!(answer.ends_with("<h1>hola</h1>"), "{answer}");
}

#[tokio::test]
async fn says_where_to_write_when_the_page_is_not_there() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = a_session(&mut client, &harness).await;

    let failure = client
        .try_request(Command::Preview {
            asked_by: session,
            path: "missing.html".into(),
            name: None,
        })
        .await
        .expect_err("there is no page");

    assert!(failure.contains(".apex/preview"), "{failure}");
    assert!(failure.contains("write the page there"), "{failure}");
    assert!(harness.root.path().join(".apex").join("preview").is_dir());
}

#[tokio::test]
async fn refuses_to_serve_what_is_outside_the_folder() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let session = a_session(&mut client, &harness).await;
    std::fs::write(harness.root.path().join("secret.txt"), "no").expect("secret");

    let failure = client
        .try_request(Command::Preview {
            asked_by: session,
            path: "../secret.txt".into(),
            name: None,
        })
        .await
        .expect_err("that is not a preview");

    assert!(failure.contains("secret.txt"), "{failure}");
}
