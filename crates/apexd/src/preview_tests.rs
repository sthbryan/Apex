use std::path::Path;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::{PreviewServer, find_file, split_target};

#[test]
fn splits_the_token_from_the_file() {
    assert_eq!(split_target("/abc/index.html"), Some(("abc".into(), "index.html".into())));
    assert_eq!(split_target("/abc/deep/page.html"), Some(("abc".into(), "deep/page.html".into())));
    assert_eq!(split_target("/abc"), Some(("abc".into(), String::new())));
    assert_eq!(split_target("/abc/"), Some(("abc".into(), String::new())));
}

#[test]
fn drops_the_query_and_the_fragment() {
    assert_eq!(split_target("/abc/page.html?v=2"), Some(("abc".into(), "page.html".into())));
    assert_eq!(split_target("/abc/page.html#top"), Some(("abc".into(), "page.html".into())));
}

#[test]
fn gives_back_the_name_the_file_actually_has() {
    assert_eq!(split_target("/abc/una%20foto.png"), Some(("abc".into(), "una foto.png".into())));
}

#[test]
fn refuses_a_target_with_no_token() {
    assert_eq!(split_target("/"), None);
    assert_eq!(split_target(""), None);
}

#[test]
fn falls_back_to_the_index_of_the_folder() {
    let home = tempfile::tempdir().unwrap();
    let root = home.path();
    std::fs::write(root.join("index.html"), "root").unwrap();
    std::fs::create_dir(root.join("deep")).unwrap();
    std::fs::write(root.join("deep").join("index.html"), "deep").unwrap();

    assert_eq!(find_file(root, ""), Some(root.join("index.html").canonicalize().unwrap()));
    assert_eq!(find_file(root, "deep"), Some(root.join("deep/index.html").canonicalize().unwrap()));
    assert_eq!(
        find_file(root, "deep/"),
        Some(root.join("deep/index.html").canonicalize().unwrap())
    );
}

#[test]
fn refuses_to_leave_the_folder() {
    let home = tempfile::tempdir().unwrap();
    std::fs::write(home.path().join("secret.txt"), "no").unwrap();
    let root = home.path().join("preview");
    std::fs::create_dir(&root).unwrap();

    assert_eq!(find_file(&root, "../secret.txt"), None);
    assert_eq!(find_file(&root, "missing.html"), None);
}

async fn ask(port: u16, request: &str) -> String {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    stream.write_all(request.as_bytes()).await.unwrap();
    stream.flush().await.unwrap();
    let mut answer = String::new();
    stream.read_to_string(&mut answer).await.unwrap();
    answer
}

async fn serving(root: &Path) -> (std::sync::Arc<PreviewServer>, String) {
    let server = PreviewServer::start().await.unwrap();
    let token = server.issue(root).await;
    (server, token)
}

#[tokio::test]
async fn serves_the_artifact_the_agent_left() {
    let home = tempfile::tempdir().unwrap();
    std::fs::write(home.path().join("index.html"), "<h1>hola</h1>").unwrap();
    let (server, token) = serving(home.path()).await;

    let answer = ask(
        server.port(),
        &format!("GET /{token}/ HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n", server.port()),
    )
    .await;

    assert!(answer.starts_with("HTTP/1.1 200 OK"), "{answer}");
    assert!(answer.contains("Content-Type: text/html; charset=utf-8"), "{answer}");
    assert!(answer.contains("Cache-Control: no-store"), "{answer}");
    assert!(answer.ends_with("<h1>hola</h1>"), "{answer}");
}

#[tokio::test]
async fn hands_the_same_token_back_for_the_same_folder() {
    let home = tempfile::tempdir().unwrap();
    let (server, token) = serving(home.path()).await;
    assert_eq!(server.issue(home.path()).await, token);
    assert_ne!(server.issue(&home.path().join("other")).await, token);
}

#[tokio::test]
async fn turns_away_a_request_addressed_to_someone_else() {
    let home = tempfile::tempdir().unwrap();
    std::fs::write(home.path().join("index.html"), "<h1>hola</h1>").unwrap();
    let (server, token) = serving(home.path()).await;

    let answer =
        ask(server.port(), &format!("GET /{token}/ HTTP/1.1\r\nHost: rebound.example\r\n\r\n"))
            .await;

    assert!(answer.starts_with("HTTP/1.1 403 Forbidden"), "{answer}");

    let wrong = ask(
        server.port(),
        &format!("GET /{token}/ HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n", server.port() ^ 1),
    )
    .await;

    assert!(wrong.starts_with("HTTP/1.1 403 Forbidden"), "{wrong}");
}

#[tokio::test]
async fn turns_away_a_token_it_never_issued() {
    let home = tempfile::tempdir().unwrap();
    let (server, _) = serving(home.path()).await;

    let answer = ask(
        server.port(),
        &format!("GET /nope/index.html HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n", server.port()),
    )
    .await;

    assert!(answer.starts_with("HTTP/1.1 404 Not Found"), "{answer}");
}

#[tokio::test]
async fn turns_away_an_escape_dressed_up_as_an_escape_code() {
    let home = tempfile::tempdir().unwrap();
    std::fs::write(home.path().join("secret.txt"), "no").unwrap();
    let root = home.path().join("preview");
    std::fs::create_dir(&root).unwrap();
    let (server, token) = serving(&root).await;

    let answer = ask(
        server.port(),
        &format!(
            "GET /{token}/%2e%2e%2fsecret.txt HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n",
            server.port()
        ),
    )
    .await;

    assert!(answer.starts_with("HTTP/1.1 404 Not Found"), "{answer}");
}

#[tokio::test]
async fn takes_reads_and_nothing_else() {
    let home = tempfile::tempdir().unwrap();
    std::fs::write(home.path().join("index.html"), "<h1>hola</h1>").unwrap();
    let (server, token) = serving(home.path()).await;

    let answer = ask(
        server.port(),
        &format!("POST /{token}/ HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n", server.port()),
    )
    .await;

    assert!(answer.starts_with("HTTP/1.1 405 Method Not Allowed"), "{answer}");
}

#[tokio::test]
async fn spells_the_url_so_a_space_survives_it() {
    let home = tempfile::tempdir().unwrap();
    let (server, token) = serving(home.path()).await;
    assert_eq!(
        server.url(&token, "una foto.png"),
        format!("http://127.0.0.1:{}/{token}/una%20foto.png", server.port())
    );
}
