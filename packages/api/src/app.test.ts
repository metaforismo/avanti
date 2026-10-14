import { withCaseVersion } from "./test-case-version";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  CaseDossier,
  DsuSheetResponse,
  CaseListResponse,
  CitizenCase,
  CreateCaseResponse,
  Metrics,
  Office,
  OrganizationPublic,
  Operator,
  StartIntakeResponse,
  UPLOAD_LIMITS,
  type AnswerValue,
  type Language,
  type Question,
} from "@avanti/contracts";
import {
  cases,
  createDatabase,
  documents,
  checklistReviews,
  storageDeletions,
  events,
  leads,
  offices,
  operators,
  organizations,
  sessions,
  rateLimits,
  settings,
  type Database,
} from "@avanti/db";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { hashPassword, hashToken } from "./security";
import { MemoryStorage } from "./storage";

const origin = "http://localhost:3400";
const initialInstant = "2027-01-05T10:00:00.000Z";
const password = "SoloTest-Avanti-2027!";
let passwordHash: string;
let db: Database;
let closeDatabase: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let instant: Date;
let logs: { requestId: string; category: string; status: number; durationMs: number }[];

beforeAll(async () => {
  passwordHash = await hashPassword(password);
});

beforeEach(async () => {
  const database = await createDatabase({ memory: true });
  db = database.db;
  closeDatabase = database.close;
  instant = new Date(initialInstant);
  logs = [];
  for (const suffix of ["a", "b"]) {
    await db
      .insert(organizations)
      .values({ id: `org-${suffix}`, name: `CAF Fittizio ${suffix}`, kind: "caf" });
    await db.insert(offices).values({
      id: `office-${suffix}`,
      organizationId: `org-${suffix}`,
      slug: `test-${suffix}`,
      name: `Sportello Fittizio ${suffix}`,
      address: "Via Esempio 1",
      city: "Milano",
    });
    await db.insert(operators).values({
      id: `operator-${suffix}`,
      organizationId: `org-${suffix}`,
      name: `Operatore Fittizio ${suffix}`,
      email: `${suffix}@example.test`,
      passwordHash,
      role: "admin",
    });
    await db
      .insert(settings)
      .values({ organizationId: `org-${suffix}`, baselineMinutesPerCase: 30 });
  }
  app = createApp({
    db,
    storage: new MemoryStorage(),
    ai: new GatewayIntelligence(),
    clock: () => new Date(instant),
    publicUrl: origin,
    logger: (record) => logs.push(record),
  });
}, 20_000);

afterEach(async () => {
  await closeDatabase?.();
});

async function request(
  path: string,
  method = "GET",
  input?: unknown,
  cookie?: string,
  requestOrigin = origin,
) {
  input = await withCaseVersion(db, path, method, input);
  const headers = new Headers({ Origin: requestOrigin });
  if (cookie) headers.set("Cookie", cookie);
  if (input !== undefined) headers.set("Content-Type", "application/json");
  return app.request(path, {
    method,
    headers,
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}

async function error(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const result = ApiError.parse(await response.json());
  expect(result.error.code).toBe(code);
  expect(result.error.message).not.toMatch(/stack|SQL|SELECT|passwordHash|tokenHash|node_modules/i);
  expect(result.error.requestId).toBeTruthy();
  return result;
}

async function login(tenant = "a") {
  const response = await request("/api/auth/login", "POST", {
    email: `${tenant}@example.test`,
    password,
  });
  expect(response.status).toBe(200);
  const result = await response.json();
  Operator.strict().parse(result);
  OrganizationPublic.strict().parse(result.organization);
  result.offices.forEach((office: unknown) => Office.strict().parse(office));
  const header = response.headers.get("set-cookie");
  expect(header).toContain("HttpOnly");
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Path=/api");
  const cookie = header?.split(";")[0];
  if (!cookie) throw new Error("Session cookie missing");
  return cookie;
}

async function start(language: Language = "it", tenant = "a") {
  const response = await request("/api/intake", "POST", {
    officeSlug: `test-${tenant}`,
    language,
    practiceId: "isee_ordinario",
    privacyAccepted: true,
  });
  expect(response.status).toBe(201);
  return StartIntakeResponse.parse(await response.json());
}

function answerFor(question: Question): AnswerValue {
  switch (question.kind) {
    case "members":
      return [{ role: "richiedente", firstName: "Persona", lastName: "Esempio", birthYear: 1985 }];
    case "yes_no":
      return false;
    case "number":
      return question.min ?? 0;
    case "single_choice": {
      const option = question.options?.[0];
      if (!option) throw new Error(`No option for ${question.id}`);
      return option.value;
    }
    case "multi_choice":
      return [];
    case "date":
      return "2025-01-01";
    case "text":
      return "Dato di esempio";
  }
}

async function completeInterview(token: string, initial: CitizenCase) {
  let view = initial;
  for (let turn = 0; view.nextQuestion && turn < 100; turn++) {
    const response = await request(`/api/c/${token}/turn`, "POST", {
      type: "answer",
      questionId: view.nextQuestion.id,
      value: answerFor(view.nextQuestion),
    });
    expect(response.status, `Question ${view.nextQuestion.id}`).toBe(200);
    view = CitizenCase.parse(await response.json());
  }
  expect(view.nextQuestion).toBeNull();
  return view;
}

async function examplePdf(label = "ESEMPIO") {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([300, 200]).drawText(label, { x: 20, y: 100, font, size: 12 });
  return new Uint8Array(await pdf.save());
}

function upload(
  token: string,
  bytes: Uint8Array,
  fileName: string,
  itemId?: string,
  declaredType = "application/pdf",
) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], fileName, { type: declaredType }));
  if (itemId) form.set("checklistItemId", itemId);
  return app.request(`/api/c/${token}/documents`, {
    method: "POST",
    body: form,
    headers: { Origin: origin },
  });
}

const submitInput = {
  contact: { firstName: "Persona", lastName: "Esempio", email: "persona@example.test" },
  confirmed: true,
};

describe("public API and validation", () => {
  it("returns health, localized catalog and only public office details", async () => {
    const health = await request("/api/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok", fallbackCount: 0 });
    const catalog = await request("/api/practices?lang=bn");
    expect(catalog.status).toBe(200);
    const value: unknown = await catalog.json();
    expect(Array.isArray(value)).toBe(true);
    const office = await request("/api/offices/test-a");
    expect(office.status).toBe(200);
    const payload = await office.json();
    OrganizationPublic.strict().parse(payload.organization);
    Office.strict().parse(payload.office);
    const publicData = JSON.stringify(payload);
    expect(publicData).toContain("CAF Fittizio a");
    expect(publicData).not.toMatch(/password|token|session|baseline/i);
    await error(await request("/api/practices?lang=xx"), 400, "bad_request");
    await error(await request("/api/offices/nonexistent"), 404, "not_found");
  });

  it("requires privacy acceptance, supported practices and valid JSON", async () => {
    await error(
      await request("/api/intake", "POST", { officeSlug: "test-a", privacyAccepted: false }),
      400,
      "bad_request",
    );
    await error(
      await request("/api/intake", "POST", {
        officeSlug: "test-a",
        practiceId: "naspi",
        privacyAccepted: true,
      }),
      400,
      "practice_unavailable",
    );
    await error(
      await request("/api/intake", "POST", { officeSlug: "wrong", privacyAccepted: true }),
      404,
      "not_found",
    );
    await error(
      await app.request("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: "{",
      }),
      400,
      "bad_request",
    );
    const intake = await start();
    await error(
      await request(`/api/c/${intake.token}/turn`, "POST", {
        type: "answer",
        questionId: "invented",
        value: true,
      }),
      400,
      "bad_request",
    );
    await error(
      await request(`/api/c/${intake.token}/language`, "PUT", { language: "xx" }),
      400,
      "bad_request",
    );
    await error(
      await request(`/api/c/${intake.token}/submit`, "POST", { ...submitInput, confirmed: false }),
      400,
      "bad_request",
    );
    await error(
      await request(`/api/c/${intake.token}/submit`, "POST", submitInput),
      409,
      "conflict",
    );
  });

  it("stores valid leads while rejecting honeypots and missing privacy acceptance", async () => {
    const input = {
      name: "Operatore Fittizio",
      organization: "CAF Esempio",
      email: "lead@example.test",
      privacyAccepted: true,
    };
    expect((await request("/api/leads", "POST", input)).status).toBe(201);
    await error(
      await request("/api/leads", "POST", { ...input, website: "spam" }),
      400,
      "bad_request",
    );
    await error(
      await request("/api/leads", "POST", { ...input, privacyAccepted: false }),
      400,
      "bad_request",
    );
    expect(await db.select().from(leads)).toHaveLength(1);
  });
});

describe("citizen to operator integration", () => {
  it("classifies a text turn without external keys and preserves answers when changing language", async () => {
    const response = await request("/api/intake", "POST", {
      officeSlug: "test-a",
      language: "it",
      privacyAccepted: true,
    });
    expect(response.status).toBe(201);
    const intake = StartIntakeResponse.parse(await response.json());
    expect(intake.case.practice).toBeNull();
    const turn = await request(`/api/c/${intake.token}/turn`, "POST", {
      type: "text",
      text: "Devo fare l'ISEE, ho due conti Fineco e non ho la macchina.",
    });
    expect(turn.status).toBe(200);
    const view = CitizenCase.parse(await turn.json());
    expect(view.engine).toBe("heuristic");
    expect(view.practice?.id).toBe("isee_ordinario");
    expect(view.answers.accounts_count).toBe(2);
    expect(view.answers.vehicles_count).toBe(0);
    expect(view.messages.some((message) => message.role === "assistant")).toBe(true);
    const changed = await request(`/api/c/${intake.token}/language`, "PUT", { language: "ar" });
    expect(changed.status).toBe(200);
    const arabic = CitizenCase.parse(await changed.json());
    expect(arabic.language).toBe("ar");
    expect(arabic.answers).toEqual(view.answers);
    expect(arabic.nextQuestion?.prompt).toMatch(/[\u0600-\u06ff]/);
  });

  it("completes interview, upload, submission, review, integration request and both exports", async () => {
    const intake = await start("bn");
    let view = await completeInterview(intake.token, intake.case);
    expect(view.household).toHaveLength(1);
    expect(view.reference).toMatch(/^AV-2027-\d+$/);
    let documentNumber = 0;
    for (const item of view.checklist.filter((item) => item.required)) {
      const bytes = await examplePdf(`ESEMPIO ${++documentNumber}`);
      const response = await upload(intake.token, bytes, `${item.requirementId}_2025.pdf`, item.id);
      expect(response.status).toBe(201);
      view = CitizenCase.parse(await response.json());
    }
    expect(view.documents.length).toBeGreaterThan(0);
    expect(view.documents.every((document) => document.analysis?.engine === "heuristic")).toBe(
      true,
    );
    instant = new Date("2027-01-05T10:12:00Z");
    const submitted = await request(`/api/c/${intake.token}/submit`, "POST", submitInput);
    expect(submitted.status).toBe(200);
    expect(CitizenCase.parse(await submitted.json()).status).toBe("submitted");
    await error(
      await request(`/api/c/${intake.token}/turn`, "POST", { type: "text", text: "Nuovi dati" }),
      409,
      "conflict",
    );
    const cookie = await login();
    const opened = await request(`/api/cases/${view.id}`, "PATCH", { status: "in_review" }, cookie);
    expect(opened.status).toBe(200);
    let dossier = CaseDossier.parse(await opened.json());
    expect(dossier.status).toBe("in_review");
    expect(dossier.timing.citizenMinutes).toBe(12);
    expect(dossier.headline).toContain("ISEE");
    expect(dossier.citizenLink).toBeNull();
    const item = dossier.checklist[0];
    if (!item) throw new Error("Checklist missing");
    const reviewed = await request(
      `/api/cases/${view.id}/checklist/${item.id}/review`,
      "POST",
      { decision: "verified" },
      cookie,
    );
    expect(reviewed.status).toBe(200);
    dossier = CaseDossier.parse(await reviewed.json());
    expect(dossier.checklist.find((entry) => entry.id === item.id)?.status).toBe("verified");
    const italianMessage = "Porta la copia completa del documento di identità.";
    const integration = await request(
      `/api/cases/${view.id}/requests`,
      "POST",
      { checklistItemIds: [item.id], message: italianMessage },
      cookie,
    );
    expect(integration.status).toBe(200);
    expect(CaseDossier.parse(await integration.json()).status).toBe("needs_citizen");
    const citizen = CitizenCase.parse(await (await request(`/api/c/${intake.token}`)).json());
    const operatorMessage = citizen.messages.find((message) => message.role === "operator");
    expect(operatorMessage?.originalText).toContain(italianMessage);
    expect(operatorMessage?.text).not.toBe(italianMessage);
    expect(operatorMessage?.text).toMatch(/[\u0980-\u09ff]/);
    const jsonExport = await request(
      `/api/cases/${view.id}/export?format=json`,
      "GET",
      undefined,
      cookie,
    );
    expect(jsonExport.status).toBe(200);
    CaseDossier.parse(await jsonExport.json());
    const pdfExport = await request(
      `/api/cases/${view.id}/export?format=pdf`,
      "GET",
      undefined,
      cookie,
    );
    expect(pdfExport.status).toBe(200);
    expect(pdfExport.headers.get("content-type")).toContain("application/pdf");
    expect((await PDFDocument.load(await pdfExport.arrayBuffer())).getPageCount()).toBeGreaterThan(
      0,
    );
    const metricsResponse = await request(
      "/api/metrics?from=2027-01-05&to=2027-01-05",
      "GET",
      undefined,
      cookie,
    );
    expect(metricsResponse.status).toBe(200);
    const metrics = Metrics.parse(await metricsResponse.json());
    expect(metrics.casesStarted).toBe(1);
    expect(metrics.casesSubmitted).toBe(1);
    expect(metrics.avgCitizenMinutes).toBe(12);
    expect(metrics.baselineMinutesPerCase).toBe(30);
    const audit = await db.select().from(events).where(eq(events.caseId, view.id));
    expect(audit.some((event) => event.type === "privacy.accepted")).toBe(true);
    expect(audit.some((event) => event.type === "case.submitted")).toBe(true);
    expect(
      audit.every((event) =>
        Object.values(event.metadata).every(
          (value) => value === null || typeof value === "number" || typeof value === "boolean",
        ),
      ),
    ).toBe(true);
    const serializedLogs = JSON.stringify(logs);
    for (const secret of [
      intake.token,
      password,
      "Persona",
      "persona@example.test",
      italianMessage,
    ])
      expect(serializedLogs).not.toContain(secret);
  }, 20_000);

  it("keeps household persistence isolated when two cases contain identical names", async () => {
    const first = await start();
    const second = await start();
    const firstView = await completeInterview(first.token, first.case);
    const secondView = await completeInterview(second.token, second.case);
    expect(firstView.household[0]?.firstName).toBe("Persona");
    expect(secondView.household[0]?.firstName).toBe("Persona");
    expect((await request(`/api/c/${first.token}`)).status).toBe(200);
  });

  it("never exposes internal notes, storage keys, password hashes or token hashes to citizens", async () => {
    const intake = await start();
    await db
      .update(cases)
      .set({ internalNotes: "NOTA-RISERVATA-OPERATORE" })
      .where(eq(cases.id, intake.case.id));
    const response = await request(`/api/c/${intake.token}`);
    const text = await response.text();
    CitizenCase.parse(JSON.parse(text));
    expect(text).not.toContain("NOTA-RISERVATA-OPERATORE");
    expect(text).not.toMatch(/tokenHash|token_hash|storageKey|passwordHash/);
    expect(text).not.toContain(intake.token);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const [stored] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
    expect(stored?.tokenHash).toBe(hashToken(intake.token));
    expect(stored?.tokenHash).not.toBe(intake.token);
  });
});

describe("uploads and case boundaries", () => {
  it("reports duplicate content without discarding either uploaded file", async () => {
    const intake = await start();
    const bytes = await examplePdf("ESEMPIO DUPLICATO");
    expect((await upload(intake.token, bytes, "prima.pdf")).status).toBe(201);
    const response = await upload(intake.token, bytes, "seconda.pdf");
    expect(response.status).toBe(201);
    const view = CitizenCase.parse(await response.json());
    expect(view.documents).toHaveLength(2);
    expect(view.findings.some((finding) => finding.code.includes("duplicate"))).toBe(true);
    const stored = await db.select().from(documents).where(eq(documents.caseId, view.id));
    expect(stored[0]?.sha256).toBe(stored[1]?.sha256);
  });

  it("retains uploads as unmatched when editing an answer removes their requirement", async () => {
    const intake = await start();
    let view = await completeInterview(intake.token, intake.case);
    const rent = view.checklist.find((item) => item.requirementId === "rent");
    const identity = view.checklist.find((item) => item.requirementId === "identity");
    if (!rent || !identity) throw new Error("Fixture incomplete");
    const bytes = await examplePdf("ESEMPIO AFFITTO");
    const uploaded = await upload(intake.token, bytes, "contratto.pdf", rent.id);
    expect(uploaded.status).toBe(201);
    view = CitizenCase.parse(await uploaded.json());
    const document = view.documents[0];
    if (!document) throw new Error("Document missing");
    const edited = await request(`/api/c/${intake.token}/turn`, "POST", {
      type: "edit",
      questionId: "housing",
    });
    expect(edited.status).toBe(200);
    expect(CitizenCase.parse(await edited.json()).nextQuestion?.id).toBe("housing");
    const changed = await request(`/api/c/${intake.token}/turn`, "POST", {
      type: "answer",
      questionId: "housing",
      value: "owned",
    });
    expect(changed.status).toBe(200);
    view = CitizenCase.parse(await changed.json());
    expect(view.checklist.some((item) => item.id === rent.id)).toBe(false);
    expect(view.checklist.find((item) => item.requirementId === "identity")?.id).toBe(identity.id);
    expect(view.documents.find((item) => item.id === document.id)?.checklistItemId).toBeNull();
    const downloaded = await request(`/api/c/${intake.token}/documents/${document.id}/file`);
    expect(downloaded.status).toBe(200);
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bytes);
  });

  it("checks bytes instead of extension, stores SHA-256 of the actual file, and downloads safely", async () => {
    const intake = await start();
    const bytes = await examplePdf();
    const uploaded = await upload(
      intake.token,
      bytes,
      '../ESEMPIO"\n.pdf.exe',
      undefined,
      "application/pdf",
    );
    expect(uploaded.status).toBe(201);
    const view = CitizenCase.parse(await uploaded.json());
    const document = view.documents[0];
    if (!document) throw new Error("Document missing");
    expect(document.mimeType).toBe("application/pdf");
    expect(document.fileName).not.toMatch(/[\/\\\n\r"]/);
    expect(document.analysis?.engine).toBe("heuristic");
    const [stored] = await db.select().from(documents).where(eq(documents.id, document.id));
    expect(stored?.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    const downloaded = await request(`/api/c/${intake.token}/documents/${document.id}/file`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-disposition")).toContain("attachment;");
    expect(downloaded.headers.get("content-disposition")).not.toMatch(/[\r\n]/);
    expect(downloaded.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bytes);
  });

  it("rejects unsupported signatures, malformed PDFs and oversized uploads", async () => {
    const intake = await start();
    await error(
      await upload(
        intake.token,
        new TextEncoder().encode("<script>ESEMPIO</script>"),
        "identity.pdf",
      ),
      415,
      "unsupported_file",
    );
    await error(
      await upload(intake.token, new TextEncoder().encode("%PDF-broken"), "example.pdf"),
      415,
      "unsupported_file",
    );
    await error(
      await upload(intake.token, new Uint8Array(UPLOAD_LIMITS.maxBytes + 1), "large.pdf"),
      413,
      "file_too_large",
    );
    expect(await db.select().from(documents)).toHaveLength(0);
  });

  it("reassigns and deletes its own documents while keeping another case inaccessible", async () => {
    const first = await start();
    const second = await start();
    let view = await completeInterview(first.token, first.case);
    const uploaded = await upload(first.token, await examplePdf(), "ESEMPIO.pdf");
    expect(uploaded.status).toBe(201);
    view = CitizenCase.parse(await uploaded.json());
    const document = view.documents[0];
    const item = view.checklist[0];
    if (!document || !item) throw new Error("Fixture incomplete");
    await error(
      await request(`/api/c/${second.token}/documents/${document.id}/file`),
      404,
      "not_found",
    );
    await error(
      await request(`/api/c/${second.token}/documents/${document.id}`, "DELETE"),
      404,
      "not_found",
    );
    await error(
      await request(`/api/c/${first.token}/documents/${document.id}`, "PATCH", {
        checklistItemId: "invented",
      }),
      400,
      "bad_request",
    );
    const assigned = await request(`/api/c/${first.token}/documents/${document.id}`, "PATCH", {
      checklistItemId: item.id,
    });
    expect(assigned.status).toBe(200);
    expect(CitizenCase.parse(await assigned.json()).documents[0]?.checklistItemId).toBe(item.id);
    const unassigned = await request(`/api/c/${first.token}/documents/${document.id}`, "PATCH", {
      checklistItemId: null,
    });
    expect(unassigned.status).toBe(200);
    expect(CitizenCase.parse(await unassigned.json()).documents[0]?.checklistItemId).toBeNull();
    expect((await request(`/api/c/${first.token}/documents/${document.id}`, "DELETE")).status).toBe(
      200,
    );
    await error(
      await request(`/api/c/${first.token}/documents/${document.id}/file`),
      404,
      "not_found",
    );
  });
});

describe("authentication and tenant isolation", () => {
  it("uses Secure production cookies and renews an unexpired session with the passed clock", async () => {
    app = createApp({
      db,
      storage: new MemoryStorage(),
      clock: () => new Date(instant),
      publicUrl: origin,
      production: true,
      mfaEncryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      rateLimitSecret: "test-only-rate-secret",
      clientAddress: () => "127.0.0.1",
    });
    const response = await request("/api/auth/login", "POST", {
      email: "a@example.test",
      password,
    });
    expect(response.status).toBe(200);
    const header = response.headers.get("set-cookie");
    expect(header).toContain("Secure");
    expect(header).toContain("HttpOnly");
    const cookie = header?.split(";")[0];
    if (!cookie) throw new Error("Session cookie missing");
    const token = cookie.slice(cookie.indexOf("=") + 1);
    const [before] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
    instant = new Date(instant.getTime() + 15 * 60 * 1000);
    expect((await request("/api/cases", "POST", { officeId: "office-a" }, cookie)).status).toBe(
      201,
    );
    const [after] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
    expect(Date.parse(after?.expiresAt ?? "")).toBe(
      Date.parse(before?.expiresAt ?? "") + 15 * 60 * 1000,
    );
  });

  it("returns null unobserved metrics instead of fabricated times or percentages", async () => {
    const cookie = await login();
    const response = await request(
      "/api/metrics?from=2027-01-05&to=2027-01-05",
      "GET",
      undefined,
      cookie,
    );
    expect(response.status).toBe(200);
    const result = Metrics.parse(await response.json());
    expect(result.casesStarted).toBe(0);
    expect(result.casesSubmitted).toBe(0);
    expect(result.completeAtFirstSubmission).toBeNull();
    expect(result.avgCitizenMinutes).toBeNull();
    expect(result.avgReviewMinutes).toBeNull();
    expect(result.needsCitizenRate).toBeNull();
    expect(result.baselineMinutesPerCase).toBe(30);
  });

  it("rejects missing/wrong Origin for login and operator mutations", async () => {
    await error(
      await request(
        "/api/auth/login",
        "POST",
        { email: "a@example.test", password },
        undefined,
        "https://other.example",
      ),
      403,
      "forbidden",
    );
    await error(
      await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@example.test", password }),
      }),
      403,
      "forbidden",
    );
    const intake = await start();
    const cookie = await login();
    await error(
      await request(
        `/api/cases/${intake.case.id}`,
        "PATCH",
        { internalNotes: "non consentito" },
        cookie,
        "https://other.example",
      ),
      403,
      "forbidden",
    );
    const [row] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
    expect(row?.internalNotes).toBeNull();
  });

  it.each(["http://127.0.0.1:3500", "http://localhost:3501", "https://preview-avanti.vercel.app"])(
    "accepts the actual request origin %s without changing PUBLIC_APP_URL",
    async (requestOrigin) => {
      const response = await app.request(`${requestOrigin}/api/auth/login`, {
        method: "POST",
        headers: { Origin: requestOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@example.test", password }),
      });
      expect(response.status).toBe(200);
      Operator.parse(await response.json());
    },
  );

  it("accepts the incoming Host when Next normalizes the request URL to localhost", async () => {
    const response = await app.request("http://localhost:3417/api/auth/login", {
      method: "POST",
      headers: {
        Host: "127.0.0.1:3417",
        Origin: "http://127.0.0.1:3417",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "a@example.test", password }),
    });
    expect(response.status).toBe(200);
    Operator.parse(await response.json());
    await error(
      await app.request("http://localhost:3417/api/auth/login", {
        method: "POST",
        headers: {
          Host: "127.0.0.1:3417",
          Origin: "https://foreign.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "a@example.test", password }),
      }),
      403,
      "forbidden",
    );
  });

  it("uses Sec-Fetch-Site only when Origin is missing", async () => {
    const auth = { email: "a@example.test", password };
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" },
      body: JSON.stringify(auth),
    });
    expect(response.status).toBe(200);
    const rejectedHeaders: Record<string, string>[] = [
      { "Sec-Fetch-Site": "same-site" },
      { "Sec-Fetch-Site": "cross-site" },
      { Origin: "null", "Sec-Fetch-Site": "same-origin" },
      { Origin: "https://foreign.example", "Sec-Fetch-Site": "same-origin" },
    ];
    for (const headers of rejectedHeaders) {
      await error(
        await app.request("/api/auth/login", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(auth),
        }),
        403,
        "forbidden",
      );
    }
  });

  it("authorizes the bare citizen route and shows localized disclosure with only public data", async () => {
    const intake = await start("bn");
    expect(intake.case.messages[0]?.role).toBe("system");
    expect(intake.case.messages[0]?.text).toContain("AI");
    await error(await request("/api/c/not-a-token"), 404, "not_found");
    const response = await request(`/api/c/${intake.token}`);
    expect(response.status).toBe(200);
    const payload = await response.json();
    CitizenCase.strict().parse(payload);
    OrganizationPublic.strict().parse(payload.organization);
    Office.strict().parse(payload.office);
  });

  it("expires citizen capabilities and sessions at their boundary and revokes logout", async () => {
    const intake = await start();
    await db
      .update(cases)
      .set({ expiresAt: instant.toISOString() })
      .where(eq(cases.id, intake.case.id));
    await error(await request(`/api/c/${intake.token}`), 410, "link_expired");
    await error(await request(`/api/c/${"a".repeat(43)}`), 404, "not_found");
    const cookie = await login();
    const token = cookie.slice(cookie.indexOf("=") + 1);
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
    expect(session?.tokenHash).not.toBe(token);
    await db
      .update(sessions)
      .set({ expiresAt: instant.toISOString() })
      .where(eq(sessions.tokenHash, hashToken(token)));
    await error(await request("/api/auth/me", "GET", undefined, cookie), 401, "unauthorized");
    const freshCookie = await login();
    expect((await request("/api/auth/logout", "POST", undefined, freshCookie)).status).toBe(200);
    await error(await request("/api/auth/me", "GET", undefined, freshCookie), 401, "unauthorized");
    await error(await request("/api/cases"), 401, "unauthorized");
  });

  it("returns uniform login errors and limits repeated attempts", async () => {
    const absent = await error(
      await request("/api/auth/login", "POST", { email: "absent@example.test", password }),
      401,
      "unauthorized",
    );
    const wrong = await error(
      await request("/api/auth/login", "POST", { email: "a@example.test", password: "wrong" }),
      401,
      "unauthorized",
    );
    expect(absent.error.message).toBe(wrong.error.message);
    for (let attempt = 1; attempt < 10; attempt++) {
      await error(
        await request("/api/auth/login", "POST", { email: "a@example.test", password: "wrong" }),
        401,
        "unauthorized",
      );
    }
    const limited = await request("/api/auth/login", "POST", { email: "a@example.test", password });
    await error(limited, 429, "rate_limited");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    instant = new Date(instant.getTime() + 61_000);
    expect(
      (await request("/api/auth/login", "POST", { email: "a@example.test", password })).status,
    ).toBe(200);
  });

  it("filters every operator surface by organization, including foreign keys", async () => {
    const first = await start();
    const second = await start("ar", "b");
    const view = await completeInterview(first.token, first.case);
    const uploaded = await upload(first.token, await examplePdf(), "ESEMPIO.pdf");
    expect(uploaded.status).toBe(201);
    const document = CitizenCase.parse(await uploaded.json()).documents[0];
    const item = view.checklist[0];
    if (!document || !item) throw new Error("Fixture incomplete");
    const cookie = await login("b");
    const inaccessible: [string, string, unknown?][] = [
      [`/api/cases/${first.case.id}`, "GET"],
      [`/api/cases/${first.case.id}`, "PATCH", { status: "in_review" }],
      [`/api/cases/${first.case.id}/checklist/${item.id}/review`, "POST", { decision: "verified" }],
      [
        `/api/cases/${first.case.id}/requests`,
        "POST",
        { checklistItemIds: [item.id], message: "Richiesta esempio" },
      ],
      [`/api/cases/${first.case.id}/documents/${document.id}/file`, "GET"],
      [`/api/cases/${first.case.id}/export?format=json`, "GET"],
      [`/api/cases/${first.case.id}/export?format=pdf`, "GET"],
      [`/api/cases/${first.case.id}/dsu-sheet`, "GET"],
    ];
    for (const [path, method, body] of inaccessible)
      await error(await request(path, method, body, cookie), 404, "not_found");
    await error(
      await request("/api/cases", "POST", { officeId: "office-a" }, cookie),
      404,
      "not_found",
    );
    await error(
      await request(`/api/cases/${second.case.id}`, "PATCH", { assigneeId: "operator-a" }, cookie),
      404,
      "not_found",
    );
    const list = CaseListResponse.parse(
      await (await request("/api/cases", "GET", undefined, cookie)).json(),
    );
    expect(list.items.map((row) => row.id)).toEqual([second.case.id]);
    expect(Object.values(list.counts).reduce((sum, count) => sum + count, 0)).toBe(1);
    const metrics = Metrics.parse(
      await (
        await request("/api/metrics?from=2027-01-05&to=2027-01-05", "GET", undefined, cookie)
      ).json(),
    );
    expect(metrics.casesStarted).toBe(1);
    const [unchanged] = await db
      .select()
      .from(cases)
      .where(and(eq(cases.id, first.case.id), eq(cases.organizationId, "org-a")));
    expect(unchanged?.status).toBe("intake");
    expect(
      await db
        .select()
        .from(events)
        .where(and(eq(events.caseId, first.case.id), eq(events.actor, "operator"))),
    ).toHaveLength(0);
  });

  it("creates an operator case with a capability shown once and keeps list pagination stable", async () => {
    const cookie = await login();
    const created = await request(
      "/api/cases",
      "POST",
      { officeId: "office-a", practiceId: "isee_ordinario", language: "uk" },
      cookie,
    );
    expect(created.status).toBe(201);
    const result = CreateCaseResponse.parse(await created.json());
    expect(result.citizenLink).toMatch(/^http:\/\/localhost:3400\/pratica\/[A-Za-z0-9_-]{43}$/);
    const token = result.citizenLink.split("/").at(-1);
    if (!token) throw new Error("Missing capability");
    expect((await request(`/api/c/${token}`)).status).toBe(200);
    await start();
    await start();
    const firstPage = CaseListResponse.parse(
      await (await request("/api/cases?limit=1", "GET", undefined, cookie)).json(),
    );
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).toBeTruthy();
    const secondPage = CaseListResponse.parse(
      await (
        await request(
          `/api/cases?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor ?? "")}`,
          "GET",
          undefined,
          cookie,
        )
      ).json(),
    );
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
    await error(await request("/api/cases?limit=0", "GET", undefined, cookie), 400, "bad_request");
    await error(
      await request("/api/metrics?from=2027-02-30&to=2027-03-01", "GET", undefined, cookie),
      400,
      "bad_request",
    );
  });
});

describe("second backend review", () => {
  it("4: reading a submitted dossier preserves the queue timestamp and records only access events", async () => {
    const intake = await start();
    await db.update(cases).set({ status: "submitted" }).where(eq(cases.id, intake.case.id));
    const cookie = await login();
    const before = await db.select().from(events).where(eq(events.caseId, intake.case.id));
    const sessionsBefore = await db.select().from(sessions);
    instant = new Date(instant.getTime() + 1000);
    const view = CaseDossier.parse(
      await (await request(`/api/cases/${intake.case.id}`, "GET", undefined, cookie)).json(),
    );
    expect(view.status).toBe("submitted");
    expect(view.updatedAt).toBe(initialInstant);
    const after = await db.select().from(events).where(eq(events.caseId, intake.case.id));
    expect(
      after.filter((event) => !["case.viewed", "dsu_sheet.viewed"].includes(event.type)),
    ).toEqual(before);
    expect(after.filter((event) => event.type === "case.viewed")).toHaveLength(1);
    expect((await db.select().from(sessions))[0]?.id).toBe(sessionsBefore[0]?.id);
  });
  it.each(["intake", "submitted", "in_review", "needs_citizen", "ready"] as const)(
    "8,24: closes %s and reopens with explicit timeline events",
    async (status) => {
      const intake = await start();
      await db.update(cases).set({ status }).where(eq(cases.id, intake.case.id));
      const cookie = await login();
      const closed = await request(
        `/api/cases/${intake.case.id}`,
        "PATCH",
        { status: "closed" },
        cookie,
      );
      expect(closed.status).toBe(200);
      expect(
        CaseDossier.parse(await closed.json()).timeline.some((e) => e.type === "case.closed"),
      ).toBe(true);
      const reopened = await request(
        `/api/cases/${intake.case.id}`,
        "PATCH",
        { status: "in_review", assigneeId: "operator-a" },
        cookie,
      );
      expect(reopened.status).toBe(200);
      const view = CaseDossier.parse(await reopened.json());
      expect(view.timeline.find((e) => e.type === "case.reopened")?.actorName).toBe(
        "Operatore Fittizio a",
      );
      expect(view.timeline.some((e) => e.type === "case.assigned")).toBe(true);
    },
  );
  it("7,27,30,32,33: free text has readable inferred answers, roles and an acknowledgement", async () => {
    const intake = await start();
    const response = await request(`/api/c/${intake.token}/turn`, "POST", {
      type: "text",
      text: "ISEE vivo con mia madre sotto lo stesso tetto, mio padre non vive con noi, ho un conto Fineco e una macchina",
    });
    const view = CitizenCase.parse(await response.json());
    expect(view.answered.find((a) => a.questionId === "household_count")).toMatchObject({
      answer: "2",
      editable: false,
    });
    expect(view.answers.household_roles).toEqual(["richiedente", "genitore"]);
    expect(view.answers.nonresident_parent).toBeUndefined();
    expect(view.answers.applicant_parent_nonresident).toBe(true);
    expect(view.messages.find((m) => m.role === "assistant")?.text).toContain("Fineco");
    expect(view.messages.find((m) => m.role === "assistant")?.text).not.toBe(
      view.nextQuestion?.prompt,
    );
    expect(view.findings.some((f) => f.code.startsWith("practice."))).toBe(false);
    const explicit = CitizenCase.parse(
      await (
        await request(`/api/c/${intake.token}/turn`, "POST", {
          type: "answer",
          questionId: "household_count",
          value: 2,
        })
      ).json(),
    );
    expect(explicit.engine).toBeUndefined();
    expect(explicit.answered.find((a) => a.questionId === "household_count")?.editable).toBe(true);
  });
  it("9,11,28,29: request retains selected items, localized titles, contact and resubmission", async () => {
    const intake = await start();
    const view = await completeInterview(intake.token, intake.case);
    const contact = { firstName: "Persona", lastName: "Esempio", email: "citizen@example.test" };
    expect(
      (await request(`/api/c/${intake.token}/submit`, "POST", { contact, confirmed: true })).status,
    ).toBe(200);
    const cookie = await login();
    expect(
      (await request(`/api/cases/${view.id}`, "PATCH", { status: "in_review" }, cookie)).status,
    ).toBe(200);
    const item = view.checklist[0]!;
    const response = await request(
      `/api/cases/${view.id}/requests`,
      "POST",
      { checklistItemIds: [item.id], message: "Carica una copia chiara" },
      cookie,
    );
    expect(response.status).toBe(200);
    const citizen = CitizenCase.parse(await (await request(`/api/c/${intake.token}`)).json());
    expect(citizen.contact).toEqual(contact);
    expect(citizen.checklist.find((i) => i.id === item.id)).toMatchObject({
      status: "rejected",
      note: "Carica una copia chiara",
    });
    expect(citizen.messages.find((m) => m.role === "operator")?.text).toContain(item.title);
    expect(CaseDossier.parse(await response.json()).answers.some((a) => a.answer === "false")).toBe(
      false,
    );
    const resubmitted = await request(`/api/c/${intake.token}/submit`, "POST", {
      contact,
      confirmed: true,
    });
    expect(resubmitted.status).toBe(200);
    expect(CitizenCase.parse(await resubmitted.json()).status).toBe("submitted");
  });
  it("10: files are attachments; download filename follows detected MIME", async () => {
    const intake = await start();
    const view = CitizenCase.parse(
      await (await upload(intake.token, await examplePdf(), "report\u202Efdp.exe")).json(),
    );
    const doc = view.documents[0]!;
    const preview = await request(`/api/c/${intake.token}/documents/${doc.id}/file`);
    expect(preview.headers.get("content-disposition")).toContain("attachment;");
    expect(preview.headers.get("content-security-policy")).toContain("sandbox");
    expect(doc.fileName).not.toContain("\u202E");
    expect(doc.fileName).toMatch(/\.pdf$/);
    const download = await request(`/api/c/${intake.token}/documents/${doc.id}/file?download=1`);
    expect(download.headers.get("content-disposition")).toContain("attachment;");
  });
  it("11: newly created operator dossier includes the one-time link", async () => {
    const cookie = await login();
    const result = CreateCaseResponse.parse(
      await (await request("/api/cases", "POST", { officeId: "office-a" }, cookie)).json(),
    );
    expect(result.case.citizenLink).toBe(result.citizenLink);
    expect(
      CaseDossier.parse(
        await (await request(`/api/cases/${result.case.id}`, "GET", undefined, cookie)).json(),
      ).citizenLink,
    ).toBeNull();
  });
  it("17: active sessions cannot survive 12 hours", async () => {
    const cookie = await login();
    for (let minutes = 20; minutes < 720; minutes += 20) {
      instant = new Date(Date.parse(initialInstant) + minutes * 60000);
      expect((await request("/api/auth/me", "GET", undefined, cookie)).status).toBe(200);
    }
    instant = new Date(Date.parse(initialInstant) + 12 * 3600000);
    expect((await request("/api/auth/me", "GET", undefined, cookie)).status).toBe(401);
    expect(await db.select().from(sessions)).toHaveLength(1);
    expect((await request("/api/cases", "POST", { officeId: "office-a" }, cookie)).status).toBe(
      401,
    );
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
  it("15: one email's failed attempts do not block a different local user", async () => {
    for (let attempt = 0; attempt < 10; attempt++)
      await request("/api/auth/login", "POST", { email: "a@example.test", password: "wrong" });
    expect(
      (await request("/api/auth/login", "POST", { email: "a@example.test", password: "wrong" }))
        .status,
    ).toBe(429);
    expect(
      (await request("/api/auth/login", "POST", { email: "b@example.test", password })).status,
    ).toBe(200);
  });
});

describe("storage and startup regressions", () => {
  it("14: failed file deletion leaves a durable retry and makes the file inaccessible", async () => {
    const storage = new MemoryStorage();
    app = createApp({ db, storage, clock: () => new Date(instant), publicUrl: origin });
    const intake = await start();
    const document = CitizenCase.parse(
      await (await upload(intake.token, await examplePdf(), "ESEMPIO.pdf")).json(),
    ).documents[0]!;
    const originalDelete = storage.delete.bind(storage);
    storage.delete = async () => {
      throw new Error("private storage error");
    };
    expect(
      (await request(`/api/c/${intake.token}/documents/${document.id}`, "DELETE")).status,
    ).toBe(200);
    expect((await request(`/api/c/${intake.token}/documents/${document.id}/file`)).status).toBe(
      404,
    );
    expect(await db.select().from(storageDeletions)).toHaveLength(1);
    storage.delete = originalDelete;
    instant = new Date(instant.getTime() + 61000);
    await request(`/api/c/${intake.token}/language`, "PUT", { language: "en" });
    expect(await db.select().from(storageDeletions)).toHaveLength(1);
    app = createApp({ db, storage, clock: () => new Date(instant), cronSecret: "test-cron" });
    await app.request("/api/cron/maintenance", { headers: { Authorization: "Bearer test-cron" } });
    expect(await db.select().from(storageDeletions)).toHaveLength(0);
  });
  it("16: production requires an explicit public origin", () => {
    expect(() => createApp({ db, storage: new MemoryStorage(), production: true })).toThrow(
      "PUBLIC_APP_URL",
    );
  });
  it("19: the 61st document is refused before AI/storage", async () => {
    const intake = await start();
    await db.insert(documents).values(
      Array.from({ length: 60 }, (_, i) => ({
        id: `limit-${i}`,
        caseId: intake.case.id,
        fileName: "ESEMPIO.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        storageKey: `unused-${i}`,
        sha256: String(i),
        uploadedAt: instant.toISOString(),
        status: "analyzed" as const,
      })),
    );
    expect((await upload(intake.token, await examplePdf(), "extra.pdf")).status).toBe(409);
    expect(await db.select().from(documents)).toHaveLength(60);
  });
});
it("5: listing 50 dossiers performs a bounded number of queries", async () => {
  const intake = await start();
  const [row] = await db.select().from(cases).where(eq(cases.id, intake.case.id));
  if (!row) throw new Error("Missing case");
  await db.insert(cases).values(
    Array.from({ length: 49 }, (_, i) => ({
      ...row,
      id: `case-list-${i}`,
      tokenHash: `list-hash-${i}`,
      reference: `LIST-${i}`,
    })),
  );
  const cookie = await login();
  const select = vi.spyOn(db, "select");
  const result = CaseListResponse.parse(
    await (await request("/api/cases?limit=50", "GET", undefined, cookie)).json(),
  );
  expect(result.items).toHaveLength(50);
  expect(select.mock.calls.length).toBeLessThanOrEqual(10);
  select.mockRestore();
});
it("2,18: operator visual verification allows ready despite erroneous AI observations", async () => {
  const intake = await start();
  let view = await completeInterview(intake.token, intake.case);
  const identity = view.checklist.find((i) => i.requirementId === "identity")!;
  view = CitizenCase.parse(
    await (await upload(intake.token, await examplePdf(), "identity.pdf", identity.id)).json(),
  );
  await db
    .update(documents)
    .set({
      analysis: {
        engine: "ai",
        confidence: 1,
        detectedRequirementId: "identity",
        detectedLabel: null,
        ownerName: "Different Owner",
        referenceYear: null,
        expiresOn: "2026-01-01",
        legible: false,
        pagesComplete: false,
        findings: [],
      },
    })
    .where(eq(documents.id, view.documents[0]!.id));
  await request(`/api/c/${intake.token}/submit`, "POST", {
    contact: { firstName: "Persona", lastName: "Esempio" },
    confirmed: true,
  });
  const cookie = await login();
  await request(`/api/cases/${view.id}`, "PATCH", { status: "in_review" }, cookie);
  for (const item of view.checklist.filter((i) => i.required)) {
    const decision = item.id === identity.id ? "verified" : "waived";
    expect(
      (
        await request(
          `/api/cases/${view.id}/checklist/${item.id}/review`,
          "POST",
          { decision, note: "Verifica di prova" },
          cookie,
        )
      ).status,
    ).toBe(200);
  }
  const response = await request(`/api/cases/${view.id}`, "PATCH", { status: "ready" }, cookie);
  expect(response.status).toBe(200);
  expect(
    CaseDossier.parse(await response.json()).timeline.some((e) => e.type === "checklist.verified"),
  ).toBe(true);
});
it("12: internal API failures emit a safe record and a safe Italian response", async () => {
  const errorLogger = vi.fn();
  const storage = new MemoryStorage();
  app = createApp({ db, storage, errorLogger, clock: () => new Date(instant) });
  const intake = await start();
  const [document] = await db
    .insert(documents)
    .values({
      id: "download-failure",
      caseId: intake.case.id,
      fileName: "ESEMPIO.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1,
      storageKey: "synthetic-download-failure",
      sha256: "synthetic",
      status: "analyzed",
      uploadedAt: initialInstant,
    })
    .returning();
  if (!document) throw new Error("Document fixture missing");
  storage.get = async () => {
    throw Object.assign(new Error("private-email@example.test"), {
      code: "XX001",
      detail: "private-content",
    });
  };
  const response = await request(`/api/c/${intake.token}/documents/${document.id}/file`);
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("private");
  expect(errorLogger).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Error",
      code: "XX001",
      requestId: expect.any(String),
      stack: expect.any(String),
    }),
  );
  expect(JSON.stringify(errorLogger.mock.calls)).not.toContain("private-email@example.test");
  expect(JSON.stringify(errorLogger.mock.calls)).not.toContain("private-content");
});
it("17: cron maintenance removes expired sessions and rate buckets", async () => {
  await db.insert(sessions).values({
    id: "expired",
    operatorId: "operator-a",
    tokenHash: "old",
    createdAt: "2027-01-04T10:00:00Z",
    expiresAt: "2027-01-06T10:00:00Z",
  });
  await db.insert(rateLimits).values({ key: "expired", count: 1, resetAt: "2027-01-04T10:00:00Z" });
  app = createApp({
    db,
    storage: new MemoryStorage(),
    clock: () => new Date(instant),
    cronSecret: "test-cron",
  });
  await app.request("/api/cron/maintenance", { headers: { Authorization: "Bearer test-cron" } });
  expect(await db.select().from(sessions)).toEqual([]);
  expect(await db.select().from(rateLimits)).toEqual([]);
});
it("14: upload cleanup failure preserves the original conflict and retains a retry", async () => {
  const storage = new MemoryStorage();
  app = createApp({
    db,
    storage,
    clock: () => new Date(instant),
    errorLogger: () => {},
    storageLogger: () => {},
  });
  const intake = await start();
  const originalPut = storage.put.bind(storage);
  storage.put = async (key, bytes) => {
    const storedKey = await originalPut(key, bytes);
    await db.update(cases).set({ status: "submitted" }).where(eq(cases.id, intake.case.id));
    return storedKey;
  };
  storage.delete = async () => {
    throw new Error("private cleanup details");
  };
  const response = await upload(intake.token, await examplePdf(), "ESEMPIO.pdf");
  expect(response.status).toBe(409);
  expect(ApiError.parse(await response.json()).error.code).toBe("conflict");
  expect(await db.select().from(documents)).toEqual([]);
  expect(await db.select().from(storageDeletions)).toHaveLength(1);
});
it("25: unclassified cases share the core's headline", async () => {
  const cookie = await login();
  const response = CreateCaseResponse.parse(
    await (await request("/api/cases", "POST", { officeId: "office-a" }, cookie)).json(),
  );
  const { dossierSummary } = await import("@avanti/core");
  expect(response.case.headline).toBe(dossierSummary(null, {}, []).headline);
});

describe("second backend review", () => {
  it("1: IDs are stored, preserved through edit and removed members lose documents/reviews", async () => {
    const intake = await start();
    await db
      .update(cases)
      .set({ answers: { household_count: 3 } })
      .where(eq(cases.id, intake.case.id));
    const members = [
      { role: "richiedente", firstName: "Test" },
      { role: "figlio", firstName: "Uno" },
      { role: "figlio", firstName: "Due" },
    ];
    const first = CitizenCase.parse(
      await (
        await request(`/api/c/${intake.token}/turn`, "POST", {
          type: "answer",
          questionId: "members",
          value: members,
        })
      ).json(),
    );
    expect(first.answers.members).toEqual(first.household);
    const removed = first.household[1]!;
    const survivor = first.household[2]!;
    await db.insert(documents).values({
      id: "removed-member",
      caseId: first.id,
      fileName: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storageKey: "unused",
      sha256: "unused",
      uploadedAt: instant.toISOString(),
      status: "analyzed",
      memberId: removed.id,
      checklistItemId: `identity:${removed.id}`,
    });
    await db.insert(checklistReviews).values({
      caseId: first.id,
      itemId: `identity:${removed.id}`,
      decision: "verified",
      reviewedAt: instant.toISOString(),
    });
    await request(`/api/c/${intake.token}/turn`, "POST", { type: "edit", questionId: "members" });
    await db
      .update(cases)
      .set({ answers: { ...first.answers, household_count: 2 } })
      .where(eq(cases.id, first.id));
    const updated = CitizenCase.parse(
      await (
        await request(`/api/c/${intake.token}/turn`, "POST", {
          type: "answer",
          questionId: "members",
          value: [first.household[0], survivor],
        })
      ).json(),
    );
    expect(updated.household[1]?.id).toBe(survivor.id);
    expect(updated.documents[0]).toMatchObject({ memberId: null, checklistItemId: null });
    expect(
      await db.select().from(checklistReviews).where(eq(checklistReviews.caseId, first.id)),
    ).toEqual([]);
    const [stored] = await db.select().from(documents).where(eq(documents.id, "removed-member"));
    expect(stored).toMatchObject({ memberId: null, checklistItemId: null });
  });
  it("5: actionable findings reach citizens", async () => {
    const intake = await start();
    const view = await completeInterview(intake.token, intake.case);
    const identity = view.checklist.find((i) => i.requirementId === "identity")!;
    const uploaded = CitizenCase.parse(
      await (await upload(intake.token, await examplePdf(), "test.pdf", identity.id)).json(),
    );
    await db
      .update(documents)
      .set({
        status: "failed",
        analysis: {
          engine: "ai",
          confidence: 1,
          detectedRequirementId: "income",
          detectedLabel: null,
          ownerName: "Altro Nome",
          referenceYear: null,
          expiresOn: null,
          legible: true,
          pagesComplete: true,
          findings: [],
        },
      })
      .where(eq(documents.id, uploaded.documents[0]!.id));
    const citizen = CitizenCase.parse(await (await request(`/api/c/${intake.token}`)).json());
    expect(citizen.findings.map((f) => f.code)).toEqual(
      expect.arrayContaining([
        "document.wrong_owner",
        "document.other_practice",
        "document.failed",
      ]),
    );
  });
  it("6: edit prioritizes that question, including later GET", async () => {
    const intake = await start();
    await request(`/api/c/${intake.token}/turn`, "POST", {
      type: "answer",
      questionId: "accounts_count",
      value: 2,
    });
    const response = await request(`/api/c/${intake.token}/turn`, "POST", {
      type: "edit",
      questionId: "accounts_count",
    });
    expect(CitizenCase.parse(await response.json()).nextQuestion?.id).toBe("accounts_count");
    expect(
      CitizenCase.parse(await (await request(`/api/c/${intake.token}`)).json()).nextQuestion?.id,
    ).toBe("accounts_count");
  });
  it("8: production without client identity fails configuration, socket transport works", async () => {
    const options = {
      db,
      storage: new MemoryStorage(),
      production: true,
      mfaEncryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      publicUrl: origin,
      rateLimitSecret: "test",
    };
    expect(() => createApp(options)).toThrow(/client|CLIENT|proxy|PROXY/);
    app = createApp({ ...options, transport: "node" });
    const response = await app.request(
      "/api/intake",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({
          officeSlug: "test-a",
          practiceId: "isee_ordinario",
          privacyAccepted: true,
        }),
      },
      { incoming: { socket: { remoteAddress: "127.0.0.1" } } },
    );
    expect(response.status).toBe(201);
  });
  it("11: POST never runs maintenance, cron authenticates and clears expired state", async () => {
    app = createApp({
      db,
      storage: new MemoryStorage(),
      clock: () => new Date(instant),
      cronSecret: "test-cron",
    });
    const cookie = await login();
    await db.update(sessions).set({ expiresAt: new Date(instant.getTime() - 1).toISOString() });
    await start();
    expect(await db.select().from(sessions)).toHaveLength(1);
    expect((await request("/api/cron/maintenance")).status).toBe(401);
    expect(
      (
        await app.request("/api/cron/maintenance", {
          headers: { Authorization: "Bearer test-cron" },
        })
      ).status,
    ).toBe(200);
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect(cookie).toBeTruthy();
  });
  it("13/B5: download/export audit GET and review transition is a single event", async () => {
    const intake = await start();
    const view = CitizenCase.parse(
      await (await upload(intake.token, await examplePdf(), "test.pdf")).json(),
    );
    const cookie = await login();
    await db.update(cases).set({ status: "submitted" }).where(eq(cases.id, view.id));
    await request(`/api/cases/${view.id}`, "PATCH", { status: "in_review" }, cookie);
    await request(
      `/api/cases/${view.id}/documents/${view.documents[0]!.id}/file`,
      "GET",
      undefined,
      cookie,
    );
    await request(`/api/cases/${view.id}/export`, "GET", undefined, cookie);
    const timeline = await db.select().from(events).where(eq(events.caseId, view.id));
    expect(
      timeline.filter((e) => ["case.in_review", "review.started"].includes(e.type)),
    ).toHaveLength(1);
    expect(timeline.filter((e) => e.type === "document.downloaded")).toHaveLength(1);
    expect(timeline.filter((e) => e.type === "case.exported")).toHaveLength(1);
  });
  it("B2: GET extends session up to the absolute cap", async () => {
    const cookie = await login();
    for (let minutes = 20; minutes <= 700; minutes += 20) {
      instant = new Date(Date.parse(initialInstant) + minutes * 60000);
      expect((await request("/api/auth/me", "GET", undefined, cookie)).status).toBe(200);
    }
    instant = new Date(Date.parse(initialInstant) + 710 * 60000);
    expect(
      (await request("/api/auth/me", "GET", undefined, cookie)).headers.get("set-cookie"),
    ).toBeTruthy();
    const [session] = await db.select().from(sessions);
    expect(Date.parse(session!.expiresAt)).toBe(Date.parse(initialInstant) + 12 * 3600000);
  });
  it("B6: health exposes only the numeric fallback count", async () => {
    const ai = new GatewayIntelligence();
    ai.fallbackCount = 7;
    app = createApp({ db, storage: new MemoryStorage(), ai });
    expect(await (await request("/api/health")).json()).toEqual({ status: "ok", fallbackCount: 7 });
  });
});
it("B1: rollback tombstone logs insert error separately from storage error", async () => {
  const storage = new MemoryStorage();
  const errorLogger = vi.fn();
  const storageLogger = vi.fn();
  app = createApp({ db, storage, errorLogger, storageLogger, clock: () => new Date(instant) });
  const intake = await start();
  storage.delete = async () => {
    throw new RangeError("storage private");
  };
  const originalTransaction = db.transaction.bind(db);
  const transaction = vi
    .spyOn(db, "transaction")
    .mockImplementationOnce(originalTransaction)
    .mockRejectedValueOnce(new Error("upload private"));
  const insert = db.insert.bind(db);
  const insertion = vi
    .spyOn(db, "insert")
    .mockImplementation((table: Parameters<typeof db.insert>[0]) => {
      if (table === storageDeletions)
        return {
          values: () => ({
            onConflictDoUpdate: () => Promise.reject(new TypeError("insert private")),
          }),
        } as unknown as ReturnType<typeof db.insert>;
      return insert(table);
    });
  expect((await upload(intake.token, await examplePdf(), "test.pdf")).status).toBe(500);
  expect(errorLogger.mock.calls.some(([record]) => record.name === "TypeError")).toBe(true);
  expect(storageLogger).toHaveBeenCalledWith(expect.objectContaining({ errorName: "RangeError" }));
  transaction.mockRestore();
  insertion.mockRestore();
});
it("1: reducing the household by editing members updates the minimum and preserves surviving IDs", async () => {
  const intake = await start();
  await request(`/api/c/${intake.token}/turn`, "POST", {
    type: "answer",
    questionId: "household_count",
    value: 3,
  });
  const first = CitizenCase.parse(
    await (
      await request(`/api/c/${intake.token}/turn`, "POST", {
        type: "answer",
        questionId: "members",
        value: [
          { role: "richiedente", firstName: "Test" },
          { role: "figlio", firstName: "Uno" },
          { role: "figlio", firstName: "Due" },
        ],
      })
    ).json(),
  );
  await request(`/api/c/${intake.token}/turn`, "POST", {
    type: "edit",
    questionId: "household_count",
  });
  await error(
    await request(`/api/c/${intake.token}/turn`, "POST", {
      type: "answer",
      questionId: "household_count",
      value: 2,
    }),
    400,
    "bad_request",
  );
  await request(`/api/c/${intake.token}/turn`, "POST", { type: "edit", questionId: "members" });
  const response = await request(`/api/c/${intake.token}/turn`, "POST", {
    type: "answer",
    questionId: "members",
    value: [first.household[0], first.household[2]],
  });
  expect(response.status).toBe(200);
  const edited = CitizenCase.parse(await response.json());
  expect(edited.household[1]?.id).toBe(first.household[2]?.id);
  expect(edited.answers.household_count).toBe(2);
  await request(`/api/c/${intake.token}/turn`, "POST", {
    type: "edit",
    questionId: "household_count",
  });
  const count = CitizenCase.parse(await (await request(`/api/c/${intake.token}`)).json());
  expect(count.nextQuestion).toMatchObject({ id: "household_count", min: 2 });
  expect(
    (
      await request(`/api/c/${intake.token}/turn`, "POST", {
        type: "answer",
        questionId: "household_count",
        value: 2,
      })
    ).status,
  ).toBe(200);
});
it("13: repeated GET download and both export formats append access records", async () => {
  const intake = await start();
  const view = CitizenCase.parse(
    await (await upload(intake.token, await examplePdf(), "test.pdf")).json(),
  );
  const document = view.documents[0]!;
  const cookie = await login();
  for (let visit = 0; visit < 2; visit++)
    expect(
      (
        await request(
          `/api/cases/${view.id}/documents/${document.id}/file`,
          "GET",
          undefined,
          cookie,
        )
      ).status,
    ).toBe(200);
  for (const format of ["json", "pdf"])
    expect(
      (await request(`/api/cases/${view.id}/export?format=${format}`, "GET", undefined, cookie))
        .status,
    ).toBe(200);
  const records = await db.select().from(events).where(eq(events.caseId, view.id));
  expect(records.filter((e) => e.type === "document.downloaded")).toHaveLength(2);
  expect(records.filter((e) => e.type === "case.exported")).toHaveLength(2);
  expect(
    records
      .filter((e) => ["document.downloaded", "case.exported"].includes(e.type))
      .every((e) => e.actorId === "operator-a"),
  ).toBe(true);
});
it("11: failed cron jobs observe cooldown and never retry on citizen POST", async () => {
  const errorLogger = vi.fn();
  app = createApp({
    db,
    storage: new MemoryStorage(),
    errorLogger,
    clock: () => new Date(instant),
    cronSecret: "test-cron",
  });
  const deletion = vi.spyOn(db, "delete").mockImplementationOnce(() => {
    throw new Error("maintenance failure");
  });
  const cron = () =>
    app.request("/api/cron/maintenance", { headers: { Authorization: "Bearer test-cron" } });
  expect((await cron()).status).toBe(500);
  expect(await (await cron()).json()).toEqual({ ok: true, skipped: true });
  await start();
  expect(deletion).toHaveBeenCalledTimes(1);
  deletion.mockRestore();
});
it("8: the Next production server rejects missing trusted proxy before serving requests", async () => {
  const { default: configure } = await import("../../../apps/web/next.config");
  expect(typeof configure).toBe("function");
  vi.stubEnv("TRUST_PROXY", "0");
  vi.stubEnv("VERCEL", "0");
  try {
    const callConfig = configure as unknown as (phase: string) => unknown;
    expect(() => callConfig("phase-production-server")).toThrow("TRUST_PROXY");
    expect(() => callConfig("phase-production-build")).not.toThrow();
    vi.stubEnv("TRUST_PROXY", "1");
    expect(() => callConfig("phase-production-server")).not.toThrow();
  } finally {
    vi.unstubAllEnvs();
  }
});

it("pilot: an inactive session expires at exactly thirty minutes", async () => {
  const cookie = await login();
  instant = new Date(Date.parse(initialInstant) + 30 * 60000);
  expect((await request("/api/auth/me", "GET", undefined, cookie)).status).toBe(401);
});

it("DSU sheet requires an operator, preserves case timestamps and audits each access without personal data", async () => {
  const intake = await start();
  const view = await completeInterview(intake.token, intake.case);
  const path = `/api/cases/${view.id}/dsu-sheet`;
  await error(await request(path), 401, "unauthorized");
  await error(
    await request(path, "GET", undefined, `avanti_session=${intake.token}`),
    401,
    "unauthorized",
  );
  const cookie = await login();
  const [before] = await db.select().from(cases).where(eq(cases.id, view.id));
  const response = await request(path, "GET", undefined, cookie);
  expect(response.status).toBe(200);
  const sheet = DsuSheetResponse.parse(await response.json());
  expect(sheet?.sections[0]?.rows.find((r) => r.label === "Nome")?.value).toBe("Persona");
  expect(sheet?.sections.some((s) => s.quadro === "B")).toBe(true);
  expect((await request(path, "GET", undefined, cookie)).status).toBe(200);
  const dossier = CaseDossier.parse(
    await (
      await request(`/api/cases/${view.id}/export?format=json`, "GET", undefined, cookie)
    ).json(),
  );
  expect(dossier.dsuSheet).toEqual(sheet);
  const records = (await db.select().from(events).where(eq(events.caseId, view.id))).filter(
    (e) => e.type === "dsu_sheet.viewed",
  );
  expect(records).toHaveLength(2);
  expect(
    records.every(
      (e) =>
        e.actorId === "operator-a" && e.actor === "operator" && JSON.stringify(e.metadata) === "{}",
    ),
  ).toBe(true);
  const [after] = await db.select().from(cases).where(eq(cases.id, view.id));
  expect(after?.updatedAt).toBe(before?.updatedAt);
  expect(after?.status).toBe(before?.status);
  expect(JSON.stringify(logs)).not.toContain("Persona");
});

it("DSU sheet is null for other or unclassified practices, with safe errors for invalid/unknown ids", async () => {
  const cookie = await login();
  const intake = await start();
  await db.update(cases).set({ practiceId: "modello_730" }).where(eq(cases.id, intake.case.id));
  expect(
    await (
      await request(`/api/cases/${intake.case.id}/dsu-sheet`, "GET", undefined, cookie)
    ).json(),
  ).toBeNull();
  await db.update(cases).set({ practiceId: null }).where(eq(cases.id, intake.case.id));
  expect(
    await (
      await request(`/api/cases/${intake.case.id}/dsu-sheet`, "GET", undefined, cookie)
    ).json(),
  ).toBeNull();
  await error(
    await request(`/api/cases/${"x".repeat(65)}/dsu-sheet`, "GET", undefined, cookie),
    400,
    "bad_request",
  );
  await error(
    await request("/api/cases/unknown-id/dsu-sheet", "GET", undefined, cookie),
    404,
    "not_found",
  );
});
