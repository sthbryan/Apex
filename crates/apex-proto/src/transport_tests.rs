use super::*;
use crate::message::{ClientMessage, Command, Reply, RequestId, ServerMessage};

fn short_socket_dir() -> PathBuf {
    let id = uuid::Uuid::new_v4().simple().to_string();
    PathBuf::from("/tmp").join(format!("apex-t-{}", &id[..8]))
}

#[tokio::test]
async fn unix_transport_carries_a_request_and_a_reply() {
    let dir = short_socket_dir();
    let socket = dir.join("d.sock");
    let mut transport = UnixTransport::bind(&socket).expect("bind");

    let server = tokio::spawn(async move {
        let (stream, peer) = transport.accept().await.expect("accept");
        let mut connection = Connection::new(stream, peer);
        let frame = connection.recv().await.expect("frame").expect("no error");
        let message: ClientMessage = frame.parse_control().expect("parse");
        assert_eq!(message, ClientMessage::Request { id: RequestId(1), command: Command::Ping });
        connection.send_control(&ServerMessage::ok(RequestId(1), Reply::Pong)).await.expect("send");
    });

    let mut client = connect_unix(&socket).await.expect("connect");
    client
        .send_control(&ClientMessage::Request { id: RequestId(1), command: Command::Ping })
        .await
        .expect("send");
    let frame = client.recv().await.expect("frame").expect("no error");
    let reply: ServerMessage = frame.parse_control().expect("parse");
    assert_eq!(reply, ServerMessage::ok(RequestId(1), Reply::Pong));

    server.await.expect("server");
    let _ = std::fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn bind_replaces_a_stale_socket_file() {
    let dir = short_socket_dir();
    std::fs::create_dir_all(&dir).expect("mkdir");
    let socket = dir.join("d.sock");
    std::os::unix::net::UnixListener::bind(&socket).expect("listener");
    drop(std::fs::File::open(&socket));

    assert!(socket.exists());
    let transport = UnixTransport::bind(&socket).expect("rebind");
    assert_eq!(transport.path(), socket.as_path());
    drop(transport);
    let _ = std::fs::remove_dir_all(&dir);
}
