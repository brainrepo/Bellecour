use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut};

static REGISTERED: Mutex<Vec<Shortcut>> = Mutex::new(Vec::new());

#[derive(Clone, Serialize)]
struct ShortcutPayload {
    action: String,
}

fn action_for_code(code: Code) -> &'static str {
    match code {
        Code::Digit1 => "enrich:1",
        Code::Digit2 => "enrich:2",
        Code::Digit3 => "enrich:3",
        Code::Digit4 => "enrich:4",
        Code::Digit5 => "enrich:5",
        Code::Digit6 => "enrich:6",
        Code::Digit7 => "enrich:7",
        Code::Digit8 => "enrich:8",
        Code::Digit9 => "enrich:9",
        Code::Enter => "paste",
        Code::Escape => "discard",
        Code::Digit0 | Code::Backspace => "revert",
        _ => "",
    }
}

const RESULT_KEYS: &[Code] = &[
    Code::Digit1,
    Code::Digit2,
    Code::Digit3,
    Code::Digit4,
    Code::Digit5,
    Code::Digit6,
    Code::Digit7,
    Code::Digit8,
    Code::Digit9,
    Code::Digit0,
    Code::Enter,
    Code::Escape,
    Code::Backspace,
];

#[tauri::command]
pub fn register_result_shortcuts(app_handle: AppHandle) -> Result<(), String> {
    // Guard: unregister first if already registered
    let _ = do_unregister(&app_handle);

    let mut registered = Vec::new();

    for &code in RESULT_KEYS {
        let shortcut = Shortcut::new(None, code);
        let action = action_for_code(code);

        let result = app_handle.global_shortcut().on_shortcut(shortcut, {
            let action = action.to_string();
            move |app, _shortcut, event| {
                if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    let _ = app.emit(
                        "shortcut-action",
                        ShortcutPayload {
                            action: action.clone(),
                        },
                    );
                }
            }
        });

        match result {
            Ok(()) => registered.push(shortcut),
            Err(e) => eprintln!("Failed to register shortcut {:?}: {}", code, e),
        }
    }

    if let Ok(mut guard) = REGISTERED.lock() {
        *guard = registered;
    }

    Ok(())
}

#[tauri::command]
pub fn unregister_result_shortcuts(app_handle: AppHandle) -> Result<(), String> {
    do_unregister(&app_handle);
    Ok(())
}

fn do_unregister(app: &AppHandle) {
    if let Ok(mut guard) = REGISTERED.lock() {
        for shortcut in guard.drain(..) {
            let _ = app.global_shortcut().unregister(shortcut);
        }
    }
}
