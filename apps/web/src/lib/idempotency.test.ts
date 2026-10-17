import { describe, expect, it, vi } from "vitest";
import { IdempotencyKey } from "@avanti/contracts";
import { createRetryKeys, newIdempotencyKey, withRetryKey } from "./idempotency";

describe("retry keys", () => {
  it("reuse the key while the same action fails, and start over after it succeeds", async () => {
    const keys = createRetryKeys();
    const seen: string[] = [];
    const failing = vi.fn(async (headers: Record<string, string>) => {
      seen.push(headers["Idempotency-Key"]!);
      throw new Error("network");
    });
    await expect(withRetryKey(keys, "send", { text: "sì" }, failing)).rejects.toThrow();
    await expect(withRetryKey(keys, "send", { text: "sì" }, failing)).rejects.toThrow();
    expect(seen[0]).toBe(seen[1]);
    await withRetryKey(keys, "send", { text: "sì" }, async (h) => seen.push(h["Idempotency-Key"]!));
    expect(seen[2]).toBe(seen[0]);
    await withRetryKey(keys, "send", { text: "sì" }, async (h) => seen.push(h["Idempotency-Key"]!));
    expect(seen[3]).not.toBe(seen[0]);
  });

  it("forget a failed action once another one succeeds or the state is reloaded", async () => {
    const keys = createRetryKeys();
    const lost = keys.key("send", { text: "sì" });
    await withRetryKey(keys, "send", { text: "no" }, async () => null);
    expect(keys.key("send", { text: "sì" })).not.toBe(lost);
    const again = keys.key("send", { text: "sì" });
    keys.clear();
    expect(keys.key("send", { text: "sì" })).not.toBe(again);
  });

  it("give different actions or payloads different keys", () => {
    const keys = createRetryKeys();
    expect(keys.key("send", { text: "a" })).not.toBe(keys.key("send", { text: "b" }));
    expect(keys.key("send", { text: "a" })).not.toBe(keys.key("desk", { text: "a" }));
  });

  it("produce keys the server accepts, also without crypto.randomUUID", () => {
    expect(IdempotencyKey.safeParse(newIdempotencyKey()).success).toBe(true);
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const key = newIdempotencyKey();
      expect(IdempotencyKey.safeParse(key).success).toBe(true);
      expect(key).not.toBe(newIdempotencyKey());
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
