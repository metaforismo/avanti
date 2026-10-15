"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@avanti/contracts";
import { ApiRequestError } from "@/lib/api";

export const MAX_RECORDING_SECONDS = 60;

export type VoiceState =
  | { kind: "idle" }
  | { kind: "recording"; seconds: number }
  | { kind: "transcribing" }
  | { kind: "error"; reason: "denied" | "unavailable" | "too_long" | "failed" };

/** Containers browsers can record that the transcription endpoint accepts, best first. */
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function voiceSupported() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Record up to a minute and turn it into text the citizen can still edit before sending. The
 * audio never leaves memory except for the one transcription request; nothing is stored.
 */
export function useVoice(token: string, language: Language) {
  const [state, setState] = useState<VoiceState>({ kind: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const resolveText = useRef<((text: string | null) => void) | null>(null);
  const truncated = useRef(false);

  const cleanup = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setState({ kind: "transcribing" });
      const body = new FormData();
      body.append("audio", blob, `voice.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
      body.append("language", language);
      try {
        const response = await fetch(`/api/c/${encodeURIComponent(token)}/transcribe`, {
          method: "POST",
          body,
          credentials: "same-origin",
        });
        if (response.status === 503) {
          setState({ kind: "error", reason: "unavailable" });
          return null;
        }
        if (!response.ok) throw new ApiRequestError(response.status, "internal", "");
        const { text } = (await response.json()) as { text: string };
        // At the limit the minute is still transcribed; the notice says the rest was cut.
        setState(truncated.current ? { kind: "error", reason: "too_long" } : { kind: "idle" });
        return text.trim() || null;
      } catch {
        setState({ kind: "error", reason: "failed" });
        return null;
      }
    },
    [language, token],
  );

  /** Starts recording; the promise resolves with the transcript when recording stops. */
  const start = useCallback(async (): Promise<string | null> => {
    if (!voiceSupported()) {
      setState({ kind: "error", reason: "unavailable" });
      return null;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState({ kind: "error", reason: "denied" });
      return null;
    }
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.current = media;
    media.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
    const done = new Promise<string | null>((resolve) => (resolveText.current = resolve));
    media.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: media.mimeType || mimeType || "audio/webm" });
      void transcribe(blob).then((text) => resolveText.current?.(text));
    };
    media.start();
    truncated.current = false;
    const startedAt = Date.now();
    setState({ kind: "recording", seconds: 0 });
    timer.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      if (seconds >= MAX_RECORDING_SECONDS) {
        truncated.current = true;
        media.stop();
        return;
      }
      setState({ kind: "recording", seconds });
    }, 250);
    return done;
  }, [cleanup, transcribe]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const reset = useCallback(() => setState({ kind: "idle" }), []);

  return { state, start, stop, reset };
}
