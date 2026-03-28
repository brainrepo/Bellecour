use security_framework::passwords::{delete_generic_password, get_generic_password, set_generic_password};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const KEYCHAIN_SERVICE: &str = "dev.brainrepo.bellecour";
const KEYCHAIN_ACCOUNT: &str = "openai-api-key";

pub fn get_api_key(_app: &AppHandle) -> Result<String, String> {
    let bytes = get_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|_| "API key not configured. Open Settings from the tray menu.".to_string())?;
    String::from_utf8(bytes.to_vec())
        .map_err(|_| "Invalid API key in Keychain".to_string())
}

pub fn set_api_key(key: &str) -> Result<(), String> {
    // Delete first to avoid "duplicate item" errors
    let _ = delete_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    set_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, key.as_bytes())
        .map_err(|e| format!("Failed to save to Keychain: {}", e))
}

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    set_api_key(&key)
}

#[tauri::command]
pub fn load_api_key() -> Result<String, String> {
    let bytes = get_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|_| "not_found".to_string())?;
    String::from_utf8(bytes.to_vec())
        .map_err(|_| "Invalid key".to_string())
}

pub fn get_language(app: &AppHandle) -> String {
    let store = app.store("settings.json").ok();
    store
        .and_then(|s| s.get("language"))
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "en".to_string())
}
