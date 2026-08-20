use tauri::webview::WebviewBuilder;
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl};

use crate::state::Answer;

const HOST: &str = "main";

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
    if let Some(webview) = app.get_webview(&label) {
        return webview.navigate(target).map_err(|error| error.to_string());
    }

    let window = app.get_window(HOST).ok_or_else(|| "no main window".to_owned())?;
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(target))
        .devtools(true)
        .incognito(true)
        .transparent(false);

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
