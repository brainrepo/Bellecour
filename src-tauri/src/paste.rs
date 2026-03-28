use arboard::Clipboard;
use std::thread;
use std::time::Duration;

/// Simulate Cmd+V using CoreGraphics CGEvent API.
/// Requires Accessibility permission for the app (macOS will prompt automatically).
fn simulate_paste() -> Result<(), String> {
    use core_graphics::event::{CGEvent, CGEventFlags, CGKeyCode};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "Failed to create CGEventSource")?;

    // 'v' key = keycode 9 on macOS
    const V_KEY: CGKeyCode = 9;

    let key_down = CGEvent::new_keyboard_event(source.clone(), V_KEY, true)
        .map_err(|_| "Failed to create key down event")?;
    key_down.set_flags(CGEventFlags::CGEventFlagCommand);

    let key_up = CGEvent::new_keyboard_event(source, V_KEY, false)
        .map_err(|_| "Failed to create key up event")?;
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);

    key_down.post(core_graphics::event::CGEventTapLocation::HID);
    // Small gap between key down and key up
    thread::sleep(Duration::from_millis(20));
    key_up.post(core_graphics::event::CGEventTapLocation::HID);

    Ok(())
}

#[tauri::command]
pub fn paste_text(text: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;

    // Write transcribed text to clipboard
    clipboard
        .set_text(&text)
        .map_err(|e| format!("Failed to set clipboard: {}", e))?;

    // Wait for clipboard to be ready, then simulate paste
    thread::sleep(Duration::from_millis(100));
    simulate_paste()?;

    // Don't restore previous clipboard — let the user keep the transcription
    // available for manual paste if the auto-paste didn't land in the right place

    Ok(())
}
