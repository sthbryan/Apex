mod common;

use apex_proto::{Command, Reply};
use common::Harness;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::task::JoinHandle;

async fn serving(status: &'static str, body: String) -> (String, JoinHandle<String>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.expect("bind");
    let port = listener.local_addr().expect("addr").port();
    let heard = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.expect("accept");
        let mut seen = Vec::new();
        let mut buf = [0u8; 4096];
        loop {
            let read = stream.read(&mut buf).await.expect("read");
            if read == 0 {
                break;
            }
            seen.extend_from_slice(&buf[..read]);
            if complete(&seen) {
                break;
            }
        }
        let answer = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(answer.as_bytes()).await.expect("write");
        stream.flush().await.expect("flush");
        String::from_utf8_lossy(&seen).into_owned()
    });
    (format!("http://127.0.0.1:{port}"), heard)
}

fn complete(seen: &[u8]) -> bool {
    let Some(at) = seen.windows(4).position(|window| window == b"\r\n\r\n") else {
        return false;
    };
    let head = String::from_utf8_lossy(&seen[..at]).to_lowercase();
    let wanted = head
        .lines()
        .find_map(|line| line.strip_prefix("content-length:"))
        .and_then(|raw| raw.trim().parse::<usize>().ok())
        .unwrap_or(0);
    seen.len() >= at + 4 + wanted
}

fn write_request(harness: &Harness, name: &str, body: &str) {
    let dir = harness.api_dir().join("requests");
    std::fs::create_dir_all(&dir).expect("folder");
    std::fs::write(dir.join(format!("{name}.toml")), body).expect("request");
}

fn write_environment(harness: &Harness, name: &str, body: &str) {
    let dir = harness.api_dir().join("environments");
    std::fs::create_dir_all(&dir).expect("folder");
    std::fs::write(dir.join(format!("{name}.toml")), body).expect("environment");
}

async fn send(harness: &Harness, name: &str, environment: Option<&str>) -> apex_proto::ApiRun {
    let mut client = harness.client().await;
    let reply = client
        .request(Command::ApiSend {
            project: harness.project,
            name: name.into(),
            environment: environment.map(str::to_owned),
        })
        .await;
    match reply {
        Reply::ApiRun { run } => run,
        other => panic!("expected a run, got {other:?}"),
    }
}

#[tokio::test]
async fn a_saved_request_reaches_the_server_and_comes_back() {
    let harness = Harness::start().await;
    let (base, heard) = serving("201 Created", "{\"id\":7}".into()).await;
    write_environment(&harness, "local", &format!("host = \"{base}\"\ntoken = \"$API_TOKEN\"\n"));
    std::fs::write(harness.api_dir().join(".env"), "API_TOKEN=abc123\n").expect("secrets");
    write_request(
        &harness,
        "create user",
        "method = \"post\"\nurl = \"{{host}}/users\"\nbody = '{\"name\":\"ana\"}'\n\n[headers]\nAuthorization = \"Bearer {{token}}\"\n",
    );

    let run = send(&harness, "create user", Some("local")).await;
    assert_eq!(run.status, 201);
    assert_eq!(run.body, "{\"id\":7}");
    assert!(!run.truncated);

    let asked = heard.await.expect("served");
    assert!(asked.starts_with("POST /users HTTP/1.1"), "{asked}");
    assert!(asked.contains("authorization: Bearer abc123"), "{asked}");
    assert!(asked.ends_with("{\"name\":\"ana\"}"), "{asked}");
}

#[tokio::test]
async fn the_secret_never_lands_in_the_saved_request() {
    let harness = Harness::start().await;
    let (base, heard) = serving("200 OK", "{}".into()).await;
    write_environment(&harness, "local", &format!("host = \"{base}\"\ntoken = \"$API_TOKEN\"\n"));
    std::fs::write(harness.api_dir().join(".env"), "API_TOKEN=abc123\n").expect("secrets");
    write_request(
        &harness,
        "me",
        "url = \"{{host}}/me\"\n\n[headers]\nAuthorization = \"Bearer {{token}}\"\n",
    );

    send(&harness, "me", Some("local")).await;
    heard.await.expect("served");

    let saved =
        std::fs::read_to_string(harness.api_dir().join("requests").join("me.toml")).expect("read");
    assert!(!saved.contains("abc123"), "{saved}");
    let kept =
        std::fs::read_to_string(harness.api_dir().join("runs").join("me.json")).expect("read");
    assert!(!kept.contains("abc123"), "{kept}");
}

#[tokio::test]
async fn a_variable_with_no_value_stops_before_anything_is_sent() {
    let harness = Harness::start().await;
    write_request(&harness, "orphan", "url = \"{{host}}/users\"\n");

    let mut client = harness.client().await;
    let complaint = client
        .try_request(Command::ApiSend {
            project: harness.project,
            name: "orphan".into(),
            environment: None,
        })
        .await
        .expect_err("no host");
    assert!(complaint.contains("host"), "{complaint}");
    assert!(!harness.api_dir().join("runs").join("orphan.json").exists());
}

#[tokio::test]
async fn the_last_run_is_kept_on_disk() {
    let harness = Harness::start().await;
    let (base, heard) = serving("500 Internal Server Error", "boom".into()).await;
    write_request(&harness, "health", &format!("url = \"{base}/health\"\n"));

    let run = send(&harness, "health", None).await;
    heard.await.expect("served");
    assert_eq!(run.status, 500);

    let kept =
        std::fs::read_to_string(harness.api_dir().join("runs").join("health.json")).expect("read");
    let back: apex_proto::ApiRun = serde_json::from_str(&kept).expect("parse");
    assert_eq!(back.status, 500);
    assert_eq!(back.body, "boom");
    assert_eq!(back.name, "health");
}

#[tokio::test]
async fn a_body_over_the_cap_is_cut_and_says_so() {
    let harness = Harness::start().await;
    let long = "x".repeat(256 * 1024 + 10);
    let (base, heard) = serving("200 OK", long).await;
    write_request(&harness, "big", &format!("url = \"{base}/big\"\n"));

    let run = send(&harness, "big", None).await;
    heard.await.expect("served");
    assert!(run.truncated);
    assert_eq!(run.body.len(), 256 * 1024);
    assert_eq!(run.size, 256 * 1024 + 10);
}

#[tokio::test]
async fn asking_for_a_request_nobody_saved_says_so() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let complaint = client
        .try_request(Command::ApiSend {
            project: harness.project,
            name: "missing".into(),
            environment: None,
        })
        .await
        .expect_err("no request");
    assert!(complaint.contains("missing"), "{complaint}");
}

#[tokio::test]
async fn the_collection_lists_what_is_saved_and_reads_one_back() {
    let harness = Harness::start().await;
    write_request(&harness, "zeta", "url = \"http://localhost:1/z\"\n");
    write_request(&harness, "alpha", "method = \"POST\"\nurl = \"http://localhost:1/a\"\n");
    write_environment(&harness, "local", "host = \"http://localhost:1\"\n");

    let mut client = harness.client().await;
    let reply = client.request(Command::ApiList { project: harness.project }).await;
    let Reply::ApiCollection { requests, environments } = reply else {
        panic!("expected a collection, got {reply:?}")
    };
    assert_eq!(
        requests.iter().map(|entry| entry.name.as_str()).collect::<Vec<_>>(),
        vec!["alpha", "zeta"]
    );
    assert_eq!(requests[0].method, "POST");
    assert_eq!(requests[1].method, "GET");
    assert_eq!(environments, vec!["local".to_owned()]);

    let reply =
        client.request(Command::ApiRead { project: harness.project, name: "alpha".into() }).await;
    let Reply::ApiRequest { request, last } = reply else {
        panic!("expected a request, got {reply:?}")
    };
    assert_eq!(request.method, "POST");
    assert_eq!(request.url, "http://localhost:1/a");
    assert!(last.is_none());
}

#[tokio::test]
async fn reading_a_request_brings_the_run_the_agent_left() {
    let harness = Harness::start().await;
    let (base, heard) = serving("500 Internal Server Error", "boom".into()).await;
    write_request(&harness, "health", &format!("url = \"{base}/health\"\n"));
    send(&harness, "health", None).await;
    heard.await.expect("served");

    let mut client = harness.client().await;
    let reply =
        client.request(Command::ApiRead { project: harness.project, name: "health".into() }).await;
    let Reply::ApiRequest { last: Some(run), .. } = reply else {
        panic!("expected a run, got {reply:?}")
    };
    assert_eq!(run.status, 500);
    assert_eq!(run.body, "boom");
}

#[tokio::test]
async fn the_panel_can_write_and_remove_a_request() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let request = apex_proto::ApiRequest {
        method: "PUT".into(),
        url: "http://localhost:1/users/1".into(),
        headers: std::collections::BTreeMap::from([("Accept".into(), "application/json".into())]),
        body: Some("{}".into()),
    };
    client
        .request(Command::ApiWrite {
            project: harness.project,
            name: "update user".into(),
            request: request.clone(),
        })
        .await;

    let reply = client
        .request(Command::ApiRead { project: harness.project, name: "update user".into() })
        .await;
    let Reply::ApiRequest { request: back, .. } = reply else {
        panic!("expected a request, got {reply:?}")
    };
    assert_eq!(back, request);

    client
        .request(Command::ApiRemove { project: harness.project, name: "update user".into() })
        .await;
    let reply = client.request(Command::ApiList { project: harness.project }).await;
    let Reply::ApiCollection { requests, .. } = reply else { panic!("expected a collection") };
    assert!(requests.is_empty());
}

#[tokio::test]
async fn a_name_that_walks_out_of_the_folder_is_refused() {
    let harness = Harness::start().await;
    let mut client = harness.client().await;
    let complaint = client
        .try_request(Command::ApiWrite {
            project: harness.project,
            name: "../escaped".into(),
            request: apex_proto::ApiRequest::default(),
        })
        .await
        .expect_err("that is not a name");
    assert!(complaint.contains("not a name"), "{complaint}");
}
