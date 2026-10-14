import { defaultNotifications } from "./notification-config";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import {
  ApiError,
  CaseDossier,
  CitizenCase,
  Metrics,
  StartIntakeResponse,
} from "@avanti/contracts";
import { applyAnswer, nextQuestion, type Answers } from "@avanti/core";
import {
  cases,
  checklistReviews,
  createDatabase,
  documents,
  events,
  offices,
  operators,
  organizations,
  sessions,
  storageDeletions,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { MemoryStorage } from "./storage";
import { hashToken, newToken } from "./security";

const origin = "http://localhost:3400";
const initial = "2027-01-05T10:00:00.000Z";
let now = new Date(initial);
let db: Database;
let close: () => Promise<void>;
const storage = new MemoryStorage();
const ai = new GatewayIntelligence();
const jobs: (() => Promise<void>)[] = [];
let app: ReturnType<typeof createApp>;
const cookies: string[] = [];

beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  await db.insert(organizations).values({ id: "edge-org", name: "CAF sintetico", kind: "caf" });
  await db.insert(offices).values({
    id: "edge-office",
    organizationId: "edge-org",
    slug: "edges",
    name: "Sede",
    address: "Esempio",
    city: "Roma",
  });
  for (let i = 0; i < 2; i++) {
    const token = newToken();
    cookies.push(`avanti_session=${token}`);
    await db.insert(operators).values({
      id: `edge-op-${i}`,
      organizationId: "edge-org",
      name: `Operatore ${i}`,
      email: `edge-${i}@example.invalid`,
      passwordHash: "unused",
      role: "admin",
    });
    await db.insert(sessions).values({
      id: `edge-session-${i}`,
      operatorId: `edge-op-${i}`,
      tokenHash: hashToken(token),
      createdAt: initial,
      expiresAt: "2027-01-05T11:00:00Z",
    });
  }
  app = createApp({
    db,
    storage,
    ai,
    clock: () => now,
    background: (job) => jobs.push(job),
    errorLogger: () => {},
    storageLogger: () => {},
  });
});
afterAll(async () => close?.());

function request(path: string, method = "GET", input?: unknown, cookie?: string) {
  return app.request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(input !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
async function start(status: "intake" | "in_review" | "needs_citizen" = "intake") {
  now = new Date(initial);
  const result = StartIntakeResponse.parse(
    await (
      await request("/intake", "POST", {
        officeSlug: "edges",
        practiceId: "isee_ordinario",
        privacyAccepted: true,
      })
    ).json(),
  );
  let answers: Answers = {};
  for (let i = 0; i < 100; i++) {
    const q = nextQuestion("isee_ordinario", answers, "it");
    if (!q) break;
    const value =
      q.kind === "members"
        ? [{ id: "applicant", role: "richiedente", firstName: "محمد", lastName: "علي" }]
        : q.kind === "yes_no"
          ? false
          : q.kind === "number"
            ? (q.min ?? 0)
            : q.kind === "single_choice"
              ? q.options![0]!.value
              : q.kind === "multi_choice"
                ? []
                : q.kind === "date"
                  ? "2025-01-01"
                  : "Esempio";
    answers = applyAnswer("isee_ordinario", answers, q.id, value, "it", now);
  }
  expect(nextQuestion("isee_ordinario", answers, "it")).toBeNull();
  await db
    .update(cases)
    .set({ answers, status, confirmedAnswers: Object.keys(answers) })
    .where(eq(cases.id, result.case.id));
  return { ...result, case: CitizenCase.parse(await (await request(`/c/${result.token}`)).json()) };
}
async function dossier(id: string) {
  return CaseDossier.parse(
    await (await request(`/cases/${id}`, "GET", undefined, cookies[0])).json(),
  );
}
async function conflict(response: Response) {
  expect(response.status).toBe(409);
  expect(ApiError.parse(await response.json()).error).toMatchObject({ code: "conflict" });
}
const submit = { contact: { firstName: "রহিম", lastName: "উদাহরণ" }, confirmed: true };
async function pdfBytes(encrypted = false) {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  if (encrypted) {
    const encryption = pdf.context.obj({
      Filter: PDFName.of("Standard"),
      V: PDFNumber.of(1),
      R: PDFNumber.of(2),
    });
    pdf.context.trailerInfo.Encrypt = pdf.context.register(encryption);
  }
  return new Uint8Array(await pdf.save());
}
function upload(
  token: string,
  bytes: Uint8Array,
  name = "ESEMPIO.pdf",
  mime = "application/pdf",
  itemId?: string,
) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], name, { type: mime }));
  if (itemId) form.set("checklistItemId", itemId);
  return app.request(`/api/c/${token}/documents`, {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
}
function deferred() {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

it.each([
  ["notes", { internalNotes: "Prima nota" }, { internalNotes: "Seconda nota" }],
  ["status", { status: "needs_citizen" }, { status: "closed" }],
  ["assignment", { assigneeId: "edge-op-0" }, { assigneeId: "edge-op-1" }],
])(
  "operators: rejects stale %s, including writes in the same millisecond",
  async (_, first, second) => {
    const intake = await start("in_review");
    const before = await dossier(intake.case.id);
    const results = await Promise.all([
      request(
        `/cases/${before.id}`,
        "PATCH",
        { ...first, expectedUpdatedAt: before.updatedAt },
        cookies[0],
      ),
      request(
        `/cases/${before.id}`,
        "PATCH",
        { ...second, expectedUpdatedAt: before.updatedAt },
        cookies[1],
      ),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = CaseDossier.parse(await results.find((r) => r.status === 200)!.json());
    expect(winner.updatedAt).not.toBe(before.updatedAt);
    const current = await dossier(before.id);
    expect(current.internalNotes).toBe(winner.internalNotes);
    expect(current.status).toBe(winner.status);
    expect(current.assignee).toEqual(winner.assignee);
    await conflict(
      await request(
        `/cases/${before.id}`,
        "PATCH",
        { internalNotes: "Senza versione" },
        cookies[0],
      ),
    );
  },
);

it("operators: verification and rejection of the same item cannot overwrite each other", async () => {
  const intake = await start("in_review");
  const before = await dossier(intake.case.id);
  const item = before.checklist[0]!;
  await db.insert(documents).values({
    id: crypto.randomUUID(),
    caseId: before.id,
    fileName: "ESEMPIO.pdf",
    mimeType: "application/pdf",
    sizeBytes: 10,
    storageKey: "unused",
    sha256: "unused",
    uploadedAt: initial,
    status: "analyzed",
    checklistItemId: item.id,
  });
  const results = await Promise.all([
    request(
      `/cases/${before.id}/checklist/${item.id}/review`,
      "POST",
      { decision: "verified", expectedUpdatedAt: before.updatedAt },
      cookies[0],
    ),
    request(
      `/cases/${before.id}/checklist/${item.id}/review`,
      "POST",
      { decision: "rejected", note: "Copia incompleta", expectedUpdatedAt: before.updatedAt },
      cookies[1],
    ),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const winner = CaseDossier.parse(await results.find((r) => r.status === 200)!.json());
  expect((await dossier(before.id)).checklist.find((i) => i.id === item.id)?.status).toBe(
    winner.checklist.find((i) => i.id === item.id)?.status,
  );
  expect(
    await db.select().from(checklistReviews).where(eq(checklistReviews.caseId, before.id)),
  ).toHaveLength(1);
});

it("operators: a request translated from a stale dossier rolls back reviews and messages", async () => {
  const intake = await start("in_review");
  const before = await dossier(intake.case.id);
  const entered = deferred(),
    pending = deferred();
  const translate = vi.spyOn(ai, "translate").mockImplementationOnce(async () => {
    entered.release();
    await pending.promise;
    return { text: "Copia chiara", engine: "heuristic" };
  });
  try {
    const sending = request(
      `/cases/${before.id}/requests`,
      "POST",
      {
        checklistItemIds: [before.checklist[0]!.id],
        message: "Copia chiara",
        expectedUpdatedAt: before.updatedAt,
      },
      cookies[0],
    );
    await entered.promise;
    expect(
      (
        await request(
          `/cases/${before.id}`,
          "PATCH",
          { internalNotes: "Aggiornato", expectedUpdatedAt: before.updatedAt },
          cookies[1],
        )
      ).status,
    ).toBe(200);
    pending.release();
    await conflict(await sending);
    const current = await dossier(before.id);
    expect(current.messages.filter((m) => m.role === "operator")).toHaveLength(0);
    expect(current.status).toBe("in_review");
    expect(
      await db.select().from(checklistReviews).where(eq(checklistReviews.caseId, before.id)),
    ).toHaveLength(0);
  } finally {
    pending.release();
    translate.mockRestore();
  }
});

it("citizen: parallel double submit appends one event and preserves the first submission", async () => {
  const intake = await start();
  const results = await Promise.all([
    request(`/c/${intake.token}/submit`, "POST", submit),
    request(`/c/${intake.token}/submit`, "POST", submit),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const ev = await db
    .select()
    .from(events)
    .where(and(eq(events.caseId, intake.case.id), eq(events.type, "case.submitted")));
  expect(ev).toHaveLength(1);
  const [stored] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
  expect(new Date(stored!.submittedAt!).toISOString()).toBe(initial);
  expect(stored?.contact).toEqual(submit.contact);
});

it("citizen: submit is blocked during storage upload across app instances, then during analysis", async () => {
  const intake = await start();
  const entered = deferred(),
    pending = deferred();
  const put = storage.put.bind(storage);
  const write = vi.spyOn(storage, "put").mockImplementationOnce(async (...args) => {
    entered.release();
    await pending.promise;
    return put(...args);
  });
  try {
    const uploading = upload(intake.token, await pdfBytes());
    await entered.promise;
    const other = createApp({ db, storage, clock: () => now });
    await conflict(
      await other.request(`/api/c/${intake.token}/submit`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(submit),
      }),
    );
    pending.release();
    expect((await uploading).status).toBe(201);
    await conflict(await request(`/c/${intake.token}/submit`, "POST", submit));
    await jobs.splice(0).reduce(async (previous, job) => {
      await previous;
      await job();
    }, Promise.resolve());
    expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(200);
  } finally {
    pending.release();
    write.mockRestore();
  }
});

it("citizen: changing an answer with an open integration retains the request and first submission", async () => {
  const intake = await start("needs_citizen");
  await db
    .update(cases)
    .set({ submittedAt: initial, firstSubmissionComplete: false })
    .where(eq(cases.id, intake.case.id));
  const item = intake.case.checklist[0]!;
  await db.insert(checklistReviews).values({
    caseId: intake.case.id,
    itemId: item.id,
    decision: "rejected",
    note: "Copia chiara",
    reviewedAt: initial,
  });
  const response = await request(`/c/${intake.token}/turn`, "POST", {
    type: "answer",
    questionId: "accounts_count",
    value: 1,
  });
  expect(response.status).toBe(200);
  const current = CitizenCase.parse(await response.json());
  expect(current.status).toBe("needs_citizen");
  expect(current.submittedAt).toBe(initial);
  expect(current.checklist.find((i) => i.id === item.id)).toMatchObject({
    status: "rejected",
    note: "Copia chiara",
  });
  expect(current.nextQuestion).not.toBeNull();
  await conflict(await request(`/c/${intake.token}/submit`, "POST", submit));
});

it("documents: zero bytes and encrypted PDFs never reach storage", async () => {
  const intake = await start();
  const put = vi.spyOn(storage, "put");
  try {
    for (const bytes of [new Uint8Array(), await pdfBytes(true)]) {
      const response = await upload(intake.token, bytes);
      expect(response.status).toBe(415);
      expect(ApiError.parse(await response.json()).error.code).toBe("unsupported_file");
    }
    expect(put).not.toHaveBeenCalled();
  } finally {
    put.mockRestore();
  }
});

it("documents: an interrupted multipart upload leaves no document and no submit blocker", async () => {
  const intake = await start();
  let abortBody: (reason: Error) => void = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      abortBody = (reason) => controller.error(reason);
    },
  });
  const uploading = app.request(
    new Request(`${origin}/api/c/${intake.token}/documents`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "multipart/form-data; boundary=example" },
      body,
      duplex: "half",
    } as RequestInit),
  );
  // Wait for the durable reservation rather than relying on elapsed wall time.
  for (let i = 0; i < 50; i++) {
    const leases = await db
      .select()
      .from(storageDeletions)
      .where(eq(storageDeletions.caseId, intake.case.id));
    if (leases.length) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const leases = await db
    .select()
    .from(storageDeletions)
    .where(eq(storageDeletions.caseId, intake.case.id));
  abortBody(new Error("Synthetic interrupted body"));
  expect((await uploading).status).toBe(400);
  expect(leases).toHaveLength(1);
  expect(
    await db.select().from(documents).where(eq(documents.caseId, intake.case.id)),
  ).toHaveLength(0);
  expect(
    await db.select().from(storageDeletions).where(eq(storageDeletions.caseId, intake.case.id)),
  ).toHaveLength(0);
  expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(200);
});

it("metrics: a period without data has zeros, null averages and a complete daily axis", async () => {
  const response = await request(
    "/metrics?from=2027-02-01&to=2027-02-03",
    "GET",
    undefined,
    cookies[0],
  );
  expect(response.status).toBe(200);
  const result = Metrics.parse(await response.json());
  expect(result).toMatchObject({
    casesStarted: 0,
    casesSubmitted: 0,
    casesReady: 0,
    completeAtFirstSubmission: null,
    avgCitizenMinutes: null,
    avgReviewMinutes: null,
    needsCitizenRate: null,
  });
  expect(result.daily).toEqual(
    ["2027-02-01", "2027-02-02", "2027-02-03"].map((date) => ({ date, started: 0, submitted: 0 })),
  );
});

it.each(["interview", "upload"])(
  "citizen: link expires during %s and rolls back personal data",
  async (kind) => {
    const intake = await start();
    const entered = deferred(),
      pending = deferred();
    const put = storage.put.bind(storage),
      intakeAi = ai.intake.bind(ai);
    let key = "";
    const pause =
      kind === "upload"
        ? vi.spyOn(storage, "put").mockImplementationOnce(async (...args) => {
            key = args[0];
            await put(...args);
            entered.release();
            await pending.promise;
            return key;
          })
        : vi.spyOn(ai, "intake").mockImplementationOnce(async (...args) => {
            entered.release();
            await pending.promise;
            return intakeAi(...args);
          });
    const sending =
      kind === "upload"
        ? upload(intake.token, await pdfBytes())
        : request(`/c/${intake.token}/turn`, "POST", { type: "text", text: "ISEE ho due conti" });
    try {
      await entered.promise;
      await db.update(cases).set({ expiresAt: initial }).where(eq(cases.id, intake.case.id));
      pending.release();
      const response = await sending;
      expect(response.status).toBe(410);
      expect(ApiError.parse(await response.json()).error.code).toBe("link_expired");
      const [stored] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
      expect(stored?.answers).toEqual(intake.case.answers);
      expect(
        await db.select().from(documents).where(eq(documents.caseId, intake.case.id)),
      ).toHaveLength(0);
      expect(
        await db.select().from(storageDeletions).where(eq(storageDeletions.caseId, intake.case.id)),
      ).toHaveLength(0);
      if (key) await expect(storage.get(key)).rejects.toThrow();
    } finally {
      pending.release();
      await sending;
      pause.mockRestore();
    }
  },
);

it("citizen: switching language retains confirmed answers, members and document ownership", async () => {
  const intake = await start();
  const uploaded = CitizenCase.parse(
    await (
      await upload(
        intake.token,
        await pdfBytes(),
        "ESEMPIO.pdf",
        "application/pdf",
        intake.case.checklist[0]!.id,
      )
    ).json(),
  );
  const response = await request(`/c/${intake.token}/language`, "PUT", { language: "bn" });
  expect(response.status).toBe(200);
  const changed = CitizenCase.parse(await response.json());
  expect(changed.language).toBe("bn");
  expect(changed.answers).toEqual(uploaded.answers);
  expect(changed.household).toEqual(uploaded.household);
  expect(changed.documents).toEqual(uploaded.documents);
  expect(changed.checklist[0]!.title).toMatch(/\p{Script=Bengali}/u);
  expect(changed.checklist[0]!.id).toBe(uploaded.checklist[0]!.id);
});

it("documents: duplicate bytes and hostile names keep both originals, flag duplicates and sanitize download names", async () => {
  const intake = await start();
  const bytes = await pdfBytes();
  const itemId = intake.case.checklist[0]!.id;
  expect(
    (await upload(intake.token, bytes, '../../محمد\r\n"\u202E.exe', "application/pdf", itemId))
      .status,
  ).toBe(201);
  const response = await upload(intake.token, bytes, "রহিম🙂.pdf", "application/pdf", itemId);
  expect(response.status).toBe(201);
  await jobs.splice(0).reduce(async (previous, job) => {
    await previous;
    await job();
  }, Promise.resolve());
  const view = CitizenCase.parse(await (await request(`/c/${intake.token}`)).json());
  expect(view.documents).toHaveLength(2);
  expect(
    view.documents.every(
      (d) => d.fileName.endsWith(".pdf") && !/[\/\\\r\n"\u202E]/.test(d.fileName),
    ),
  ).toBe(true);
  expect(view.findings.some((f) => f.code === "document.duplicate")).toBe(true);
  for (const d of view.documents) {
    const file = await request(`/c/${intake.token}/documents/${d.id}/file`);
    expect(file.status).toBe(200);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
    expect(file.headers.get("content-disposition")).toContain("filename*=UTF-8''");
  }
});

it("metrics: deactivation keeps historical measurements; erasure removes the case and its events", async () => {
  const intake = await start();
  await db
    .update(cases)
    .set({ assigneeId: "edge-op-1", submittedAt: initial, reviewStartedAt: initial })
    .where(eq(cases.id, intake.case.id));
  await db.insert(events).values({
    id: crypto.randomUUID(),
    caseId: intake.case.id,
    organizationId: "edge-org",
    actor: "operator",
    actorId: "edge-op-1",
    type: "review.completed",
    at: initial,
    metadata: { durationMinutes: 5 },
  });
  const metrics = async () =>
    Metrics.parse(
      await (
        await request("/metrics?from=2027-01-05&to=2027-01-05", "GET", undefined, cookies[0])
      ).json(),
    );
  const before = await metrics();
  expect(
    (await request("/operators/edge-op-1", "PATCH", { active: false }, cookies[0])).status,
  ).toBe(200);
  expect(await metrics()).toEqual(before);
  const [row] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
  expect(
    (
      await request(
        `/cases/${intake.case.id}`,
        "DELETE",
        { confirmReference: row!.reference },
        cookies[0],
      )
    ).status,
  ).toBe(204);
  const after = await metrics();
  expect(after.casesStarted).toBe(before.casesStarted - 1);
  expect(after.casesSubmitted).toBe(before.casesSubmitted - 1);
  expect(after.casesReady).toBe(before.casesReady - 1);
  expect(await db.select().from(events).where(eq(events.caseId, intake.case.id))).toHaveLength(0);
});

it("operators: background analysis invalidates a previously read dossier", async () => {
  const intake = await start();
  jobs.splice(0);
  const uploaded = CitizenCase.parse(
    await (
      await upload(
        intake.token,
        await pdfBytes(),
        "ESEMPIO.pdf",
        "application/pdf",
        intake.case.checklist[0]!.id,
      )
    ).json(),
  );
  await db.update(cases).set({ status: "in_review" }).where(eq(cases.id, intake.case.id));
  const before = await dossier(intake.case.id);
  const { analyzePendingDocument } = await import("./document-analysis");
  await analyzePendingDocument(
    {
      db,
      storage,
      ai,
      notifications: defaultNotifications(),
      clock: () => now,
      publicUrl: origin,
      production: false,
    },
    uploaded.documents[0]!.id,
  );
  await conflict(
    await request(
      `/cases/${before.id}`,
      "PATCH",
      { internalNotes: "Snapshot vecchio", expectedUpdatedAt: before.updatedAt },
      cookies[0],
    ),
  );
});

it("operators: a processing document cannot be verified before analysis finishes", async () => {
  const intake = await start();
  const uploaded = CitizenCase.parse(
    await (
      await upload(
        intake.token,
        await pdfBytes(),
        "ESEMPIO.pdf",
        "application/pdf",
        intake.case.checklist[0]!.id,
      )
    ).json(),
  );
  await db.update(cases).set({ status: "in_review" }).where(eq(cases.id, intake.case.id));
  const before = await dossier(intake.case.id);
  await conflict(
    await request(
      `/cases/${before.id}/checklist/${uploaded.documents[0]!.checklistItemId}/review`,
      "POST",
      { decision: "verified", expectedUpdatedAt: before.updatedAt },
      cookies[0],
    ),
  );
  expect(
    await db.select().from(checklistReviews).where(eq(checklistReviews.caseId, before.id)),
  ).toHaveLength(0);
});

it("documents: EXIF orientation is preserved byte-for-byte for the viewer", async () => {
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(new URL("./fixtures/rotated-exif.jpg", import.meta.url));
  const exif = bytes.indexOf(Buffer.from("Exif\0\0"));
  expect(exif).toBeGreaterThan(0);
  expect(bytes.readUInt16LE(exif + 6 + 8 + 2 + 8)).toBe(6);
  const intake = await start();
  const response = await upload(intake.token, bytes, "Telefono.JPG", "image/jpeg");
  expect(response.status).toBe(201);
  const view = CitizenCase.parse(await response.json());
  const downloaded = await request(`/c/${intake.token}/documents/${view.documents[0]!.id}/file`);
  expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(new Uint8Array(bytes));
});

it("documents: HEIC headers are accepted, retained and use explicit manual analysis fallback", async () => {
  // Structural BMFF fixture, not a decoded photograph: checks the upload/metadata boundary only.
  const box = (name: string, data: Buffer) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(data.length + 8);
    header.write(name, 4);
    return Buffer.concat([header, data]);
  };
  const dimensions = Buffer.alloc(12);
  dimensions.writeUInt32BE(2, 4);
  dimensions.writeUInt32BE(3, 8);
  const bytes = Buffer.concat([
    box("ftyp", Buffer.from("heic\0\0\0\0heic")),
    box(
      "meta",
      Buffer.concat([Buffer.alloc(4), box("iprp", box("ipco", box("ispe", dimensions)))]),
    ),
  ]);
  const intake = await start();
  jobs.splice(0);
  const response = await upload(intake.token, bytes, "Telefono.HEIC", "image/heic");
  expect(response.status).toBe(201);
  const view = CitizenCase.parse(await response.json());
  const document = view.documents[0]!;
  expect(document).toMatchObject({ mimeType: "image/heic", status: "processing" });
  await jobs.shift()!();
  const changed = CitizenCase.parse(await (await request(`/c/${intake.token}`)).json());
  expect(changed.documents[0]!.analysis?.engine).toBe("heuristic");
  const file = await request(`/c/${intake.token}/documents/${document.id}/file`);
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array(bytes));
});

it("metrics: zero practices yields null rates and averages rather than NaN", async () => {
  const { calculateMetrics } = await import("./operator-metrics");
  const result = Metrics.parse(calculateMetrics("2027-01-01", "2027-01-01", [], [], null));
  expect(result).toMatchObject({
    casesStarted: 0,
    casesSubmitted: 0,
    casesReady: 0,
    avgCitizenMinutes: null,
    avgReviewMinutes: null,
    completeAtFirstSubmission: null,
    needsCitizenRate: null,
    byPractice: [],
    byLanguage: [],
  });
});

it("operators: an equivalent offset timestamp is accepted and a backwards clock cannot reuse a version", async () => {
  const intake = await start("in_review");
  const before = await dossier(intake.case.id);
  now = new Date(Date.parse(initial) - 1000);
  try {
    const response = await request(
      `/cases/${before.id}`,
      "PATCH",
      { expectedUpdatedAt: "2027-01-05T11:00:00+01:00", internalNotes: "Confermata" },
      cookies[0],
    );
    expect(response.status).toBe(200);
    const changed = CaseDossier.parse(await response.json());
    expect(Date.parse(changed.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
    await conflict(
      await request(
        `/cases/${before.id}`,
        "PATCH",
        { expectedUpdatedAt: before.updatedAt, internalNotes: "Snapshot vecchio" },
        cookies[0],
      ),
    );
  } finally {
    now = new Date(initial);
  }
});

it("documents: an upload past its durable lease cannot restore a file removed by recovery", async () => {
  const intake = await start();
  const entered = deferred(),
    pending = deferred();
  const original = storage.put.bind(storage);
  let key = "";
  const put = vi.spyOn(storage, "put").mockImplementationOnce(async (...args) => {
    key = await original(...args);
    entered.release();
    await pending.promise;
    return key;
  });
  const uploading = upload(intake.token, await pdfBytes());
  try {
    await entered.promise;
    now = new Date(Date.parse(initial) + 600001);
    const { retryStorageDeletions } = await import("./storage-cleanup");
    await retryStorageDeletions({
      notifications: defaultNotifications(),
      db,
      storage,
      ai,
      clock: () => now,
      publicUrl: origin,
      production: false,
    });
    pending.release();
    await conflict(await uploading);
    expect(
      await db.select().from(documents).where(eq(documents.caseId, intake.case.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(storageDeletions).where(eq(storageDeletions.caseId, intake.case.id)),
    ).toHaveLength(0);
    await expect(storage.get(key)).rejects.toThrow();
    expect((await request(`/c/${intake.token}/submit`, "POST", submit)).status).toBe(200);
  } finally {
    pending.release();
    await uploading;
    put.mockRestore();
    now = new Date(initial);
  }
});

it("citizen: long text, unsafe controls and unpaired surrogates return 400 without changing answers", async () => {
  const intake = await start();
  const analyze = vi.spyOn(ai, "intake");
  try {
    for (const text of ["x".repeat(2001), "Ciao\u0000", "Ciao\u202e", "Ciao\ud800"]) {
      const response = await request(`/c/${intake.token}/turn`, "POST", { type: "text", text });
      expect(response.status).toBe(400);
      expect(ApiError.parse(await response.json()).error.code).toBe("bad_request");
    }
    expect(analyze).not.toHaveBeenCalled();
    const [row] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
    expect(row?.answers).toEqual(intake.case.answers);
  } finally {
    analyze.mockRestore();
  }
});
