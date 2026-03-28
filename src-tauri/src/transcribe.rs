use crate::config;
use reqwest::multipart;
use tauri::AppHandle;

#[tauri::command]
pub async fn transcribe_audio(
    audio_data: Vec<u8>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let api_key = config::get_api_key(&app_handle)?;
    let language = config::get_language(&app_handle);

    let file_part = multipart::Part::bytes(audio_data)
        .file_name("audio.webm")
        .mime_str("audio/webm")
        .map_err(|e| e.to_string())?;

    let mut form = multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-1");

    if !language.is_empty() {
        form = form.text("language", language);
    }

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Whisper API error ({}): {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    json["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No text in response".to_string())
}
