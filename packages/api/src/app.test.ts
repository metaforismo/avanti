import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ApiError,
  CaseDossier,
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
  events,
  leads,
  offices,
  operators,
  organizations,
  sessions,
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

function request(
  path: string,
  method = "GET",
  input?: unknown,
  cookie?: string,
  requestOrigin = origin,
) {
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
  return app.request(`/api/c/${token}/documents`, { method: "POST", body: form });
}

const submitInput = {
  contact: { firstName: "Persona", lastName: "Esempio", email: "persona@example.test" },
  confirmed: true,
};

describe("public API and validation", () => {
  it("returns health, localized catalog and only public office details", async () => {
    const health = await request("/api/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
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
      "bad_request",
    );
    await error(
      await request("/api/intake", "POST", { officeSlug: "wrong", privacyAccepted: true }),
      404,
      "not_found",
    );
    await error(
      await app.request("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const opened = await request(`/api/cases/${view.id}`, "GET", undefined, cookie);
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
    expect(operatorMessage?.originalText).toBe(italianMessage);
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
      "text/plain",
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
    instant = new Date(instant.getTime() + 60 * 60 * 1000);
    expect((await request("/api/auth/me", "GET", undefined, cookie)).status).toBe(200);
    const [after] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
    expect(Date.parse(after?.expiresAt ?? "")).toBe(
      Date.parse(before?.expiresAt ?? "") + 60 * 60 * 1000,
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
    for (let attempt = 2; attempt < 10; attempt++) {
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
