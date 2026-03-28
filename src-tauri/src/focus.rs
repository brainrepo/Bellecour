use std::process::Command;
use std::sync::Mutex;

static FRONTMOST_APP: Mutex<String> = Mutex::new(String::new());

/// Save the bundle ID of the currently frontmost application.
/// Called when the global shortcut is first pressed, before the overlay takes focus.
pub fn capture_frontmost_app() {
    let bundle_id = Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to get bundle identifier of first application process whose frontmost is true",
        ])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    eprintln!("[bellecour] captured frontmost app: {:?}", bundle_id);

    if let Ok(mut guard) = FRONTMOST_APP.lock() {
        *guard = bundle_id;
    }
}

/// Activate the previously captured frontmost application via System Events.
/// Uses `set frontmost` which only requires System Events access (no per-app Automation permission).
pub fn restore_frontmost_app() -> Result<(), String> {
    let bundle_id = FRONTMOST_APP
        .lock()
        .ok()
        .and_then(|g| {
            let id = g.clone();
            if id.is_empty() { None } else { Some(id) }
        });

    if let Some(id) = bundle_id {
        eprintln!("[bellecour] restoring focus to: {}", id);
        let output = Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "tell application \"System Events\" to set frontmost of first process whose bundle identifier is \"{}\" to true",
                    id
                ),
            ])
            .output()
            .map_err(|e| format!("osascript error: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            eprintln!("[bellecour] restore focus failed: {}", stderr);
            // Fall back to `open -b` which needs no special permissions
            let _ = Command::new("open").args(["-b", &id]).output();
        }
    } else {
        eprintln!("[bellecour] no frontmost app was captured");
    }

    Ok(())
}
