import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { useAudioRecorder, RecordingResult } from "../hooks/useAudioRecorder";
import Waveform from "./Waveform";
import "./RecordingOverlay.css";

const PILL_SIZE = { w: 300, h: 80 };
const RESULT_SIZE = { w: 420, h: 530 };

const ENRICH_MODES = [
  { id: "grammar", label: "Fix Grammar", icon: "Aa" },
  { id: "formal", label: "Formal", icon: "F" },
  { id: "funnier", label: "Funnier", icon: ")" },
  { id: "concise", label: "Concise", icon: "C" },
  { id: "actions", label: "Actions", icon: "A" },
];

const TRANSLATE_MODES = [
  { id: "translate_it", label: "Italiano", flag: "IT" },
  { id: "translate_en", label: "English", flag: "EN" },
  { id: "translate_fr", label: "Français", flag: "FR" },
];

function RecordingOverlay() {
  const { state, startRecording, stopRecording, reset, analyserRef } =
    useAudioRecorder();
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    text: string;
    originalText: string;
    audioUrl: string;
  } | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);

  // Manual phase tracking independent of React render cycle
  const phaseRef = useRef<"idle" | "recording" | "processing" | "result">("idle");

  const startRef = useRef(startRecording);
  const stopRef = useRef(stopRecording);
  const resetRef = useRef(reset);
  startRef.current = startRecording;
  stopRef.current = stopRecording;
  resetRef.current = reset;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Register event listeners ONCE
  useEffect(() => {
    let unlistenStart: (() => void) | undefined;
    let unlistenStop: (() => void) | undefined;

    const setup = async () => {
      unlistenStart = await listen("start-recording", async () => {
        if (phaseRef.current !== "idle") return;
        phaseRef.current = "recording";
        const win = getCurrentWindow();
        try {
          setError(null);
          setResult(null);
          setSeconds(0);
          setActiveMode(null);
          setEnriching(null);
          await win.setSize(new LogicalSize(PILL_SIZE.w, PILL_SIZE.h));
          await startRef.current();
        } catch (err) {
          phaseRef.current = "idle";
          setError(err instanceof Error ? err.message : "Failed to start");
          setTimeout(() => {
            win.hide();
            resetRef.current();
            setError(null);
          }, 2000);
        }
      });

      unlistenStop = await listen("stop-recording", async () => {
        if (phaseRef.current !== "recording") return;
        phaseRef.current = "processing";
        const win = getCurrentWindow();

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        try {
          const recording: RecordingResult = await stopRef.current();

          const text = await invoke<string>("transcribe_audio", {
            audioData: recording.audioBytes,
          });

          const trimmed = text.trim();
          setResult({
            text: trimmed,
            originalText: trimmed,
            audioUrl: recording.audioBlobUrl,
          });
          phaseRef.current = "result";
          await win.setSize(new LogicalSize(RESULT_SIZE.w, RESULT_SIZE.h));
        } catch (err) {
          console.error("Transcription error:", err);
          setError(err instanceof Error ? err.message : "Transcription failed");
          phaseRef.current = "idle";
          setTimeout(async () => {
            setError(null);
            await win.hide();
            resetRef.current();
          }, 2000);
        }
      });
    };

    setup();
    return () => {
      unlistenStart?.();
      unlistenStop?.();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  async function handleEnrich(mode: string) {
    if (!result?.text || enriching) return;

    if (activeMode === mode) {
      setResult((r) => (r ? { ...r, text: r.originalText } : r));
      setActiveMode(null);
      return;
    }

    setEnriching(mode);
    try {
      const enriched = await invoke<string>("enrich_text", {
        text: result.originalText,
        mode,
      });
      setResult((r) => (r ? { ...r, text: enriched.trim() } : r));
      setActiveMode(mode);
    } catch (err) {
      console.error("Enrich error:", err);
    }
    setEnriching(null);
  }

  async function handlePaste() {
    if (!result?.text) return;
    const win = getCurrentWindow();
    await win.hide();
    await new Promise((r) => setTimeout(r, 150));
    await invoke("paste_text", { text: result.text });
    handleDiscard();
  }

  function handleDiscard() {
    if (result?.audioUrl) URL.revokeObjectURL(result.audioUrl);
    setResult(null);
    setActiveMode(null);
    setEnriching(null);
    reset();
    phaseRef.current = "idle";
    getCurrentWindow().hide();
  }

  // Result view
  if (result) {
    return (
      <div className="result-container">
        <div className="result-card">
          <div className="result-header">
            <div className="result-dot" />
            <span className="result-title">Transcription</span>
            {activeMode && (
              <span className="active-badge">
                {[...ENRICH_MODES, ...TRANSLATE_MODES].find(
                  (m) => m.id === activeMode
                )?.label}
              </span>
            )}
          </div>

          <audio className="audio-player" src={result.audioUrl} controls />

          <div className="result-text">
            {result.text || (
              <span className="empty-text">No speech detected</span>
            )}
          </div>

          <div className="enrich-bar">
            {ENRICH_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`enrich-btn ${activeMode === mode.id ? "active" : ""} ${enriching === mode.id ? "loading" : ""}`}
                onClick={() => handleEnrich(mode.id)}
                disabled={!!enriching || !result.text}
                title={mode.label}
              >
                <span className="enrich-icon">{mode.icon}</span>
                <span className="enrich-label">{mode.label}</span>
              </button>
            ))}
          </div>

          <div className="translate-bar">
            {TRANSLATE_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`translate-btn ${activeMode === mode.id ? "active" : ""} ${enriching === mode.id ? "loading" : ""}`}
                onClick={() => handleEnrich(mode.id)}
                disabled={!!enriching || !result.text}
              >
                <span className="translate-flag">{mode.flag}</span>
                <span className="translate-label">{mode.label}</span>
              </button>
            ))}
          </div>

          <div className="result-actions">
            <button className="btn btn-secondary" onClick={handleDiscard}>
              Discard
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePaste}
              disabled={!result.text || !!enriching}
            >
              Paste
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Recording / processing / error pill
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
            <div className="spinner" />
            <span className="label">Transcribing...</span>
          </>
        )}
        {state === "idle" && error && (
          <>
            <div className="error-dot" />
            <span className="label error-text">{error}</span>
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default RecordingOverlay;
