import { mkdtemp, mkdir, symlink, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { DiskStorage } from "./storage";
it("pilot: disk storage rejects traversal and symlinks and keeps restrictive file modes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "avanti-storage-test-"));
  try {
    const root = join(dir, "uploads"),
      outside = join(dir, "outside");
    await mkdir(root);
    await mkdir(outside);
    const storage = new DiskStorage(root);
    await storage.put("tenant/case/doc", new Uint8Array([1]));
    expect((await stat(join(root, "tenant/case/doc"))).mode & 0o777).toBe(0o600);
    for (const key of ["../outside/file", "/etc/passwd", "a/../other", "a\\b"])
      await expect(storage.put(key, new Uint8Array([1]))).rejects.toThrow();
    await symlink(outside, join(root, "escape"));
    for (const operation of [
      () => storage.put("escape/new/file", new Uint8Array([1])),
      () => storage.get("escape/file"),
      () => storage.delete("escape/file"),
    ])
      await expect(operation()).rejects.toThrow();
    await expect(stat(join(outside, "new"))).rejects.toThrow();
    await symlink(join(root, "tenant/case/doc"), join(root, "alias"));
    await expect(storage.get("alias")).rejects.toThrow();
    expect(await readFile(join(root, "tenant/case/doc"))).toEqual(Buffer.from([1]));
    await storage.health();
    await storage.delete("absent/directory/file");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
