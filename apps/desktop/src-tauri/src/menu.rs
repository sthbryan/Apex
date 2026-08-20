use tauri::menu::{AboutMetadata, Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build(app)?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let id = event.id().0.as_str();
        if id == "close-window" {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.close();
            }
            return;
        }
        let _ = app.emit("menu", id);
    });
    Ok(())
}

fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let settings =
        MenuItemBuilder::with_id("settings", "Settings…").accelerator("CmdOrCtrl+,").build(app)?;
    let apex = SubmenuBuilder::new(app, "Apex")
        .item(&PredefinedMenuItem::about(app, None, Some(AboutMetadata::default()))?)
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let palette = MenuItemBuilder::with_id("palette", "New Session…")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let finder =
        MenuItemBuilder::with_id("finder", "Open File…").accelerator("CmdOrCtrl+P").build(app)?;
    let split_right = MenuItemBuilder::with_id("split-right", "Split Right")
        .accelerator("CmdOrCtrl+D")
        .build(app)?;
    let split_down = MenuItemBuilder::with_id("split-down", "Split Down")
        .accelerator("CmdOrCtrl+Shift+D")
        .build(app)?;
    let close_pane = MenuItemBuilder::with_id("close-pane", "Close Pane")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;
    let close_window = MenuItemBuilder::with_id("close-window", "Close Window")
        .accelerator("CmdOrCtrl+Shift+W")
        .build(app)?;
    let file = SubmenuBuilder::new(app, "File")
        .item(&palette)
        .item(&finder)
        .separator()
        .item(&split_right)
        .item(&split_down)
        .separator()
        .item(&close_pane)
        .item(&close_window)
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let dock =
        MenuItemBuilder::with_id("dock", "Toggle Dock").accelerator("CmdOrCtrl+B").build(app)?;
    let cycle = MenuItemBuilder::with_id("cycle-layout", "Cycle Layout")
        .accelerator("CmdOrCtrl+Shift+L")
        .build(app)?;
    let usage = MenuItemBuilder::with_id("usage", "Usage").accelerator("CmdOrCtrl+U").build(app)?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&dock)
        .item(&cycle)
        .separator()
        .item(&usage)
        .separator()
        .fullscreen()
        .build()?;

    let window = SubmenuBuilder::new(app, "Window").minimize().maximize().separator().build()?;

    let shortcuts = MenuItemBuilder::with_id("shortcuts", "Keyboard Shortcuts")
        .accelerator("CmdOrCtrl+H")
        .build(app)?;
    let help = SubmenuBuilder::new(app, "Help").item(&shortcuts).build()?;

    Menu::with_items(app, &[&apex, &file, &edit, &view, &window, &help])
}
