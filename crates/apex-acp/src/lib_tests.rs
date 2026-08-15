use super::*;
use tokio::io::{DuplexStream, duplex};

struct Recorder {
    updates: mpsc::UnboundedSender<SessionUpdate>,
    choice: Option<String>,
}

#[async_trait::async_trait]
impl Client for Recorder {
    async fn update(&mut self, _session: &str, update: SessionUpdate) {
        let _ = self.updates.send(update);
    }

    async fn permission(&mut self, request: PermissionRequest) -> PermissionOutcome {
        match self.choice.clone().or_else(|| {
            request.options.first().map(|option| option.option_id.clone())
        }) {
            Some(option_id) => PermissionOutcome::Selected { option_id },
            None => PermissionOutcome::Cancelled,
        }
    }

    async fn read_file(&mut self, path: &str) -> Result<String> {
        Ok(format!("the body of {path}"))
    }
}

fn link(choice: Option<&str>) -> (Connection, DuplexStream, mpsc::UnboundedReceiver<SessionUpdate>) {
    let (ours, theirs) = duplex(8192);
    let (reader, writer) = tokio::io::split(ours);
    let (updates, seen) = mpsc::unbounded_channel();
    let client = Recorder { updates, choice: choice.map(str::to_owned) };
    (Connection::new(reader, writer, client), theirs, seen)
}

async fn next_line(agent: &mut BufReader<DuplexStream>) -> Value {
    let mut line = String::new();
    agent.read_line(&mut line).await.expect("a line");
    serde_json::from_str(&line).expect("json")
}

async fn reply(agent: &mut DuplexStream, id: &Value, result: Value) {
    let body = json!({ "jsonrpc": "2.0", "id": id, "result": result });
    agent.write_all(format!("{body}\n").as_bytes()).await.expect("write");
}

#[tokio::test]
async fn a_request_carries_its_answer_back_to_the_caller() {
    let (connection, theirs, _) = link(None);
    let mut agent = BufReader::new(theirs);

    let asking = tokio::spawn(async move {
        connection.request::<_, NewSession>("session/new", json!({ "cwd": "/tmp" })).await
    });

    let request = next_line(&mut agent).await;
    assert_eq!(request["method"], "session/new");
    assert_eq!(request["jsonrpc"], "2.0");
    reply(agent.get_mut(), &request["id"], json!({ "sessionId": "abc" })).await;

    let session = asking.await.expect("join").expect("a session");
    assert_eq!(session.session_id, "abc");
}

#[tokio::test]
async fn an_error_from_the_agent_becomes_an_error_for_the_caller() {
    let (connection, theirs, _) = link(None);
    let mut agent = BufReader::new(theirs);

    let asking = tokio::spawn(async move {
        connection.request::<_, Prompted>("session/prompt", json!({})).await
    });

    let request = next_line(&mut agent).await;
    let body = json!({
        "jsonrpc": "2.0",
        "id": request["id"],
        "error": { "code": -32603, "message": "no session" },
    });
    agent.get_mut().write_all(format!("{body}\n").as_bytes()).await.expect("write");

    let failure = asking.await.expect("join").expect_err("an error");
    assert!(format!("{failure:#}").contains("no session"));
}

#[tokio::test]
async fn message_chunks_and_tool_calls_reach_the_client() {
    let (_connection, mut theirs, mut seen) = link(None);

    let chunk = json!({
        "jsonrpc": "2.0",
        "method": "session/update",
        "params": {
            "sessionId": "abc",
            "update": {
                "sessionUpdate": "agent_message_chunk",
                "content": { "type": "text", "text": "hello" },
            },
        },
    });
    let call = json!({
        "jsonrpc": "2.0",
        "method": "session/update",
        "params": {
            "sessionId": "abc",
            "update": {
                "sessionUpdate": "tool_call",
                "toolCallId": "call-1",
                "title": "Edit main.rs",
                "kind": "edit",
                "status": "pending",
                "content": [{
                    "type": "diff",
                    "path": "/tmp/main.rs",
                    "oldText": "one",
                    "newText": "two",
                }],
            },
        },
    });
    theirs.write_all(format!("{chunk}\n{call}\n").as_bytes()).await.expect("write");

    let first = seen.recv().await.expect("a chunk");
    assert_eq!(first, SessionUpdate::AgentMessageChunk { content: ContentBlock::text("hello") });

    let second = seen.recv().await.expect("a tool call");
    let SessionUpdate::ToolCall { call } = second else {
        panic!("expected a tool call, got {second:?}");
    };
    assert_eq!(call.tool_call_id, "call-1");
    assert_eq!(call.status, Some(ToolStatus::Pending));
    assert_eq!(
        call.content,
        vec![ToolContent::Diff {
            path: "/tmp/main.rs".into(),
            old_text: Some("one".into()),
            new_text: "two".into(),
        }]
    );
}

#[tokio::test]
async fn a_permission_request_is_answered_with_the_option_the_client_picked() {
    let (_connection, theirs, _) = link(Some("allow_always"));
    let mut agent = BufReader::new(theirs);

    let ask = json!({
        "jsonrpc": "2.0",
        "id": 7,
        "method": "session/request_permission",
        "params": {
            "sessionId": "abc",
            "toolCall": { "toolCallId": "call-1", "title": "Write main.rs" },
            "options": [
                { "optionId": "allow_once", "name": "Allow once", "kind": "allow_once" },
                { "optionId": "allow_always", "name": "Always allow", "kind": "allow_always" },
            ],
        },
    });
    agent.get_mut().write_all(format!("{ask}\n").as_bytes()).await.expect("write");

    let answer = next_line(&mut agent).await;
    assert_eq!(answer["id"], 7);
    assert_eq!(answer["result"]["outcome"]["outcome"], "selected");
    assert_eq!(answer["result"]["outcome"]["optionId"], "allow_always");
}

#[tokio::test]
async fn a_read_the_client_cannot_serve_comes_back_as_a_json_rpc_error() {
    let (_connection, theirs, _) = link(None);
    let mut agent = BufReader::new(theirs);

    let ask = json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "fs/write_text_file",
        "params": { "sessionId": "abc", "path": "/tmp/one", "content": "two" },
    });
    agent.get_mut().write_all(format!("{ask}\n").as_bytes()).await.expect("write");

    let answer = next_line(&mut agent).await;
    assert_eq!(answer["id"], 3);
    assert!(answer["error"]["message"].as_str().expect("a message").contains("/tmp/one"));
}

#[tokio::test]
async fn a_file_read_is_served_from_the_client() {
    let (_connection, theirs, _) = link(None);
    let mut agent = BufReader::new(theirs);

    let ask = json!({
        "jsonrpc": "2.0",
        "id": 4,
        "method": "fs/read_text_file",
        "params": { "sessionId": "abc", "path": "/tmp/one" },
    });
    agent.get_mut().write_all(format!("{ask}\n").as_bytes()).await.expect("write");

    let answer = next_line(&mut agent).await;
    assert_eq!(answer["result"]["content"], "the body of /tmp/one");
}

#[tokio::test]
async fn a_dead_agent_frees_everyone_waiting_on_it() {
    let (connection, theirs, _) = link(None);
    let mut agent = BufReader::new(theirs);

    let asking =
        tokio::spawn(async move { connection.request::<_, Prompted>("session/prompt", json!({})).await });
    next_line(&mut agent).await;
    drop(agent);

    let failure = asking.await.expect("join").expect_err("an error");
    assert!(format!("{failure:#}").contains("went away"));
}
