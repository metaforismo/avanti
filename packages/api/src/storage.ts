import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { put, get, del } from "@vercel/blob";

export interface FileStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<string>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
export class DiskStorage implements FileStorage {
  constructor(private root: string) {}
  private path(key: string) {
    const root = resolve(this.root);
    const path = resolve(root, key);
    if (!path.startsWith(root + sep)) throw new Error("Invalid storage key");
    return path;
  }
  async put(key: string, bytes: Uint8Array): Promise<string> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    return key;
  }
  async get(key: string) {
    return readFile(this.path(key));
  }
  async delete(key: string) {
    await unlink(this.path(key)).catch((e: unknown) => {
      if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
    });
  }
}
export class BlobStorage implements FileStorage {
  constructor(private token: string) {}
  async put(key: string, bytes: Uint8Array, mime: string) {
    const blob = await put(key, Buffer.from(bytes), {
      access: "private",
      contentType: mime,
      token: this.token,
      addRandomSuffix: false,
    });
    return blob.url;
  }
  async get(key: string) {
    const result = await get(key, { access: "private", token: this.token });
    if (!result || result.statusCode !== 200) throw new Error("Missing blob");
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  async delete(key: string) {
    await del(key, { token: this.token });
  }
}
export class MemoryStorage implements FileStorage {
  private files = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array) {
    this.files.set(key, bytes.slice());
    return key;
  }
  async get(key: string) {
    const bytes = this.files.get(key);
    if (!bytes) throw new Error("Missing file");
    return bytes.slice();
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}
