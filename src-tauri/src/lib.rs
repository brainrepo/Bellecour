mod config;
mod enrich;
mod paste;
mod transcribe;
pub mod usage;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            transcribe::transcribe_audio,
            paste::paste_text,
            enrich::enrich_text,
            usage::get_usage_stats,
            usage::clear_usage,
            config::save_api_key,
            config::load_api_key,
        ])
        .setup(|app| {
            // --- Migrate API key from plaintext store to Keychain ---
            {
                use tauri_plugin_store::StoreExt;
                if let Ok(store) = app.store("settings.json") {
                    if let Some(key) = store.get("api_key").and_then(|v| v.as_str().map(|s| s.to_string())) {
                        if !key.is_empty() {
                            let _ = config::set_api_key(&key);
                            store.delete("api_key");
                            let _ = store.save();
                        }
                    }
                }
            }

            // --- System Tray ---
            let settings_item =
                MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit Bellecour").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .tooltip("Bellecour — Voice to Text")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "settings" => {
                        if let Some(win) = app.get_webview_window("settings") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // --- Global Shortcut: Ctrl+Cmd+B (hold-to-record) ---
            let shortcut = app.global_shortcut().on_shortcut(
                tauri_plugin_global_shortcut::Shortcut::new(
                    Some(Modifiers::CONTROL | Modifiers::SUPER),
                    Code::KeyB,
                ),
                |app, _shortcut, event| {
                    match event.state {
                        ShortcutState::Pressed => {
                            let _ = app.emit("start-recording", ());
                        }
                        ShortcutState::Released => {
                            let _ = app.emit("stop-recording", ());
                        }
                    }
                },
            );

            if let Err(e) = shortcut {
                eprintln!("Failed to register global shortcut: {}", e);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Bellecour");
}
