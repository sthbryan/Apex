use tauri::webview::{NewWindowResponse, WebviewBuilder};
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl};

use crate::state::Answer;

const HOST: &str = "main";
const LOADED: &str = "browser-loaded";
const BLOCKED: &str = "browser-blocked";
const PROBE: &str = include_str!("probe.js");
const LOCAL: [&str; 4] = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

#[derive(Clone, serde::Serialize)]
struct Loaded {
    label: String,
    url: String,
    title: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Bounds {
    fn position(&self) -> LogicalPosition<f64> {
        LogicalPosition::new(self.x, self.y)
    }

    fn size(&self) -> LogicalSize<f64> {
        LogicalSize::new(self.width.max(1.0), self.height.max(1.0))
    }
}

pub fn is_local(url: &url::Url) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    LOCAL.contains(&host) || host.ends_with(".localhost")
}

fn parse(url: &str) -> Answer<url::Url> {
    let parsed = url::Url::parse(url).map_err(|error| error.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("{url} is not a web address"));
    }
    Ok(parsed)
}

#[tauri::command]
pub async fn browser_open(
    app: tauri::AppHandle,
    label: String,
    url: String,
    bounds: Bounds,
) -> Answer<()> {
    let target = parse(&url)?;
    if !is_local(&target) {
        return Err(format!("{url} is not a local address"));
    }
    if let Some(webview) = app.get_webview(&label) {
        return webview.navigate(target).map_err(|error| error.to_string());
    }

    let window = app.get_window(HOST).ok_or_else(|| "no main window".to_owned())?;
    let loading = app.clone();
    let leaving = app.clone();
    let opening = app.clone();
    let naming = app.clone();
    let named = label.clone();
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(target))
        .devtools(true)
        .incognito(true)
        .transparent(false)
        .initialization_script(PROBE)
        .on_page_load(move |webview, payload| {
            let _ = loading.emit(
                LOADED,
                Loaded {
                    label: webview.label().to_owned(),
                    url: payload.url().to_string(),
                    title: None,
                },
            );
        })
        .on_navigation(move |url| {
            if is_local(url) {
                return true;
            }
            let _ = leaving.emit(BLOCKED, url.to_string());
            false
        })
        .on_new_window(move |url, _| {
            let _ = opening.emit(BLOCKED, url.to_string());
            NewWindowResponse::Deny
        })
        .on_download(|_, _| false)
        .on_document_title_changed(move |webview, title| {
            let _ = naming.emit(
                LOADED,
                Loaded {
                    label: named.clone(),
                    url: webview.url().map(|url| url.to_string()).unwrap_or_default(),
                    title: Some(title),
                },
            );
        });

    window
        .add_child(builder, bounds.position(), bounds.size())
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_close(app: tauri::AppHandle, label: String) -> Answer<()> {
    let Some(webview) = app.get_webview(&label) else {
        return Ok(());
    };
    webview.close().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_show(app: tauri::AppHandle, label: String, visible: bool) -> Answer<()> {
    let Some(webview) = app.get_webview(&label) else {
        return Ok(());
    };
    let done = if visible { webview.show() } else { webview.hide() };
    done.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_bounds(app: tauri::AppHandle, label: String, bounds: Bounds) -> Answer<()> {
    let Some(webview) = app.get_webview(&label) else {
        return Ok(());
    };
    webview.set_position(bounds.position()).map_err(|error| error.to_string())?;
    webview.set_size(bounds.size()).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_run(app: tauri::AppHandle, label: String, script: String) -> Answer<()> {
    let Some(webview) = app.get_webview(&label) else {
        return Ok(());
    };
    webview.eval(script).map_err(|error| error.to_string())
}

async fn ask(webview: tauri::Webview, script: &str) -> Answer<String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    let slot = std::sync::Mutex::new(Some(sender));
    webview
        .eval_with_callback(script, move |value| {
            if let Ok(mut held) = slot.lock()
                && let Some(sender) = held.take()
            {
                let _ = sender.send(value);
            }
        })
        .map_err(|error| error.to_string())?;
    receiver.await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_logs(app: tauri::AppHandle, label: String) -> Answer<String> {
    let Some(webview) = app.get_webview(&label) else {
        return Ok("[]".to_owned());
    };
    ask(webview, "window.__apex ? window.__apex.drain() : []").await
}

#[tauri::command]
pub async fn browser_text(app: tauri::AppHandle, label: String) -> Answer<String> {
    let Some(webview) = app.get_webview(&label) else {
        return Ok(String::new());
    };
    ask(webview, "document.body ? document.body.innerText.slice(0, 20000) : ''").await
}
