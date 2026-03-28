import { useState, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { Mic, Sparkles, Languages, Trash2, Plus, RotateCcw, X } from "lucide-react";
import { Transformation, DEFAULT_TRANSFORMATIONS, KNOWN_ICONS } from "../transformations";
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

interface UsageStats {
  total_cost: number;
  transcription_cost: number;
  enrich_cost: number;
  translate_cost: number;
  total_calls: number;
  total_audio_minutes: number;
  recent: {
    timestamp: string;
    kind: string;
    mode: string | null;
    cost_usd: number;
    audio_seconds: number;
  }[];
}

function SettingsPanel() {
  const [apiKey, setApiKey] = useState("");
  const [language, setLanguage] = useState("en");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [transformations, setTransformations] = useState<Transformation[]>(DEFAULT_TRANSFORMATIONS);
  const [expandedTransform, setExpandedTransform] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadUsage();
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      // Need to request mic permission first so device labels are populated
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) =>
        s.getTracks().forEach((t) => t.stop())
      );
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
    }
  }

  async function loadSettings() {
    try {
      // Load API key from macOS Keychain
      const key = await invoke<string>("load_api_key").catch(() => "");
      if (key) setApiKey(key);

      // Load other settings from store
      const store = await load("settings.json", { defaults: {}, autoSave: false });
      const savedLang = await store.get<string>("language");
      const savedDevice = await store.get<string>("audio_device");
      const savedTransforms = await store.get<Transformation[]>("transformations");
      if (savedLang) setLanguage(savedLang);
      if (savedDevice) setSelectedDevice(savedDevice);
      if (savedTransforms && savedTransforms.length > 0) setTransformations(savedTransforms);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  async function loadUsage() {
    try {
      const stats = await invoke<UsageStats>("get_usage_stats");
      setUsage(stats);
    } catch (err) {
      console.error("Failed to load usage:", err);
    }
  }

  async function saveSettings() {
    try {
      // Save API key to macOS Keychain
      if (apiKey) await invoke("save_api_key", { key: apiKey });

      // Save other settings to store
      const store = await load("settings.json", { defaults: {}, autoSave: false });
      await store.set("language", language);
      await store.set("audio_device", selectedDevice);
      await store.set("transformations", transformations);
      await store.save();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }

  async function handleClearUsage() {
    await invoke("clear_usage");
    loadUsage();
  }

  function formatCost(usd: number) {
    return usd < 0.01 ? `<$0.01` : `$${usd.toFixed(3)}`;
  }

  function formatDate(ts: string) {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts.slice(0, 16);
    }
  }

  function updateTransform(id: string, updates: Partial<Transformation>) {
    setTransformations((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }

  function removeTransform(id: string) {
    setTransformations((prev) => prev.filter((t) => t.id !== id));
    if (expandedTransform === id) setExpandedTransform(null);
  }

  function addTransform() {
    const newT: Transformation = {
      id: `custom-${Date.now()}`,
      label: "",
      icon: "",
      prompt: "",
    };
    setTransformations((prev) => [...prev, newT]);
    setExpandedTransform(newT.id);
  }

  function resetTransforms() {
    setTransformations(DEFAULT_TRANSFORMATIONS);
    setExpandedTransform(null);
  }

  function moveTransform(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= transformations.length) return;
    setTransformations((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function kindLabel(kind: string, mode: string | null) {
    if (kind === "transcription") return "Transcription";
    if (mode?.startsWith("translate_")) return `Translate → ${mode.replace("translate_", "").toUpperCase()}`;
    return mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : "Enrich";
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div className="logo-mark">B</div>
        <div>
          <h1>Bellecour</h1>
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
            <button className="toggle-visibility" onClick={() => setShowKey(!showKey)} type="button">
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="hint">
            Get your API key from <span className="link">platform.openai.com</span>
          </p>
        </div>
        <div className="field">
          <label htmlFor="language">Transcription Language</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h2>Audio Input</h2>
        <div className="field">
          <label htmlFor="audio-device">Microphone</label>
          <select
            id="audio-device"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            <option value="">System Default</option>
            {audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone (${d.deviceId.slice(0, 8)}...)`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-section">
        <div className="transforms-header">
          <h2>Transformations</h2>
          <button className="clear-btn" onClick={resetTransforms} title="Reset to defaults">
            <RotateCcw size={12} />
          </button>
        </div>
        <p className="hint">
          Customize the text transformations shown after transcription. Keys 1–9 trigger them.
        </p>
        <div className="transforms-list">
          {transformations.map((t, i) => (
            <div key={t.id} className={`transform-card ${expandedTransform === t.id ? "expanded" : ""}`}>
              <div className="transform-summary" onClick={() => setExpandedTransform(expandedTransform === t.id ? null : t.id)}>
                <div className="transform-order">
                  <button
                    className="move-btn"
                    onClick={(e) => { e.stopPropagation(); moveTransform(i, -1); }}
                    disabled={i === 0}
                    title="Move up"
                  >&#8593;</button>
                  <span className="transform-number">{i < 9 ? i + 1 : ""}</span>
                  <button
                    className="move-btn"
                    onClick={(e) => { e.stopPropagation(); moveTransform(i, 1); }}
                    disabled={i === transformations.length - 1}
                    title="Move down"
                  >&#8595;</button>
                </div>
                <span className="transform-icon-preview">{t.icon || "?"}</span>
                <span className="transform-label-preview">{t.label || "Untitled"}</span>
                <button
                  className="transform-delete"
                  onClick={(e) => { e.stopPropagation(); removeTransform(t.id); }}
                  title="Delete"
                >
                  <X size={12} />
                </button>
              </div>
              {expandedTransform === t.id && (
                <div className="transform-details">
                  <div className="transform-row">
                    <div className="field transform-field-icon">
                      <label>Icon</label>
                      <input
                        type="text"
                        value={t.icon}
                        onChange={(e) => updateTransform(t.id, { icon: e.target.value })}
                        placeholder="e.g. star"
                        maxLength={20}
                      />
                      <p className="hint">
                        Icon name ({KNOWN_ICONS.slice(0, 6).join(", ")}...) or any text
                      </p>
                    </div>
                    <div className="field transform-field-label">
                      <label>Label</label>
                      <input
                        type="text"
                        value={t.label}
                        onChange={(e) => updateTransform(t.id, { label: e.target.value })}
                        placeholder="Display name"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Prompt</label>
                    <textarea
                      className="transform-prompt"
                      value={t.prompt}
                      onChange={(e) => updateTransform(t.id, { prompt: e.target.value })}
                      placeholder="System prompt sent to the AI model..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="add-transform-btn" onClick={addTransform}>
          <Plus size={14} />
          <span>Add Transformation</span>
        </button>
      </div>

      <div className="settings-section">
        <h2>Shortcut</h2>
        <div className="shortcut-row">
          <span className="shortcut-label">Record</span>
          <div className="keys">
            <kbd>⌃</kbd><kbd>⌘</kbd><kbd>B</kbd>
          </div>
        </div>
        <p className="hint">Hold to record, release to transcribe and paste.</p>
      </div>

      {usage && (
        <div className="settings-section">
          <div className="usage-header">
            <h2>API Usage</h2>
            <button className="clear-btn" onClick={handleClearUsage} title="Clear history">
              <Trash2 size={12} />
            </button>
          </div>

          <div className="usage-grid">
            <div className="usage-card total">
              <span className="usage-value">{formatCost(usage.total_cost)}</span>
              <span className="usage-label">Total</span>
            </div>
            <div className="usage-card">
              <Mic size={12} />
              <span className="usage-value">{formatCost(usage.transcription_cost)}</span>
              <span className="usage-label">{usage.total_audio_minutes.toFixed(1)} min</span>
            </div>
            <div className="usage-card">
              <Sparkles size={12} />
              <span className="usage-value">{formatCost(usage.enrich_cost)}</span>
              <span className="usage-label">Enrich</span>
            </div>
            <div className="usage-card">
              <Languages size={12} />
              <span className="usage-value">{formatCost(usage.translate_cost)}</span>
              <span className="usage-label">Translate</span>
            </div>
          </div>

          {usage.recent.length > 0 && (
            <div className="usage-history">
              {usage.recent.map((entry, i) => (
                <div className="history-row" key={i}>
                  <span className="history-kind">{kindLabel(entry.kind, entry.mode)}</span>
                  <span className="history-cost">{formatCost(entry.cost_usd)}</span>
                  <span className="history-date">{formatDate(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="settings-footer">
        <button className="save-btn" onClick={saveSettings}>
          {saved ? "Saved ✓" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

export default SettingsPanel;
