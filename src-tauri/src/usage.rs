use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// Pricing (USD) — updated March 2026
const WHISPER_PER_MINUTE: f64 = 0.006;
const GPT4O_MINI_INPUT_PER_1M: f64 = 0.15;
const GPT4O_MINI_OUTPUT_PER_1M: f64 = 0.60;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UsageEntry {
    pub timestamp: String,
    pub kind: String,         // "transcription" | "enrich" | "translate"
    pub mode: Option<String>, // e.g. "grammar", "translate_it"
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub audio_seconds: f64,
    pub cost_usd: f64,
}

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct UsageLog {
    pub entries: Vec<UsageEntry>,
}

fn usage_path(app: &AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().expect("no app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("usage.json")
}

fn load_log(app: &AppHandle) -> UsageLog {
    let path = usage_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        UsageLog::default()
    }
}

fn save_log(app: &AppHandle, log: &UsageLog) {
    let path = usage_path(app);
    if let Ok(data) = serde_json::to_string_pretty(log) {
        let _ = fs::write(&path, data);
    }
}

/// Log a Whisper transcription call
pub fn log_transcription(app: &AppHandle, audio_seconds: f64) {
    let cost = (audio_seconds / 60.0) * WHISPER_PER_MINUTE;
    let entry = UsageEntry {
        timestamp: chrono_now(),
        kind: "transcription".into(),
        mode: None,
        input_tokens: 0,
        output_tokens: 0,
        audio_seconds,
        cost_usd: cost,
    };
    let mut log = load_log(app);
    log.entries.push(entry);
    save_log(app, &log);
}

/// Log a ChatGPT enrichment/translation call
pub fn log_enrichment(
    app: &AppHandle,
    mode: &str,
    input_tokens: u64,
    output_tokens: u64,
) {
    let cost = (input_tokens as f64 / 1_000_000.0) * GPT4O_MINI_INPUT_PER_1M
        + (output_tokens as f64 / 1_000_000.0) * GPT4O_MINI_OUTPUT_PER_1M;

    let kind = if mode.starts_with("translate_") {
        "translate"
    } else {
        "enrich"
    };

    let entry = UsageEntry {
        timestamp: chrono_now(),
        kind: kind.into(),
        mode: Some(mode.into()),
        input_tokens,
        output_tokens,
        audio_seconds: 0.0,
        cost_usd: cost,
    };
    let mut log = load_log(app);
    log.entries.push(entry);
    save_log(app, &log);
}

fn chrono_now() -> String {
    // Simple ISO timestamp without external crate
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Format as readable timestamp
    let secs = now % 60;
    let mins = (now / 60) % 60;
    let hours = (now / 3600) % 24;
    let days = now / 86400;
    // Approximate date from epoch days
    let (year, month, day) = epoch_days_to_date(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, mins, secs
    )
}

fn epoch_days_to_date(mut days: u64) -> (u64, u64, u64) {
    // Simplified Gregorian date from epoch days
    let mut year = 1970;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let months = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1;
    for m in months {
        if days < m {
            break;
        }
        days -= m;
        month += 1;
    }
    (year, month, days + 1)
}

fn is_leap(y: u64) -> bool {
    y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)
}

// ── Tauri commands ──

#[derive(Serialize)]
pub struct UsageStats {
    pub total_cost: f64,
    pub transcription_cost: f64,
    pub enrich_cost: f64,
    pub translate_cost: f64,
    pub total_calls: usize,
    pub total_audio_minutes: f64,
    pub recent: Vec<UsageEntry>,
}

#[tauri::command]
pub fn get_usage_stats(app_handle: AppHandle) -> UsageStats {
    let log = load_log(&app_handle);

    let total_cost: f64 = log.entries.iter().map(|e| e.cost_usd).sum();
    let transcription_cost: f64 = log
        .entries
        .iter()
        .filter(|e| e.kind == "transcription")
        .map(|e| e.cost_usd)
        .sum();
    let enrich_cost: f64 = log
        .entries
        .iter()
        .filter(|e| e.kind == "enrich")
        .map(|e| e.cost_usd)
        .sum();
    let translate_cost: f64 = log
        .entries
        .iter()
        .filter(|e| e.kind == "translate")
        .map(|e| e.cost_usd)
        .sum();
    let total_audio_minutes: f64 = log
        .entries
        .iter()
        .map(|e| e.audio_seconds)
        .sum::<f64>()
        / 60.0;

    // Last 20 entries, newest first
    let recent: Vec<UsageEntry> = log
        .entries
        .iter()
        .rev()
        .take(20)
        .cloned()
        .collect();

    UsageStats {
        total_cost,
        transcription_cost,
        enrich_cost,
        translate_cost,
        total_calls: log.entries.len(),
        total_audio_minutes,
        recent,
    }
}

#[tauri::command]
pub fn clear_usage(app_handle: AppHandle) {
    save_log(&app_handle, &UsageLog::default());
}
