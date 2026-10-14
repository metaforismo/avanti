import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { base32, mfaCipher, recoveryCodes, recoveryIndex, totp, verifyTotp } from "./mfa";

const secret = base32(Buffer.from("12345678901234567890"));
it("matches every official RFC 6238 Appendix B SHA-1 vector (8 digits) and its 6 digit truncation", () => {
  for (const [time, expected] of [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ] as const) {
    expect(totp(secret, Math.floor(time / 30), 8)).toBe(expected);
    expect(totp(secret, Math.floor(time / 30))).toBe(expected.slice(-6));
  }
  expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
});
it("accepts only +/- one step and rejects replay, older steps, malformed codes and clock rollback", () => {
  const now = new Date(1234567890000),
    step = Math.floor(now.getTime() / 30000);
  for (const offset of [-1, 0, 1])
    expect(verifyTotp(secret, totp(secret, step + offset), now, null)).toBe(step + offset);
  for (const offset of [-2, 2])
    expect(verifyTotp(secret, totp(secret, step + offset), now, null)).toBeNull();
  expect(verifyTotp(secret, totp(secret, step), now, step)).toBeNull();
  expect(verifyTotp(secret, totp(secret, step - 1), now, step)).toBeNull();
  expect(verifyTotp(secret, totp(secret, step), new Date(now.getTime() - 30000), step)).toBeNull();
  for (const code of ["", "12345", "1234567", "abcdef"])
    expect(verifyTotp(secret, code, now, null)).toBeNull();
});
it("creates ten random 128 bit recovery codes and matches normalized hashes only", () => {
  const recovery = recoveryCodes();
  expect(new Set(recovery.codes).size).toBe(10);
  expect(recovery.hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
  recovery.codes.forEach((code, i) =>
    expect(recoveryIndex(recovery.hashes, code.toUpperCase())).toBe(i),
  );
  expect(recoveryIndex(recovery.hashes, "unknown")).toBe(-1);
});
it("encrypts with fresh IVs and authenticated operator binding; wrong keys and tampering fail", async () => {
  const cipher = mfaCipher({ key: randomBytes(32).toString("hex"), production: true });
  const encrypted = await cipher.encrypt(secret, "a");
  expect(encrypted).not.toContain(secret);
  expect(await cipher.encrypt(secret, "a")).not.toBe(encrypted);
  expect(await cipher.decrypt(encrypted, "a")).toBe(secret);
  await expect(cipher.decrypt(encrypted, "b")).rejects.toThrow();
  await expect(
    mfaCipher({ key: randomBytes(32).toString("hex") }).decrypt(encrypted, "a"),
  ).rejects.toThrow();
  await expect(
    cipher.decrypt(encrypted.slice(0, -1) + (encrypted.endsWith("0") ? "1" : "0"), "a"),
  ).rejects.toThrow();
  expect(() => mfaCipher({ production: true })).toThrow("MFA_ENCRYPTION_KEY");
  expect(() => mfaCipher({ key: "invalid" })).toThrow("MFA_ENCRYPTION_KEY");
});
it("persists a private local key safely across concurrent instances and restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "avanti-mfa-"));
  try {
    const path = join(dir, "key"),
      options = { localKeyPath: path };
    const [a, b] = await Promise.all([
      mfaCipher(options).encrypt(secret, "a"),
      mfaCipher(options).encrypt(secret, "b"),
    ]);
    expect(await mfaCipher(options).decrypt(a, "a")).toBe(secret);
    expect(await mfaCipher(options).decrypt(b, "b")).toBe(secret);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readFile(path, "utf8")).toMatch(/^[a-f0-9]{64}$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
