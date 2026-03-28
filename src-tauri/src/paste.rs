use arboard::Clipboard;
use std::process::Command;
use std::thread;
use std::time::Duration;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> u8;
}

fn is_accessibility_trusted() -> bool {
    unsafe { AXIsProcessTrusted() != 0 }
}

/// Simulate Cmd+V via System Events keystroke.
/// Requires Accessibility permission — checked by caller before invoking.
fn simulate_paste() -> Result<(), String> {
    let output = Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to keystroke \"v\" using command down",
        ])
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Paste keystroke failed: {}", stderr));
    }

    Ok(())
}

#[tauri::command]
pub fn paste_text(text: String) -> Result<(), String> {
    if !is_accessibility_trusted() {
        return Err(
            "Bellecour needs Accessibility permission to paste. \
             Open System Settings → Privacy & Security → Accessibility and enable Bellecour."
                .to_string(),
        );
    }

    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;

    clipboard
        .set_text(&text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;

    // Restore focus to the app that was frontmost when recording started
    crate::focus::restore_frontmost_app()?;
    thread::sleep(Duration::from_millis(300));
    simulate_paste()?;

    Ok(())
}
