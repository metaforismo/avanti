import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { repoRoot, consumeRateLimit, type Database, type operators } from "@avanti/db";
import { hashToken } from "./security";
import { recordActivity } from "./audit-log";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const MFA_PENDING_SECONDS = 300;
export function base32(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function decodeBase32(secret: string): Buffer {
  let bits = 0,
    value = 0;
  const result: number[] = [];
  for (const char of secret) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("Invalid MFA secret");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      result.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(result);
}
export function totp(secret: string, step: number, digits: 6 | 8 = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits)
    .toString()
    .padStart(digits, "0");
}
export function verifyTotp(
  secret: string,
  code: string,
  now: Date,
  lastStep: number | null,
): number | null {
  if (!/^[0-9]{6}$/.test(code)) return null;
  const step = Math.floor(now.getTime() / 30000);
  let matched: number | null = null;
  for (const candidate of [step - 1, step, step + 1]) {
    if (candidate < 0) continue;
    const same = timingSafeEqual(Buffer.from(totp(secret, candidate)), Buffer.from(code));
    if (same && (lastStep === null || candidate > lastStep)) matched = candidate;
  }
  return matched;
}
export function recoveryCodes() {
  const codes = Array.from({ length: 10 }, () =>
    randomBytes(16).toString("hex").match(/.{8}/g)!.join("-"),
  );
  return { codes, hashes: codes.map(recoveryHash) };
}
export const recoveryHash = (code: string) =>
  hashToken(`avanti:mfa:recovery:${code.toLowerCase()}`);
export function recoveryIndex(hashes: string[], code: string): number {
  const provided = Buffer.from(recoveryHash(code), "hex");
  return hashes.findIndex(
    (hash) => /^[a-f0-9]{64}$/.test(hash) && timingSafeEqual(Buffer.from(hash, "hex"), provided),
  );
}
export function parseMfaKey(key: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error("MFA_ENCRYPTION_KEY must contain 64 hexadecimal characters");
  return Buffer.from(key, "hex");
}
export function mfaCipher(options: { key?: string; production?: boolean; localKeyPath?: string }) {
  if (options.production && !options.key)
    throw new Error("MFA_ENCRYPTION_KEY required in production");
  const configured = options.key ? parseMfaKey(options.key) : undefined;
  let pending: Promise<Buffer> | undefined;
  async function localKey() {
    const path = options.localKeyPath ?? resolve(repoRoot, ".data/mfa-encryption.key");
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    // Publish atomically with a hard link: competing processes never read a partially written key.
    const { link, unlink } = await import("node:fs/promises");
    const temporary = `${path}.${randomBytes(12).toString("hex")}`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(randomBytes(32).toString("hex"));
      await file.sync();
      try {
        await link(temporary, path);
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      }
    } finally {
      await file.close();
      await unlink(temporary);
    }
    return parseMfaKey(await readFile(path, "utf8"));
  }
  const key = () =>
    configured
      ? Promise.resolve(configured)
      : (pending ??= localKey().catch((error) => {
          pending = undefined;
          throw error;
        }));
  return {
    async encrypt(secret: string, operatorId: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", await key(), iv);
      cipher.setAAD(Buffer.from(`avanti:mfa:v1:${operatorId}`));
      const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
      return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
    },
    async decrypt(encrypted: string, operatorId: string) {
      const [version, iv, tag, ciphertext] = encrypted.split(":");
      if (
        version !== "v1" ||
        !iv ||
        !tag ||
        !ciphertext ||
        !/^[a-f0-9]{24}$/.test(iv) ||
        !/^[a-f0-9]{32}$/.test(tag) ||
        !/^[a-f0-9]{64}$/.test(ciphertext)
      )
        throw new Error("Invalid MFA ciphertext");
      const decipher = createDecipheriv("aes-256-gcm", await key(), Buffer.from(iv, "hex"));
      decipher.setAAD(Buffer.from(`avanti:mfa:v1:${operatorId}`));
      decipher.setAuthTag(Buffer.from(tag, "hex"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "hex")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

// The operator lock must be held by the caller, so parallel requests cannot consume twice.
export async function consumeMfaCode(
  operator: typeof operators.$inferSelect,
  code: string,
  now: Date,
  cipher: ReturnType<typeof mfaCipher>,
) {
  if (!operator.mfaSecret || !operator.mfaEnabledAt) return null;
  if (/^[0-9]{6}$/.test(code)) {
    const step = verifyTotp(
      await cipher.decrypt(operator.mfaSecret, operator.id),
      code,
      now,
      operator.mfaLastUsedStep,
    );
    return step === null ? null : { mfaLastUsedStep: step };
  }
  const index = recoveryIndex(operator.mfaRecoveryHashes, code);
  return index < 0
    ? null
    : { mfaRecoveryHashes: operator.mfaRecoveryHashes.filter((_, i) => i !== index) };
}
export async function recordMfaFailure(
  db: Database,
  operator: typeof operators.$inferSelect,
  now: Date,
  rateLimited = false,
) {
  const window = await consumeRateLimit(db, `mfa-failed:${hashToken(operator.id)}`, now, 1, 60);
  if (window.allowed)
    await recordActivity(
      db,
      operator.organizationId,
      null,
      "auth.mfa_failed",
      now,
      operator.id,
      rateLimited ? { rateLimited: true } : {},
    );
}
