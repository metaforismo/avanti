import { mfaCipher } from "./mfa";
import { defaultNotifications } from "./notification-config";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import {
  createDatabase,
  organizations,
  offices,
  cases,
  documents,
  storageDeletions,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { hashToken, newToken, sanitizeName } from "./security";
import { GatewayIntelligence } from "./ai";
import { MemoryStorage } from "./storage";
import { assertImageSafe } from "./image-safety";
import { analyzePendingDocument } from "./document-analysis";
import { MAX_CASE_BYTES } from "./citizen";

let db: Database;
let close: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let now = new Date("2027-01-05T10:00:00Z");
const token = newToken();
const storage = new MemoryStorage();
const ai = new GatewayIntelligence();
const jobs: (() => Promise<void>)[] = [];
const origin = "http://localhost:3400";
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  await db.insert(organizations).values({ id: "org", name: "CAF sintetico", kind: "caf" });
  await db.insert(offices).values({
    id: "office",
    organizationId: "org",
    slug: "office",
    name: "Sede",
    address: "Esempio",
    city: "Roma",
  });
  await db.insert(cases).values({
    id: "case",
    organizationId: "org",
    officeId: "office",
    reference: "AV-2027-000001",
    tokenHash: hashToken(token),
    language: "it",
    practiceId: "isee_ordinario",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: "2027-03-01T00:00:00Z",
  });
  app = createApp({ db, storage, ai, clock: () => now, background: (job) => jobs.push(job) });
});
afterAll(async () => {
  await close?.();
});
function upload(
  bytes: Uint8Array,
  mime = "application/pdf",
  name = "ESEMPIO.pdf",
  caseToken = token,
) {
  const form = new FormData();
  form.set("file", new File([bytes as BlobPart], name, { type: mime }));
  return app.request(`/api/c/${caseToken}/documents`, {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
}
async function pdf() {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  return pdf;
}
it("pilot: rejects compressed JavaScript / attachments / MIME mismatch before storage or AI", async () => {
  const put = vi.spyOn(storage, "put"),
    analyze = vi.spyOn(ai, "analyze");
  const js = await pdf();
  js.addJavaScript("example", "void 0");
  expect((await upload(await js.save())).status).toBe(415);
  const attached = await pdf();
  await attached.attach(new Uint8Array([1]), "ESEMPIO.txt");
  expect((await upload(await attached.save())).status).toBe(415);
  expect((await upload(await (await pdf()).save(), "image/png")).status).toBe(415);
  expect(put).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
  put.mockRestore();
  analyze.mockRestore();
});
it("pilot: small image headers cannot advertise unbounded decompression", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRuoAAAAASUVORK5CYII=",
    "base64",
  );
  expect(() => assertImageSafe(png, "image/png")).not.toThrow();
  const huge = Buffer.from(png);
  huge.writeUInt32BE(100000, 16);
  huge.writeUInt32BE(100000, 20);
  expect(() => assertImageSafe(huge, "image/png")).toThrow();
  expect(() => assertImageSafe(png.subarray(0, 24), "image/png")).toThrow();
  const jpeg = Buffer.from([255, 216, 255, 192, 0, 8, 8, 255, 255, 255, 255, 1]);
  expect(() => assertImageSafe(jpeg, "image/jpeg")).toThrow();
  const webp = Buffer.alloc(30);
  webp.write("RIFF");
  webp.write("WEBP", 8);
  webp.write("VP8X", 12);
  webp.writeUInt32LE(10, 16);
  webp.writeUIntLE(100000, 24, 3);
  webp.writeUIntLE(100000, 27, 3);
  expect(() => assertImageSafe(webp, "image/webp")).toThrow();
  const heic = Buffer.alloc(28);
  heic.writeUInt32BE(28);
  heic.write("ispe", 4);
  heic.writeUInt32BE(100000, 12);
  heic.writeUInt32BE(100000, 16);
  expect(() => assertImageSafe(heic, "image/heic")).toThrow();
  expect(sanitizeName('../../a\r\n"\u202E.exe', "application/pdf")).not.toMatch(
    /[\/\\\r\n"\u202E]/,
  );
});
it("pilot: returns processing before AI; persisted jobs recover after restart and deleted documents stay deleted", async () => {
  const analyze = vi.spyOn(ai, "analyze");
  const response = await upload(await (await pdf()).save());
  expect(response.status).toBe(201);
  const view = await response.json();
  const id = view.documents[0].id as string;
  expect(view.documents[0]).toMatchObject({ status: "processing", analysis: null });
  expect(analyze).not.toHaveBeenCalled();
  jobs.splice(0); // Simulated host termination before after() executes.
  now = new Date(now.getTime() + 180000);
  const restarted = createApp({ db, storage, ai, clock: () => now, cronSecret: "synthetic-cron" });
  expect(
    (
      await restarted.request("/api/cron/maintenance", {
        headers: { Authorization: "Bearer synthetic-cron" },
      })
    ).status,
  ).toBe(200);
  expect((await db.select().from(documents).where(eq(documents.id, id)))[0]?.status).toBe(
    "analyzed",
  );
  expect(analyze).toHaveBeenCalledTimes(1);
  await analyzePendingDocument(
    {
      db,
      storage,
      ai,
      clock: () => now,
      publicUrl: origin,
      production: false,
      mfa: mfaCipher({ key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" }),
      notifications: defaultNotifications(),
    },
    id,
  );
  expect(analyze).toHaveBeenCalledTimes(1);
  const second = await upload(await (await pdf()).save());
  const secondId = (await second.json()).documents.find(
    (d: { status: string }) => d.status === "processing",
  ).id as string;
  expect(
    (
      await app.request(`/api/c/${token}/documents/${secondId}`, {
        method: "DELETE",
        headers: { Origin: origin },
      })
    ).status,
  ).toBe(200);
  await jobs.shift()!();
  expect(await db.select().from(documents).where(eq(documents.id, secondId))).toHaveLength(0);
  expect(analyze).toHaveBeenCalledTimes(1);
  analyze.mockRestore();
});
it("pilot: total byte quota is checked under the case lock and storage failures leave no DB document", async () => {
  const put = storage.put.bind(storage);
  let ambiguousKey = "";
  const get = vi.spyOn(storage, "put").mockImplementationOnce(async (key, bytes) => {
    ambiguousKey = key;
    await put(key, bytes);
    throw new Error("storage details secret");
  });
  const count = (await db.select().from(documents)).length;
  expect((await upload(await (await pdf()).save())).status).toBe(500);
  expect(await db.select().from(documents)).toHaveLength(count);
  get.mockRestore();
  expect(await db.select().from(storageDeletions)).toHaveLength(1);
  now = new Date(now.getTime() + 660000);
  const recovered = createApp({ db, storage, ai, clock: () => now, cronSecret: "synthetic-cron" });
  expect(
    (
      await recovered.request("/api/cron/maintenance", {
        headers: { Authorization: "Bearer synthetic-cron" },
      })
    ).status,
  ).toBe(200);
  expect(await db.select().from(storageDeletions)).toHaveLength(0);
  await expect(storage.get(ambiguousKey)).rejects.toThrow();
  await db.update(documents).set({ sizeBytes: MAX_CASE_BYTES }).where(eq(documents.caseId, "case"));
  const full = await upload(await (await pdf()).save());
  expect(full.status).toBe(409);
  expect((await full.json()).error.code).toBe("case_full");
  await db.update(documents).set({ sizeBytes: 1024 }).where(eq(documents.caseId, "case"));
});
it("pilot: chunked multipart and forged Content-Length are bounded while consumed", async () => {
  for (const length of [undefined, "1"]) {
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(
          new TextEncoder().encode(
            '--synthetic\r\nContent-Disposition: form-data; name="file"; filename="ESEMPIO.pdf"\r\nContent-Type: application/pdf\r\n\r\n',
          ),
        );
      },
      pull(c) {
        sent++;
        if (sent > 80) c.close();
        else c.enqueue(new Uint8Array(64 * 1024));
      },
    });
    const headers = new Headers({
      Origin: origin,
      "Content-Type": "multipart/form-data; boundary=synthetic",
    });
    if (length) headers.set("Content-Length", length);
    const request = new Request(`http://localhost:3400/api/c/${token}/documents`, {
      method: "POST",
      headers,
      body,
      duplex: "half",
    } as RequestInit);
    const response = await app.fetch(request);
    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(80);
  }
});

it("pilot: response failure after commit preserves the stored document and file", async () => {
  const before = (await db.select().from(documents)).length;
  const remove = vi.spyOn(storage, "delete");
  const transaction = db.transaction.bind(db);
  let select: ReturnType<typeof vi.spyOn> | undefined;
  const tx = vi
    .spyOn(db, "transaction")
    .mockImplementationOnce(transaction)
    .mockImplementationOnce(((...args: Parameters<typeof db.transaction>) =>
      transaction(...args).then((result) => {
        select = vi.spyOn(db, "select").mockImplementationOnce(() => {
          throw new Error("Synthetic response failure");
        });
        return result;
      })) as typeof db.transaction);
  try {
    expect((await upload(await (await pdf()).save())).status).toBe(500);
    expect(remove).not.toHaveBeenCalled();
    const rows = await db.select().from(documents);
    expect(rows).toHaveLength(before + 1);
    const pending = rows.filter((d) => d.status === "processing");
    expect(pending.length).toBeGreaterThan(0);
    for (const row of pending)
      expect((await storage.get(row.storageKey)).length).toBeGreaterThan(0);
  } finally {
    tx.mockRestore();
    select?.mockRestore();
    remove.mockRestore();
  }
});
it("pilot: a fifth concurrent upload on one case waits its turn; other cases are unaffected", async () => {
  const other = newToken();
  await db.insert(cases).values({
    id: "other-case",
    organizationId: "org",
    officeId: "office",
    reference: "AV-2027-000002",
    tokenHash: hashToken(other),
    language: "it",
    practiceId: "isee_ordinario",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: "2027-03-01T00:00:00Z",
  });
  const original = storage.put.bind(storage);
  let release: () => void = () => {};
  let ready: () => void = () => {};
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let calls = 0;
  const put = vi.spyOn(storage, "put").mockImplementation(async (key, bytes) => {
    if (++calls === 4) ready();
    await paused;
    return original(key, bytes);
  });
  try {
    const bytes = await (await pdf()).save();
    const requests = Array.from({ length: 4 }, () => upload(bytes));
    await started;
    const blocked = await upload(bytes);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("5");
    // Four slow uploads on one case must not lock other citizens out.
    const elsewhere = upload(bytes, "application/pdf", "ESEMPIO.pdf", other);
    release();
    expect((await elsewhere).status).toBe(201);
    expect((await Promise.all(requests)).every((r) => r.status === 201)).toBe(true);
  } finally {
    release();
    put.mockRestore();
  }
});
