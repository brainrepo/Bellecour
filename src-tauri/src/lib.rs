mod config;
mod enrich;
mod paste;
mod transcribe;

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
        ])
        .setup(|app| {
            // --- System Tray ---
            let settings_item =
                MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit Belcour").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .tooltip("Belcour — Voice to Text")
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
                            // Show overlay window
                            if let Some(win) = app.get_webview_window("overlay") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
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
        .expect("error while running Belcour");
}
