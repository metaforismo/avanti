import { Input, BufferSource, ALL_FORMATS } from "mediabunny";
export function sniffAudio(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes);
  if (b.length < 12) return null;
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE")
    return "audio/wav";
  if (b.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (b.toString("hex", 0, 4) === "1a45dfa3" && b.subarray(0, 128).includes(Buffer.from("webm")))
    return "audio/webm";
  if (
    b.toString("ascii", 4, 8) === "ftyp" &&
    /^(?:M4A |isom|mp4[12]|iso[256])$/.test(b.toString("ascii", 8, 12))
  )
    return "audio/mp4";
  return null;
}
export async function audioMetadata(bytes: Uint8Array): Promise<string> {
  if (bytes.length > 2 * 1024 * 1024) throw new Error("InvalidAudio");
  const mime = sniffAudio(bytes);
  if (!mime) throw new Error("InvalidAudio");
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const [audio, video] = await Promise.all([input.getAudioTracks(), input.getVideoTracks()]);
    if (audio.length !== 1 || video.length) throw new Error("InvalidAudio");
    // Scan packet timestamps: MediaRecorder WebM often omits the container duration.
    const duration = await input.computeDuration(audio, { skipLiveWait: true });
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60)
      throw new Error("InvalidAudio");
    return mime;
  } finally {
    input.dispose();
  }
}
