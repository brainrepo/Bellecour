use crate::config;
use tauri::AppHandle;

fn system_prompt(mode: &str) -> &'static str {
    match mode {
        "grammar" => "\
You are a precise copy editor. Fix all grammar, spelling, and punctuation errors in the user's text. \
Keep the original meaning, tone, and style intact. Only return the corrected text, nothing else.",

        "formal" => "\
You are a professional business writer. Rewrite the user's text in a formal, polished, professional tone \
suitable for executive communication. Keep the same meaning. Only return the rewritten text, nothing else.",

        "funnier" => "\
You are a witty writer. Rewrite the user's text to make it funnier and more entertaining while keeping \
the core message. Add clever wordplay or humor where appropriate. Only return the rewritten text, nothing else.",

        "concise" => "\
You are a ruthless editor. Make the user's text as concise as possible — cut filler words, redundancy, \
and unnecessary qualifiers. Every word must earn its place. Keep the meaning intact. \
Only return the shortened text, nothing else.",

        "actions" => "\
You are a project manager. Extract clear, actionable items from the user's text. \
Format as a bullet list with each item starting with a verb. If there are no clear actions, \
summarize the key takeaways as bullets instead. Only return the bullet list, nothing else.",

        "translate_it" => "\
Translate the user's text into Italian. Preserve the tone and meaning. \
Only return the translated text, nothing else.",

        "translate_en" => "\
Translate the user's text into English. Preserve the tone and meaning. \
Only return the translated text, nothing else.",

        "translate_fr" => "\
Translate the user's text into French. Preserve the tone and meaning. \
Only return the translated text, nothing else.",

        _ => "Rewrite the user's text improving clarity and readability. Only return the result.",
    }
}

#[tauri::command]
pub async fn enrich_text(
    text: String,
    mode: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    let api_key = config::get_api_key(&app_handle)?;
    let prompt = system_prompt(&mode);

    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [
            { "role": "system", "content": prompt },
            { "role": "user", "content": text }
        ],
        "temperature": 0.7
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI error ({}): {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in response".to_string())
}
