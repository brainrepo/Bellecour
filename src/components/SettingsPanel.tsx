import { useState, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import "./SettingsPanel.css";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "it", name: "Italiano" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "zh", name: "中文" },
  { code: "ru", name: "Русский" },
  { code: "ar", name: "العربية" },
  { code: "hi", name: "हिन्दी" },
];

function SettingsPanel() {
  const [apiKey, setApiKey] = useState("");
  const [language, setLanguage] = useState("en");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const store = await load("settings.json", { defaults: {}, autoSave: false });
      const savedKey = await store.get<string>("api_key");
      const savedLang = await store.get<string>("language");
      if (savedKey) setApiKey(savedKey);
      if (savedLang) setLanguage(savedLang);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  async function saveSettings() {
    try {
      const store = await load("settings.json", { defaults: {}, autoSave: false });
      await store.set("api_key", apiKey);
      await store.set("language", language);
      await store.save();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div className="logo-mark">B</div>
        <div>
          <h1>Belcour</h1>
          <p className="subtitle">Voice to Text</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Configuration</h2>

        <div className="field">
          <label htmlFor="api-key">OpenAI API Key</label>
          <div className="input-group">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              spellCheck={false}
            />
            <button
              className="toggle-visibility"
              onClick={() => setShowKey(!showKey)}
              type="button"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="hint">
            Get your API key from{" "}
            <span className="link">platform.openai.com</span>
          </p>
        </div>

        <div className="field">
          <label htmlFor="language">Transcription Language</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h2>Usage</h2>
        <div className="shortcut-info">
          <div className="shortcut-row">
            <span className="shortcut-label">Record</span>
            <div className="keys">
              <kbd>⌃</kbd>
              <kbd>⌘</kbd>
              <kbd>B</kbd>
            </div>
          </div>
          <p className="hint">
            Hold the shortcut to record, release to transcribe and paste.
          </p>
        </div>
      </div>

      <div className="settings-footer">
        <button className="save-btn" onClick={saveSettings}>
          {saved ? "Saved ✓" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

export default SettingsPanel;
