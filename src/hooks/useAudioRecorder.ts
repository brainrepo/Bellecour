import { useState, useRef, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";

export type RecorderState = "idle" | "recording" | "processing" | "result";

export interface RecordingResult {
  audioBytes: number[];
  audioBlobUrl: string;
  duration: number;
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async () => {
    // Read selected audio device from settings
    let deviceId: string | undefined;
    try {
      const store = await load("settings.json", { defaults: {}, autoSave: false });
      const saved = await store.get<string>("audio_device");
      if (saved) deviceId = saved;
    } catch { /* use default */ }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;
    chunksRef.current = [];
    startTimeRef.current = Date.now();

    // Analyser for waveform visualization
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.start(250);
    setState("recording");
  }, []);

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        reject(new Error("No active recording"));
        return;
      }

      setState("processing");

      mediaRecorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        analyserRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const duration = (Date.now() - startTimeRef.current) / 1000;

        resolve({
          audioBytes: Array.from(new Uint8Array(arrayBuffer)),
          audioBlobUrl: URL.createObjectURL(blob),
          duration,
        });
      };

      mediaRecorder.onerror = () => reject(new Error("Recording failed"));
      mediaRecorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setState("idle");
  }, []);

  return { state, setState, startRecording, stopRecording, reset, analyserRef };
}
