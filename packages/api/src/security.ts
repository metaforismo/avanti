import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ErrorCode } from "@avanti/contracts";

const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
export const newToken = () => randomBytes(32).toString("base64url");
export const hashBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export class ApiFailure extends Error {
  constructor(
    public code: ErrorCode,
    public status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 429 | 500,
    message: string,
  ) {
    super(message);
  }
}
export const notFound = () => new ApiFailure("not_found", 404, "Elemento non trovato.");
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await derive(password, salt);
  return `scrypt:32768:8:1:${salt}:${derived.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hex] = stored.split(":");
  if (
    algorithm !== "scrypt" ||
    n !== "32768" ||
    r !== "8" ||
    p !== "1" ||
    !salt ||
    !hex ||
    !/^[a-f0-9]{128}$/.test(hex)
  )
    return false;
  const derived = await derive(password, salt);
  return timingSafeEqual(derived, Buffer.from(hex, "hex"));
}
export function sanitizeName(name: string): string {
  return (
    name
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f/\\:"<>|?*]/g, "_")
      .slice(0, 150) || "documento"
  );
}
export function sniffMime(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  if (
    b.subarray(4, 8).toString() === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1"].includes(b.subarray(8, 12).toString())
  )
    return "image/heic";
  return null;
}
