use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub fn get_api_key(app: &AppHandle) -> Result<String, String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store
        .get("api_key")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or_else(|| "API key not configured. Open Settings from the tray menu.".to_string())
}

pub fn get_language(app: &AppHandle) -> String {
    let store = app.store("settings.json").ok();
    store
        .and_then(|s| s.get("language"))
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "en".to_string())
}
