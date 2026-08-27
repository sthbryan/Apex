use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::{Context, Result, anyhow, bail};
use apex_agent::chat::{Chat, Surface};
use apex_agent::choice;
use apex_agent::mcp::{Servers, Wanted};
use apex_agent::mode::Mode;
use apex_agent::tools::todo::Todo;
use apex_agent::tools::{Call, Done, Kit, our_names, sketch};
use apex_agent::{ProviderSet, key, model, preamble, settings, window};
use apex_core::ApexPaths;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{Mutex, mpsc, oneshot};

const PROTOCOL: u32 = 1;

type Held = Arc<Mutex<Chat>>;

pub struct Side {
    out: mpsc::UnboundedSender<String>,
    pending: Mutex<HashMap<u64, oneshot::Sender<Value>>>,
    next: AtomicU64,
}

impl Side {
    pub fn notify(&self, method: &str, params: Value) {
        let body = json!({ "jsonrpc": "2.0", "method": method, "params": params });
        let _ = self.out.send(body.to_string());
    }

    pub async fn request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (answer, wait) = oneshot::channel();
        self.pending.lock().await.insert(id, answer);
        let body = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        self.out.send(body.to_string()).map_err(|_| anyhow!("the client stopped listening"))?;
        wait.await.map_err(|_| anyhow!("the client never answered {method}"))
    }

    fn reply(&self, id: &Value, result: Value) {
        let body = json!({ "jsonrpc": "2.0", "id": id, "result": result });
        let _ = self.out.send(body.to_string());
    }

    fn complain(&self, id: &Value, why: &str) {
        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32603, "message": why },
        });
        let _ = self.out.send(body.to_string());
    }

    async fn answered(&self, id: u64, result: Value) {
        if let Some(waiting) = self.pending.lock().await.remove(&id) {
            let _ = waiting.send(result);
        }
    }
}

#[derive(Default)]
struct Rooms {
    live: Mutex<HashMap<String, Held>>,
    running: Mutex<HashMap<String, tokio::task::AbortHandle>>,
    next: AtomicU64,
}

pub async fn run() -> Result<i32> {
    let (out, mut queue) = mpsc::unbounded_channel::<String>();
    let writing = tokio::spawn(async move {
        let mut writer = tokio::io::stdout();
        while let Some(line) = queue.recv().await {
            if writer.write_all(line.as_bytes()).await.is_err()
                || writer.write_all(b"\n").await.is_err()
                || writer.flush().await.is_err()
            {
                break;
            }
        }
    });

    let side = Arc::new(Side { out, pending: Mutex::default(), next: AtomicU64::new(1) });
    let rooms = Arc::new(Rooms::default());
    let mut answering = tokio::task::JoinSet::new();

    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(message) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let method = message.get("method").and_then(Value::as_str).map(str::to_owned);
        let id = message.get("id").cloned();
        let params = message.get("params").cloned().unwrap_or_else(|| json!({}));

        match (method, id) {
            (Some(method), Some(id)) => {
                let side = Arc::clone(&side);
                let rooms = Arc::clone(&rooms);
                answering.spawn(async move {
                    match asked(&side, &rooms, &method, params).await {
                        Ok(result) => side.reply(&id, result),
                        Err(cause) => side.complain(&id, &format!("{cause:#}")),
                    }
                });
            }
            (Some(method), None) => told(&rooms, &method, params).await,
            (None, Some(id)) => {
                if let Some(id) = id.as_u64() {
                    let result = message.get("result").cloned().unwrap_or(Value::Null);
                    side.answered(id, result).await;
                }
            }
            (None, None) => {}
        }
    }

    while answering.join_next().await.is_some() {}
    drop(side);
    let _ = writing.await;
    Ok(0)
}

async fn asked(side: &Arc<Side>, rooms: &Arc<Rooms>, method: &str, params: Value) -> Result<Value> {
    match method {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL,
            "agentCapabilities": { "mcpCapabilities": { "http": false, "sse": false } },
            "authMethods": [],
            "agentInfo": { "name": "apex", "version": env!("CARGO_PKG_VERSION") },
        })),
        "authenticate" => Ok(Value::Null),
        "session/new" => opened(side, rooms, params).await,
        "session/prompt" => prompted(side, rooms, params).await,
        "session/set_model" => Ok(Value::Null),
        "session/set_mode" => switched(rooms, params).await,
        other => bail!("apex does not answer {other}"),
    }
}

async fn told(rooms: &Arc<Rooms>, method: &str, params: Value) {
    if method != "session/cancel" {
        return;
    }
    let Some(session) = params.get("sessionId").and_then(Value::as_str) else {
        return;
    };
    if let Some(running) = rooms.running.lock().await.remove(session) {
        running.abort();
    }
}

const OFFERED: &[(&str, &str)] =
    &[("compact", "sum the conversation up so far and free the window")];

async fn opened(side: &Arc<Side>, rooms: &Arc<Rooms>, params: Value) -> Result<Value> {
    let cwd =
        params.get("cwd").and_then(Value::as_str).context("session/new needs a cwd")?.to_owned();

    let paths = ApexPaths::discover()?;
    let agent_dir = paths.agent_dir();
    let set = ProviderSet::load(&paths.providers_dir())?;
    let picked = choice::read(&agent_dir).context(
        "no provider is set up yet: open Settings, Our agent, put in a key and pick a model",
    )?;
    let provider = set.get(&picked.provider).with_context(|| {
        format!("{} is not a provider any more, pick another one in Settings", picked.provider)
    })?;

    let held = match key::find(provider)? {
        Some(found) => found.key,
        None if provider.keyless => String::new(),
        None => {
            bail!("{} has no key yet: open Settings, Our agent, and put one in", provider.label)
        }
    };

    let wire = provider.dial(&held)?;
    let listing = model::list(&wire).await.unwrap_or_default();
    if !listing.is_empty() && !listing.iter().any(|one| one.id == picked.model) {
        bail!(
            "{} does not have a model called {}, pick another one in Settings",
            provider.label,
            picked.model
        )
    }
    let kept = settings::read(&agent_dir);
    let window = match kept.window_for(&picked.model).or_else(|| window::guess(&picked.model)) {
        Some(window) => Some(window),
        None => listed(&wire, &picked.model).await,
    };

    let mut kit = Kit::new(&cwd);
    kit.plugs(Servers::connect(&plugged(params.get("mcpServers")), &our_names()).await);

    let mut chat = Chat::new(wire.brain(&picked.model), kit, preamble::read(&agent_dir));
    chat.holds(window);

    let id = format!("apex-{}", rooms.next.fetch_add(1, Ordering::Relaxed));
    rooms.live.lock().await.insert(id.clone(), Arc::new(Mutex::new(chat)));
    side.notify(
        "session/update",
        json!({
            "sessionId": id,
            "update": {
                "sessionUpdate": "available_commands_update",
                "availableCommands": OFFERED
                    .iter()
                    .map(|(name, about)| json!({ "name": name, "description": about }))
                    .collect::<Vec<_>>(),
            },
        }),
    );

    Ok(json!({
        "sessionId": id,
        "models": {
            "currentModelId": picked.model,
            "availableModels": listing
                .iter()
                .map(|one| json!({ "modelId": one.id, "name": one.label }))
                .collect::<Vec<_>>(),
        },
        "modes": {
            "currentModeId": Mode::default().as_str(),
            "availableModes": [
                { "id": "auto", "name": "Auto" },
                { "id": "plan", "name": "Plan" },
                { "id": "chat", "name": "Chat" },
            ],
        },
    }))
}

async fn listed(wire: &apex_agent::Wire, model: &str) -> Option<u32> {
    model::list(wire).await.ok()?.into_iter().find(|one| one.id == model)?.context
}

async fn switched(rooms: &Arc<Rooms>, params: Value) -> Result<Value> {
    let session = params.get("sessionId").and_then(Value::as_str).context("no session")?;
    let wanted = params.get("modeId").and_then(Value::as_str).context("no mode")?;
    let mode = Mode::parse(wanted).with_context(|| format!("there is no {wanted} mode"))?;
    let held = room(rooms, session).await?;
    held.lock().await.works_in(mode);
    Ok(Value::Null)
}

async fn prompted(side: &Arc<Side>, rooms: &Arc<Rooms>, params: Value) -> Result<Value> {
    let session = params
        .get("sessionId")
        .and_then(Value::as_str)
        .context("session/prompt needs a session")?
        .to_owned();
    let said = spoken(params.get("prompt"));
    let held = room(rooms, &session).await?;

    if let Some(order) = said.trim().strip_prefix('/') {
        return ordered(side, &held, &session, order.trim()).await;
    }

    let mut voice = Voice { side: Arc::clone(side), session: session.clone() };
    let running = tokio::spawn(async move {
        held.lock().await.turn(&said, &mut voice).await.map_err(|cause| format!("{cause:#}"))
    });
    rooms.running.lock().await.insert(session.clone(), running.abort_handle());

    let ended = running.await;
    rooms.running.lock().await.remove(&session);

    match ended {
        Ok(Ok(())) => Ok(json!({ "stopReason": "end_turn" })),
        Ok(Err(cause)) => bail!("{cause}"),
        Err(cause) if cause.is_cancelled() => Ok(json!({ "stopReason": "cancelled" })),
        Err(cause) => bail!("the turn fell over: {cause}"),
    }
}

async fn ordered(side: &Arc<Side>, held: &Held, session: &str, order: &str) -> Result<Value> {
    let told = match order {
        "compact" => match held.lock().await.compact().await {
            Ok(summary) => format!("Compacted. From here on I am working from this:\n\n{summary}"),
            Err(cause) => format!("Compacting did not work out: {cause:#}"),
        },
        "" => spell_orders(),
        other => format!("There is no /{other}.\n\n{}", spell_orders()),
    };
    let mut voice = Voice { side: Arc::clone(side), session: session.to_owned() };
    voice.noted(&told);
    Ok(json!({ "stopReason": "end_turn" }))
}

fn spell_orders() -> String {
    let listed = OFFERED
        .iter()
        .map(|(name, about)| format!("/{name} {about}"))
        .collect::<Vec<_>>()
        .join("\n");
    format!("What I take:\n{listed}")
}

async fn room(rooms: &Arc<Rooms>, session: &str) -> Result<Held> {
    rooms
        .live
        .lock()
        .await
        .get(session)
        .cloned()
        .with_context(|| format!("there is no session called {session}"))
}

pub fn plugged(offered: Option<&Value>) -> Vec<Wanted> {
    let Some(listed) = offered.and_then(Value::as_array) else {
        return Vec::new();
    };
    listed.iter().filter_map(|one| serde_json::from_value::<Wanted>(one.clone()).ok()).collect()
}

pub fn spoken(prompt: Option<&Value>) -> String {
    let Some(blocks) = prompt.and_then(Value::as_array) else {
        return String::new();
    };
    blocks
        .iter()
        .filter_map(|block| block.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn kind_of(tool: &str) -> &'static str {
    match tool {
        "read" | "search" | "find" => "read",
        "write" | "edit" => "edit",
        "bash" => "execute",
        "fetch" => "fetch",
        "todo" => "think",
        _ => "other",
    }
}

pub fn chose(answer: &Value) -> Option<String> {
    let outcome = answer.get("outcome")?;
    match outcome.get("outcome").and_then(Value::as_str)? {
        "selected" => outcome.get("optionId").and_then(Value::as_str).map(str::to_owned),
        _ => None,
    }
}

struct Voice {
    side: Arc<Side>,
    session: String,
}

impl Voice {
    fn update(&self, update: Value) {
        self.side.notify("session/update", json!({ "sessionId": self.session, "update": update }));
    }

    fn chunk(&self, kind: &str, text: &str) {
        self.update(json!({
            "sessionUpdate": kind,
            "content": { "type": "text", "text": text },
        }));
    }
}

impl Surface for Voice {
    fn said(&mut self, text: &str) {
        self.chunk("agent_message_chunk", text);
    }

    fn thought(&mut self, text: &str) {
        self.chunk("agent_thought_chunk", text);
    }

    fn noted(&mut self, text: &str) {
        self.chunk("agent_message_chunk", text);
    }

    fn running(&mut self, call: &Call) {
        self.update(json!({
            "sessionUpdate": "tool_call",
            "toolCallId": call.id,
            "title": spell_call(call),
            "kind": kind_of(&call.name),
            "status": "in_progress",
        }));
    }

    fn ran(&mut self, call: &Call, done: &Done) {
        self.update(json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": call.id,
            "status": if done.went_well() { "completed" } else { "failed" },
            "content": [{ "type": "content", "content": { "type": "text", "text": done.text() } }],
        }));
    }

    fn planned(&mut self, items: &[Todo]) {
        self.update(json!({
            "sessionUpdate": "plan",
            "entries": items
                .iter()
                .map(|item| json!({
                    "content": item.content,
                    "status": serde_json::to_value(item.status).unwrap_or(Value::Null),
                }))
                .collect::<Vec<_>>(),
        }));
    }

    async fn asked(&mut self, question: &str, options: &[String]) -> Option<String> {
        let offered: Vec<Value> = options
            .iter()
            .map(|option| json!({ "optionId": option, "name": option, "kind": "other" }))
            .collect();
        let answer = self
            .side
            .request(
                "session/request_permission",
                json!({
                    "sessionId": self.session,
                    "toolCall": { "toolCallId": "ask", "title": question, "kind": "other" },
                    "options": offered,
                }),
            )
            .await
            .ok()?;
        chose(&answer)
    }
}

pub fn spell_call(call: &Call) -> String {
    let sketched = sketch(call);
    match sketched.is_empty() {
        true => call.name.clone(),
        false => format!("{} {sketched}", call.name),
    }
}

#[cfg(test)]
#[path = "acp_agent_tests.rs"]
mod tests;
