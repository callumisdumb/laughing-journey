//! Tauri 2 shell for the platform mockup. It loads the Next.js static export and adds a
//! native menu (About, Reset demo data, Toggle theme, Zoom). Menu actions are forwarded to
//! the web app as events so the same code serves the browser, Tauri and Electron.
//!
//! Every menu and About string comes from the message catalogue, embedded at compile time and
//! keyed by the same paths the web app uses; overrides saved from Admin (the store plugin's
//! messages.json) win, so both shells and the app read identically.

use std::collections::HashMap;
use std::sync::OnceLock;

use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

/// The bundled catalogue, packages/messages/src/en-GB.json, at the version this shell was built from.
const CATALOGUE: &str = include_str!("../../../../packages/messages/src/en-GB.json");

fn flatten(value: &serde_json::Value, prefix: &str, out: &mut HashMap<String, String>) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, child) in map {
                let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
                flatten(child, &path, out);
            }
        }
        serde_json::Value::String(text) => {
            out.insert(prefix.to_string(), text.clone());
        }
        _ => {}
    }
}

fn bundled() -> &'static HashMap<String, String> {
    static MESSAGES: OnceLock<HashMap<String, String>> = OnceLock::new();
    MESSAGES.get_or_init(|| {
        let mut out = HashMap::new();
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(CATALOGUE) {
            flatten(&value, "", &mut out);
        }
        out
    })
}

/// The merged messages for this launch: the bundled catalogue with saved overrides applied.
struct Messages {
    overrides: HashMap<String, String>,
}

impl Messages {
    fn load(app: &AppHandle) -> Self {
        let mut overrides = HashMap::new();
        if let Ok(store) = app.store("messages.json") {
            if let Some(serde_json::Value::Object(map)) = store.get("overrides") {
                for (key, value) in map {
                    if let serde_json::Value::String(text) = value {
                        overrides.insert(key, text);
                    }
                }
            }
        }
        Self { overrides }
    }

    /// Look a key up, falling back to the key itself. Shell messages take only simple {name} arguments.
    fn get(&self, key: &str, args: &[(&str, &str)]) -> String {
        let mut text = self
            .overrides
            .get(key)
            .or_else(|| bundled().get(key))
            .cloned()
            .unwrap_or_else(|| key.to_string());
        for (name, value) in args {
            text = text.replace(&format!("{{{name}}}"), value);
        }
        text
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_store::Builder::new().build());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::new().build());
    }

    builder
        .setup(|app| {
            let t = Messages::load(app.handle());
            let app_name = t.get("product.name", &[]);
            let about = AboutMetadataBuilder::new()
                .name(Some(app_name.clone()))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .comments(Some(t.get("desktop.about.credits", &[])))
                .build();

            let reset = MenuItemBuilder::with_id("reset-demo", t.get("desktop.menu.resetDemo", &[])).build(app)?;
            let theme = MenuItemBuilder::with_id("toggle-theme", t.get("desktop.menu.toggleTheme", &[]))
                .accelerator("CmdOrCtrl+Shift+T")
                .build(app)?;
            let zoom_in = MenuItemBuilder::with_id("zoom-in", t.get("desktop.menu.zoomIn", &[])).accelerator("CmdOrCtrl+=").build(app)?;
            let zoom_out = MenuItemBuilder::with_id("zoom-out", t.get("desktop.menu.zoomOut", &[])).accelerator("CmdOrCtrl+-").build(app)?;
            let zoom_reset = MenuItemBuilder::with_id("zoom-reset", t.get("desktop.menu.actualSize", &[])).accelerator("CmdOrCtrl+0").build(app)?;
            let quit_label = if cfg!(target_os = "macos") { t.get("desktop.menu.quit", &[]) } else { t.get("desktop.menu.exit", &[]) };

            let app_menu = SubmenuBuilder::new(app, app_name.clone())
                .item(&PredefinedMenuItem::about(app, Some(&t.get("desktop.about.title", &[("app", app_name.as_str())])), Some(about))?)
                .separator()
                .item(&reset)
                .separator()
                .item(&PredefinedMenuItem::quit(app, Some(&quit_label))?)
                .build()?;
            let view_menu = SubmenuBuilder::new(app, t.get("desktop.menu.view", &[]))
                .item(&theme)
                .separator()
                .item(&zoom_in)
                .item(&zoom_out)
                .item(&zoom_reset)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, Some(&t.get("desktop.menu.fullScreen", &[])))?)
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, t.get("desktop.menu.edit", &[]))
                .item(&PredefinedMenuItem::undo(app, Some(&t.get("desktop.menu.undo", &[])))?)
                .item(&PredefinedMenuItem::redo(app, Some(&t.get("desktop.menu.redo", &[])))?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, Some(&t.get("desktop.menu.cut", &[])))?)
                .item(&PredefinedMenuItem::copy(app, Some(&t.get("desktop.menu.copy", &[])))?)
                .item(&PredefinedMenuItem::paste(app, Some(&t.get("desktop.menu.paste", &[])))?)
                .item(&PredefinedMenuItem::select_all(app, Some(&t.get("desktop.menu.selectAll", &[])))?)
                .build()?;
            let window_menu = SubmenuBuilder::new(app, t.get("desktop.menu.window", &[]))
                .item(&PredefinedMenuItem::minimize(app, Some(&t.get("desktop.menu.minimise", &[])))?)
                .item(&PredefinedMenuItem::close_window(app, Some(&t.get("desktop.menu.close", &[])))?)
                .build()?;

            let menu = MenuBuilder::new(app).items(&[&app_menu, &edit_menu, &view_menu, &window_menu]).build()?;
            app.set_menu(menu)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(&app_name);
            }

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
