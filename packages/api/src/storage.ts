import { mkdir, open, unlink, realpath, lstat } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { deadline } from "./deadline";
import { put, get, del } from "@vercel/blob";

const readSignal = (caller?: AbortSignal) =>
  caller ? AbortSignal.any([AbortSignal.timeout(15000), caller]) : AbortSignal.timeout(15000);

export interface FileStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<string>;
  /** `signal` stops a read nobody waits for any more (a ZIP download the client left). */
  get(key: string, signal?: AbortSignal): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  health?(): Promise<void>;
}
export class DiskStorage implements FileStorage {
  constructor(private root: string) {}
  private async path(key: string, create = false) {
    if (
      !key
        .split("/")
        .every((segment) => /^[A-Za-z0-9._-]+$/.test(segment) && ![".", ".."].includes(segment))
    )
      throw new Error("Invalid storage key");
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const root = resolve(this.root);
    const path = resolve(root, key);
    if (!path.startsWith(root + sep)) throw new Error("Invalid storage key");
    const canonicalRoot = await realpath(root);
    // Reject symlink components, including links pointing back inside the storage root.
    let current = root;
    for (const segment of key.split("/").slice(0, -1)) {
      current = resolve(current, segment);
      if (create)
        await mkdir(current, { mode: 0o700 }).catch((error: unknown) => {
          if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        });
      if ((await lstat(current)).isSymbolicLink()) throw new Error("Invalid storage key");
    }
    const parent = await realpath(dirname(path));
    if (parent !== canonicalRoot && !parent.startsWith(canonicalRoot + sep))
      throw new Error("Invalid storage key");
    return path;
  }
  async put(key: string, bytes: Uint8Array): Promise<string> {
    const path = await this.path(key, true);
    const handle = await open(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(bytes);
    } catch (error) {
      await unlink(path).catch(() => {});
      throw error;
    } finally {
      await handle.close();
    }
    return key;
  }
  async get(key: string, signal?: AbortSignal) {
    const handle = await open(await this.path(key), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if ((await handle.stat()).size > 4 * 1024 * 1024) throw new Error("Invalid storage size");
      return await handle.readFile({ signal: readSignal(signal) });
    } finally {
      await handle.close();
    }
  }
  health() {
    return probeStorage(this);
  }
  async delete(key: string) {
    await this.path(key)
      .then((path) => unlink(path))
      .catch((e: unknown) => {
        if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
      });
  }
}
export class BlobStorage implements FileStorage {
  constructor(private token: string) {}
  async put(key: string, bytes: Uint8Array, mime: string) {
    const pending = put(key, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
      access: "private",
      contentType: mime,
      token: this.token,
      addRandomSuffix: false,
      abortSignal: AbortSignal.timeout(15000),
    });
    try {
      return (await deadline(pending, 15000)).url;
    } catch (error) {
      // An ambiguous remote response may finish late; delete a confirmed late success.
      void pending.then((blob) => this.delete(blob.url)).catch(() => {});
      throw error;
    }
  }
  async get(key: string, caller?: AbortSignal) {
    const signal = readSignal(caller);
    const result = await deadline(
      get(key, { access: "private", token: this.token, abortSignal: signal }),
      15000,
    );
    if (!result || result.statusCode !== 200) throw new Error("Missing blob");
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const abort = () => {
      void reader.cancel();
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      for (;;) {
        signal.throwIfAborted();
        const { done, value } = await reader.read();
        signal.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > 4 * 1024 * 1024) throw new Error("Invalid storage size");
        chunks.push(value);
      }
      return Buffer.concat(chunks, size);
    } finally {
      signal.removeEventListener("abort", abort);
      await reader.cancel().catch(() => {});
    }
  }
  health() {
    return probeStorage(this);
  }
  async delete(key: string) {
    await deadline(del(key, { token: this.token, abortSignal: AbortSignal.timeout(15000) }), 15000);
  }
}
export class MemoryStorage implements FileStorage {
  private files = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array) {
    this.files.set(key, bytes.slice());
    return key;
  }
  async get(key: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const bytes = this.files.get(key);
    if (!bytes) throw new Error("Missing file");
    return bytes.slice();
  }
  health() {
    return probeStorage(this);
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}

async function probeStorage(storage: FileStorage) {
  let key = `_health/${crypto.randomUUID()}`;
  try {
    key = await storage.put(key, new Uint8Array([65, 86]), "application/octet-stream");
    const bytes = await storage.get(key);
    if (bytes.length !== 2 || bytes[0] !== 65 || bytes[1] !== 86)
      throw new Error("Storage probe failed");
  } finally {
    await storage.delete(key);
  }
}
