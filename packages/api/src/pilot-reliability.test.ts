import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createDatabase, organizations, settings } from "@avanti/db";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { activityGate } from "./runtime";

it.each([false, true])(
  "pilot: shutdown drains a paused transaction and preserves atomicity (rollback=%s)",
  async (rollback) => {
    const dir = await mkdtemp(join(tmpdir(), "avanti-drain-test-"));
    // Exercise on-disk PGlite even when the suite has DATABASE_URL set.
    let resource = await createDatabase({ dataDir: dir, url: "" });
    try {
      const gate = activityGate();
      const finish = gate.begin();
      let release: () => void = () => {};
      let started: () => void = () => {};
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      const write = resource.db
        .transaction(async (tx) => {
          await tx
            .insert(organizations)
            .values({ id: "atomic", name: "CAF sintetico", kind: "caf" });
          started();
          await paused;
          await tx.insert(settings).values({ organizationId: "atomic" });
          if (rollback) throw new Error("Synthetic rollback");
        })
        .then(
          () => {},
          (error) => {
            expect(rollback).toBe(true);
            expect(error.message).toBe("Synthetic rollback");
          },
        )
        .finally(finish);
      await ready;
      let closed = false;
      const closing = gate.close(async () => {
        await resource.close();
        closed = true;
      });
      expect(gate.close(async () => {})).toBe(closing);
      expect(() => gate.begin()).toThrow("draining");
      await Promise.resolve();
      expect(closed).toBe(false);
      release();
      await write;
      await closing;
      resource = await createDatabase({ dataDir: dir, url: "" });
      expect(await resource.db.select().from(organizations)).toHaveLength(rollback ? 0 : 1);
      expect(await resource.db.select().from(settings)).toHaveLength(rollback ? 0 : 1);
    } finally {
      await resource.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
it("pilot: health probes DB/storage, coalesces parallel callers, returns only safe failures", async () => {
  const resource = await createDatabase({ memory: true });
  try {
    const storage = new MemoryStorage();
    const health = vi.spyOn(storage, "health");
    const app = createApp({ db: resource.db, storage });
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => app.request("/api/health")),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(health).toHaveBeenCalledTimes(1);
    const down = new MemoryStorage();
    vi.spyOn(down, "health").mockRejectedValue(new Error("internal-secret-details"));
    const failed = await createApp({ db: resource.db, storage: down }).request("/api/health");
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toMatch(/internal-secret|storage|SELECT/);
    await resource.close();
    const dbFailed = await createApp({ db: resource.db, storage }).request("/api/health");
    expect(dbFailed.status).toBe(503);
  } finally {
    await resource.close();
  }
});
