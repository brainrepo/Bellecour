import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import {
  SpellCheck,
  Briefcase,
  Smile,
  Scissors,
  ListChecks,
  Type,
  Pen,
  Zap,
  Star,
  Heart,
  Globe,
  MessageSquare,
  FileText,
  Coffee,
  Hash,
  AtSign,
  BookOpen,
  Wand2,
  Layers,
  Target,
  X,
  ClipboardPaste,
  Loader2,
  Mic,
  AlertCircle,
} from "lucide-react";
import { useAudioRecorder, RecordingResult } from "../hooks/useAudioRecorder";
import { Transformation, DEFAULT_TRANSFORMATIONS } from "../transformations";
import Waveform from "./Waveform";
import "./RecordingOverlay.css";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  spellcheck: SpellCheck,
  briefcase: Briefcase,
  smile: Smile,
  scissors: Scissors,
  "list-checks": ListChecks,
  type: Type,
  pen: Pen,
  zap: Zap,
  star: Star,
  heart: Heart,
  globe: Globe,
  "message-square": MessageSquare,
  "file-text": FileText,
  coffee: Coffee,
  hash: Hash,
  "at-sign": AtSign,
  book: BookOpen,
  wand: Wand2,
  layers: Layers,
  target: Target,
};

const IDLE_SIZE = { w: 64, h: 34 };
const PILL_SIZE = { w: 300, h: 80 };
const RESULT_SIZE = { w: 400, h: 500 };

const ICON_SIZE = 14;

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "it", label: "IT" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "de", label: "DE" },
  { code: "pt", label: "PT" },
  { code: "ja", label: "JA" },
  { code: "zh", label: "ZH" },
];


function RecordingOverlay() {
  const { state, startRecording, stopRecording, reset, analyserRef } =
    useAudioRecorder();
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState("en");
  const [langOpen, setLangOpen] = useState(false);
  const [result, setResult] = useState<{
    text: string;
    originalText: string;
    audioUrl: string;
  } | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [transformations, setTransformations] = useState<Transformation[]>(DEFAULT_TRANSFORMATIONS);

  const phaseRef = useRef<"idle" | "recording" | "processing" | "result">("idle");
  const startRef = useRef(startRecording);
  const stopRef = useRef(stopRecording);
  const resetRef = useRef(reset);
  startRef.current = startRecording;
  stopRef.current = stopRecording;
  resetRef.current = reset;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load("settings.json", { defaults: {}, autoSave: false }).then((store) => {
      store.get<string>("language").then((saved) => {
        if (saved) setLang(saved);
      });
      store.get<Transformation[]>("transformations").then((saved) => {
        if (saved && saved.length > 0) setTransformations(saved);
      });
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const phase = phaseRef.current;
      if (phase === "result") {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9 && !e.metaKey && !e.ctrlKey) {
          const t = transformations[num - 1];
          if (t) { e.preventDefault(); handleEnrich(t.id); }
          return;
        }
        if (e.key === "Enter") { e.preventDefault(); handlePaste(); return; }
        if (e.key === "Escape") { e.preventDefault(); handleDiscard(); return; }
        if (e.key === "0" || e.key === "Backspace") {
          e.preventDefault();
          if (activeMode) {
            setResult((r) => (r ? { ...r, text: r.originalText } : r));
            setActiveMode(null);
          }
          return;
        }
        return;
      }
      if (phase === "idle" && langOpen) {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < LANGUAGES.length) { e.preventDefault(); selectLang(LANGUAGES[idx].code); return; }
        if (e.key === "Escape") { e.preventDefault(); setLangOpen(false); goIdle(); return; }
        return;
      }
      if (phase === "idle" && !langOpen) {
        if (e.key === "l" || e.key === "L") { e.preventDefault(); cycleLang(); return; }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  async function goIdle() {
    await getCurrentWindow().setSize(new LogicalSize(IDLE_SIZE.w, IDLE_SIZE.h));
  }

  useEffect(() => {
    let unlistenStart: (() => void) | undefined;
    let unlistenStop: (() => void) | undefined;
    const setup = async () => {
      unlistenStart = await listen("start-recording", async () => {
        if (phaseRef.current !== "idle") return;
        phaseRef.current = "recording";
        const win = getCurrentWindow();
        try {
          await invoke("unregister_result_shortcuts").catch(() => {});
          setError(null); setResult(null); setSeconds(0);
          setActiveMode(null); setEnriching(null); setLangOpen(false);
          await win.setSize(new LogicalSize(PILL_SIZE.w, PILL_SIZE.h));
          await startRef.current();
        } catch (err) {
          phaseRef.current = "idle";
          setError(err instanceof Error ? err.message : "Failed to start");
          setTimeout(() => { resetRef.current(); setError(null); goIdle(); }, 2000);
        }
      });
      unlistenStop = await listen("stop-recording", async () => {
        if (phaseRef.current !== "recording") return;
        phaseRef.current = "processing";
        const win = getCurrentWindow();
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        try {
          const recording: RecordingResult = await stopRef.current();
          const text = await invoke<string>("transcribe_audio", {
            audioData: recording.audioBytes,
            audioDuration: recording.duration,
          });
          const trimmed = text.trim();
          setResult({ text: trimmed, originalText: trimmed, audioUrl: recording.audioBlobUrl });
          phaseRef.current = "result";
          await win.setSize(new LogicalSize(RESULT_SIZE.w, RESULT_SIZE.h));
          await invoke("register_result_shortcuts").catch(() => {});
        } catch (err) {
          console.error("Transcription error:", err);
          setError(err instanceof Error ? err.message : "Transcription failed");
          phaseRef.current = "idle";
          setTimeout(async () => { setError(null); resetRef.current(); goIdle(); }, 2000);
        }
      });
    };
    setup();
    return () => { unlistenStart?.(); unlistenStop?.(); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Listen for global shortcut actions (work without overlay focus)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await listen<{ action: string }>("shortcut-action", (event) => {
        if (phaseRef.current !== "result") return;
        const { action } = event.payload;
        if (action === "paste") { handlePaste(); return; }
        if (action === "discard") { handleDiscard(); return; }
        if (action === "revert") {
          if (activeMode) {
            setResult((r) => (r ? { ...r, text: r.originalText } : r));
            setActiveMode(null);
          }
          return;
        }
        if (action.startsWith("enrich:")) {
          const idx = parseInt(action.split(":")[1]) - 1;
          const t = transformations[idx];
          if (t) handleEnrich(t.id);
        }
      });
    };
    setup();
    return () => unlisten?.();
  });

  useEffect(() => {
    if (state === "recording") timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [state]);

  async function cycleLang() {
    const idx = LANGUAGES.findIndex((l) => l.code === lang);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
    setLang(next.code);
    const store = await load("settings.json", { defaults: {}, autoSave: false });
    await store.set("language", next.code);
    await store.save();
  }

  async function selectLang(code: string) {
    setLang(code); setLangOpen(false);
    const store = await load("settings.json", { defaults: {}, autoSave: false });
    await store.set("language", code);
    await store.save();
    await getCurrentWindow().setSize(new LogicalSize(IDLE_SIZE.w, IDLE_SIZE.h));
  }

  async function handleEnrich(mode: string) {
    if (!result?.text || enriching || !mode) return;
    if (activeMode === mode) {
      setResult((r) => (r ? { ...r, text: r.originalText } : r));
      setActiveMode(null);
      return;
    }
    setEnriching(mode);
    try {
      const t = transformations.find((tr) => tr.id === mode);
      const enriched = await invoke<string>("enrich_text", {
        text: result.originalText,
        mode,
        prompt: t?.prompt,
      });
      setResult((r) => (r ? { ...r, text: enriched.trim() } : r));
      setActiveMode(mode);
    } catch (err) { console.error("Enrich error:", err); }
    setEnriching(null);
  }

  async function handlePaste() {
    if (!result?.text || phaseRef.current !== "result") return;
    phaseRef.current = "idle";
    const textToPaste = result.text;
    await invoke("unregister_result_shortcuts").catch(() => {});
    // Clean up state
    if (result?.audioUrl) URL.revokeObjectURL(result.audioUrl);
    setResult(null); setActiveMode(null); setEnriching(null);
    reset();
    // Hide overlay so the target app can receive focus and the paste keystroke
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(IDLE_SIZE.w, IDLE_SIZE.h));
    await win.hide();
    try {
      await invoke("paste_text", { text: textToPaste });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Paste failed:", msg);
      setError(msg);
      await win.setSize(new LogicalSize(PILL_SIZE.w, PILL_SIZE.h));
      await win.show();
      setTimeout(() => { setError(null); goIdle(); }, 5000);
      return;
    }
    // Let the paste land before restoring the always-on-top overlay,
    // otherwise win.show() steals focus via makeKeyAndOrderFront:
    await new Promise(resolve => setTimeout(resolve, 200));
    await win.show();
  }

  async function handleDiscard() {
    await invoke("unregister_result_shortcuts").catch(() => {});
    if (result?.audioUrl) URL.revokeObjectURL(result.audioUrl);
    setResult(null); setActiveMode(null); setEnriching(null);
    reset(); phaseRef.current = "idle"; goIdle();
  }

  // ── Result view ──
  if (result) {
    return (
      <div className="result-container">
        <div className="result-card">
          <div className="result-header">
            <div className="result-dot" />
            <span className="result-title">Transcription</span>
            {activeMode && (
              <span className="active-badge">
                {transformations.find((m) => m.id === activeMode)?.label}
              </span>
            )}
          </div>

          <audio className="audio-player" src={result.audioUrl} controls />

          <textarea
            className="result-text"
            value={result.text}
            onChange={(e) => setResult((r) => r ? { ...r, text: e.target.value } : r)}
            placeholder="No speech detected"
            spellCheck={false}
          />

          <div className="toolbar-row">
            {transformations.map((t, i) => {
              const IconComp = ICON_MAP[t.icon];
              return (
                <button
                  key={t.id}
                  className={`tool-btn ${activeMode === t.id ? "active" : ""} ${enriching === t.id ? "loading" : ""}`}
                  onClick={() => handleEnrich(t.id)}
                  disabled={!!enriching || !result.text}
                  title={t.label}
                >
                  {enriching === t.id
                    ? <Loader2 size={ICON_SIZE} className="spin" />
                    : IconComp
                      ? <IconComp size={ICON_SIZE} />
                      : <span className="tool-flag">{t.icon}</span>}
                  {i < 9 && <span className="tool-hint">{i + 1}</span>}
                </button>
              );
            })}
          </div>

          <div className="result-actions">
            <button className="btn btn-secondary" onClick={handleDiscard} title="Discard (Esc)">
              <X size={14} />
              <span>Discard</span>
            </button>
            <button className="btn btn-primary" onClick={handlePaste} disabled={!result.text || !!enriching} title="Paste (Enter)">
              <ClipboardPaste size={14} />
              <span>Paste</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Recording / processing pill ──
  if (state === "recording" || state === "processing" || error) {
    return (
      <div className="overlay-container">
        <div className={`overlay-pill ${state}`}>
          {state === "recording" && (
            <>
              <div className="recording-dot" />
              <Waveform analyser={analyserRef.current} />
              <span className="elapsed">{formatTime(seconds)}</span>
            </>
          )}
          {state === "processing" && (
            <>
              <Loader2 size={14} className="spin" style={{ color: "var(--spinner-head)" }} />
              <span className="label">Transcribing...</span>
            </>
          )}
          {error && (
            <>
              <AlertCircle size={14} style={{ color: "var(--yellow)" }} />
              <span className="label error-text">{error}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Idle mini pill ──
  return (
    <div className="idle-container">
      {langOpen ? (
        <div className="lang-picker">
          {LANGUAGES.map((l) => (
            <button key={l.code} className={`lang-option ${l.code === lang ? "active" : ""}`} onClick={() => selectLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      ) : (
        <button className="idle-pill" onClick={cycleLang} onContextMenu={(e) => { e.preventDefault(); setLangOpen(true); getCurrentWindow().setSize(new LogicalSize(200, 42)); }}>
          <Mic size={10} />
          <span className="idle-lang">{LANGUAGES.find((l) => l.code === lang)?.label}</span>
        </button>
      )}
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default RecordingOverlay;
