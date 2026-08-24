use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Runtime};

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItemBuilder::with_id("tray-open", "Open Apex").build(app)?;
    let quit = MenuItemBuilder::with_id("tray-quit", "Quit Apex").build(app)?;
    let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;

    let mut tray =
        TrayIconBuilder::with_id("apex").tooltip("Apex").menu(&menu).on_menu_event(|app, event| {
            match event.id().0.as_str() {
                "tray-open" => reveal(app),
                "tray-quit" => app.exit(0),
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}

pub fn reveal<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
