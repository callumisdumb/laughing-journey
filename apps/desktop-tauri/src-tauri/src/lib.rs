//! Tauri 2 shell for the platform mockup. It loads the Next.js static export and adds a
//! native menu (About, Reset demo data, Toggle theme, Zoom). Menu actions are forwarded to
//! the web app as events so the same code serves the browser, Tauri and Electron.

use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_store::Builder::new().build());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::new().build());
    }

    builder
        .setup(|app| {
            let about = AboutMetadataBuilder::new()
                .name(Some("Platform"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .comments(Some("Multi-agency public protection platform (Scotland). Demonstration build with synthetic data only."))
                .build();

            let reset = MenuItemBuilder::with_id("reset-demo", "Reset demo data").build(app)?;
            let theme = MenuItemBuilder::with_id("toggle-theme", "Toggle theme")
                .accelerator("CmdOrCtrl+Shift+T")
                .build(app)?;
            let zoom_in = MenuItemBuilder::with_id("zoom-in", "Zoom in").accelerator("CmdOrCtrl+=").build(app)?;
            let zoom_out = MenuItemBuilder::with_id("zoom-out", "Zoom out").accelerator("CmdOrCtrl+-").build(app)?;
            let zoom_reset = MenuItemBuilder::with_id("zoom-reset", "Actual size").accelerator("CmdOrCtrl+0").build(app)?;

            let app_menu = SubmenuBuilder::new(app, "Platform")
                .item(&PredefinedMenuItem::about(app, Some("About Platform"), Some(about))?)
                .separator()
                .item(&reset)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;
            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&theme)
                .separator()
                .item(&zoom_in)
                .item(&zoom_out)
                .item(&zoom_reset)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;
            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app).items(&[&app_menu, &edit_menu, &view_menu, &window_menu]).build()?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                let id = event.id().0.as_str();
                match id {
                    "reset-demo" | "toggle-theme" | "zoom-in" | "zoom-out" | "zoom-reset" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("mas-menu", id);
                        }
                    }
                    _ => {}
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the platform desktop shell");
}
