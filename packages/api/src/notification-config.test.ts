import { randomBytes } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadNotifications, seal, unseal } from "./notification-config";

it("local fallback key survives restart, is private, and never requires a provider", async () => {
  const directory = await mkdtemp(join(tmpdir(), "avanti-notify-"));
  try {
    const first = await loadNotifications({}, directory);
    const encrypted = seal(first, "id:pilot_lead:it", {
      from: null,
      to: "example@example.test",
      subject: "Test",
      text: "Contenuto",
    });
    const restarted = await loadNotifications({}, directory);
    expect(restarted.adapter.mode).toBe("console");
    expect(restarted.key.equals(first.key)).toBe(true);
    expect((await stat(join(directory, "notify.key"))).mode & 0o777).toBe(0o600);
    expect(unseal(restarted, "id:pilot_lead:it", encrypted).text).toBe("Contenuto");
    expect(() => unseal(restarted, "other:pilot_lead:it", encrypted)).toThrow();
    const corrupt = Buffer.from(encrypted, "base64");
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
    expect(() => unseal(restarted, "id:pilot_lead:it", corrupt.toString("base64"))).toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects invalid key and configured addresses without echoing their values", async () => {
  for (const env of [
    { NOTIFY_ENCRYPTION_KEY: "invalid-secret" },
    { NOTIFY_ENCRYPTION_KEY: randomBytes(32).toString("hex"), NOTIFY_FROM: "private\r\naddress" },
    {
      NOTIFY_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
      LEADS_NOTIFY_EMAIL: "private-address",
    },
  ]) {
    let error: unknown;
    try {
      await loadNotifications(env, "/unused");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toMatch(/invalid-secret|private-address|private\r/);
  }
});
