import { AiIntelligence } from "./ai";
import { loadAiConfig, speechTask, transcriptionLanguageMismatch } from "@avanti/ai";
const config = () =>
  loadAiConfig({
    AI_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "synthetic",
    AI_MAX_ATTEMPTS: "2",
  });
import { expect, it } from "vitest";
import { audioMetadata, sniffAudio } from "./speech-audio";
function wav(seconds: number) {
  const size = Math.floor(seconds * 8000) * 2,
    b = Buffer.alloc(44 + size);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + size, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(size, 40);
  return b;
}
it("reads duration from bytes and refuses forged MIME, oversized, truncated and long recordings", async () => {
  expect(sniffAudio(Buffer.from("%PDF-1.7 not audio"))).toBe(null);
  expect(await audioMetadata(wav(1))).toBe("audio/wav");
  await expect(audioMetadata(wav(61))).rejects.toThrow("InvalidAudio");
  await expect(audioMetadata(Buffer.alloc(2 * 1024 * 1024 + 1))).rejects.toThrow("InvalidAudio");
  await expect(audioMetadata(Buffer.from("RIFF....WAVE"))).rejects.toThrow();
});
it("retries a translated transcript with the audio reserve model and preserves Italian terms", async () => {
  const models: string[] = [];
  const ai = new AiIntelligence({
    config: config(),
    transport: async (r) => {
      models.push(r.model);
      return {
        output: {
          text:
            models.length === 1
              ? "Sono qui e vorrei il mio ISEE"
              : "Soy de España y quiero pedir el ISEE para mi familia",
        },
      };
    },
  });
  const result = await ai.transcribe({
    bytes: new Uint8Array([1]),
    mime: "audio/wav",
    language: "es",
  });
  expect(result.engine).toBe("ai");
  expect(models).toEqual(["google/gemini-3.5-flash-lite", "qwen/qwen3.8-omni-flash"]);
  expect(result.text).toContain("ISEE");
  expect(
    speechTask.system({ bytes: new Uint8Array(), mime: "audio/wav", language: "es" }),
  ).toContain("Never translate");
  expect(transcriptionLanguageMismatch("আমি ISEE করতে চাই", "bn")).toBe(false);
  expect(transcriptionLanguageMismatch("Vorrei fare la pratica", "ar")).toBe(true);
});
it("accepts browser containers without trusting duration metadata", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const [extension, mime] of [
    ["webm", "audio/webm"],
    ["ogg", "audio/ogg"],
    ["m4a", "audio/mp4"],
  ]) {
    const bytes = new Uint8Array(
      await readFile(new URL(`./fixtures/synthetic-audio.${extension}`, import.meta.url)),
    );
    expect(await audioMetadata(bytes)).toBe(mime);
  }
  const long = new Uint8Array(
    await readFile(new URL("./fixtures/synthetic-long-audio.webm", import.meta.url)),
  );
  await expect(audioMetadata(long)).rejects.toThrow("InvalidAudio");
});
