import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  createDatabase,
  cases,
  organizations,
  offices,
  operators,
  sessions,
  documents,
  settings,
  messages,
  copilotCache,
  prefillDecisions,
  events,
  aiUsage,
  operationalCounters,
  rateLimits,
  type Database,
} from "@avanti/db";
import {
  DossierBrief,
  DossierConsistency,
  DsuPrefill,
  DsuSheet,
  CaseListResponse,
  OperatorAskResponse,
} from "@avanti/contracts";
import { createApp } from "./app";
import { AiIntelligence } from "./ai";
import { loadAiConfig } from "@avanti/ai/config";
import type { Transport, TransportRequest } from "@avanti/ai";
import { hashToken } from "./security";
import { rateKey } from "./middleware/rate-limit";
import { rateLimitSecret } from "./rate-limit-key";
import { MemoryStorage } from "./storage";
import { dossierView } from "./dossier";
import { copilotDossier, analyzeConsistency, recoverCopilot } from "./copilot";
import { dsuPrefillSlots } from "@avanti/core";
let db: Database, close: () => Promise<void>;
let now: Date, ai: AiIntelligence, storage: MemoryStorage, reply: Transport;
let transport: ReturnType<typeof vi.fn<Transport>>;
const token = "o".repeat(43),
  foreign = "f".repeat(43),
  origin = "http://localhost:3400";
const options = () => ({
  db,
  ai,
  storage,
  clock: () => now,
  publicUrl: origin,
  errorLogger: () => {},
});
const request = (path: string, method = "GET", input?: unknown, auth: string | null = token) =>
  createApp(options()).request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(auth ? { Cookie: `avanti_session=${auth}` } : {}),
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
});
afterAll(async () => {
  await close();
});
beforeEach(async () => {
  await db.execute(sql`truncate organizations, rate_limits cascade`);
  now = new Date("2027-01-15T12:00:00.000Z");
  reply = async (req) => {
    if (req.system.includes("brief the operator"))
      return {
        output: {
          situation: "Fascicolo ISEE da verificare.",
          attention: [],
          missing: [],
          nextStep: "verify_documents",
          nextStepReason: "Verificare i documenti caricati.",
        },
      };
    if (req.system.includes("find inconsistencies")) return { output: { issues: [] } };
    return {
      output: { message: "Buongiorno, puoi caricare il documento dallo stesso link. Grazie." },
    };
  };
  transport = vi.fn((req) => reply(req));
  ai = new AiIntelligence({
    config: loadAiConfig({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "synthetic",
      AI_MAX_ATTEMPTS: "2",
    }),
    transport,
  });
  storage = new MemoryStorage();
  await db.insert(organizations).values([
    { id: "a", name: "CAF sintetico A", kind: "caf" },
    { id: "b", name: "CAF sintetico B", kind: "caf" },
  ]);
  await db.insert(offices).values({
    id: "office",
    organizationId: "a",
    slug: "synthetic",
    name: "Sportello",
    address: "Indirizzo demo",
    city: "Roma",
  });
  for (const [id, org, key] of [
    ["op", "a", token],
    ["foreign", "b", foreign],
  ]) {
    await db.insert(operators).values({
      id: id!,
      organizationId: org!,
      name: "Operatore sintetico",
      email: `${id}@example.test`,
      passwordHash: "none",
      role: "admin",
    });
    await db.insert(sessions).values({
      id: id!,
      operatorId: id!,
      tokenHash: hashToken(key!),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 1800000).toISOString(),
    });
  }
  await db.insert(cases).values({
    id: "case",
    organizationId: "a",
    officeId: "office",
    tokenHash: hashToken("c".repeat(43)),
    reference: "AV-SYNTHETIC",
    language: "it",
    practiceId: "isee_ordinario",
    status: "in_review",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: "2027-03-01T00:00:00Z",
    contact: {
      firstName: "José",
      lastName: "Rossi",
      phone: "+39 333 1234567",
      email: "secret@example.test",
    },
    internalNotes: "PRIVATE NOTE DO NOT SEND",
    answers: {
      members: [{ id: "m", role: "richiedente", firstName: "José", lastName: "Rossi" }],
      household_count: 1,
      accounts_count: 1,
      account_owner_0: "m",
      account_type_0: "deposit",
      account_bank_0: "Banca sintetica",
      housing: "hosted",
      income_present_m: false,
    },
  });
});
async function caseRow() {
  return (await db.select().from(cases).where(eq(cases.id, "case")))[0]!;
}
async function document(overrides: Partial<typeof documents.$inferInsert> = {}) {
  const dossier = await dossierView(db, await caseRow(), now);
  const item = dossier.checklist.find((i) => i.requirementId === "account_balance")!;
  await storage.put("synthetic-doc", new Uint8Array([1, 2, 3]));
  await db.insert(documents).values({
    id: "doc",
    caseId: "case",
    fileName: "synthetic-secret@example.test.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3,
    sha256: "sha-synthetic",
    storageKey: "synthetic-doc",
    pages: 1,
    uploadedAt: now.toISOString(),
    checklistItemId: item.id,
    memberId: "m",
    status: "analyzed",
    analysis: {
      engine: "ai",
      detectedRequirementId: "account_balance",
      detectedLabel: "Saldo",
      confidence: 0.99,
      ownerName: "ROSSI JOSE",
      referenceYear: 2025,
      expiresOn: null,
      legible: true,
      pagesComplete: true,
      findings: [],
    },
    ...overrides,
  });
}
it("requires authentication and rejects every case endpoint across tenants", async () => {
  const paths = ["brief", "consistency", "dsu-prefill"];
  for (const path of paths) {
    expect((await request(`/cases/case/ai/${path}`, "GET", undefined, null)).status).toBe(401);
    expect((await request(`/cases/case/ai/${path}`, "GET", undefined, foreign)).status).toBe(404);
  }
  for (const [path, body] of [
    ["brief", undefined],
    ["request-draft", { checklistItemIds: ["missing"] }],
    ["reply-draft", { messageId: "m" }],
    ["dsu-prefill/f/accept", undefined],
    ["dsu-prefill/f/reject", undefined],
  ] as const)
    expect((await request(`/cases/case/ai/${path}`, "POST", body, foreign)).status).toBe(404);
  expect((await request("/ai/ask", "POST", { question: "Quale anno ISEE?" }, null)).status).toBe(
    401,
  );
  expect(transport).not.toHaveBeenCalled();
});
it("persists brief per version, coalesces concurrency and regenerates only on POST or change", async () => {
  const results = await Promise.all([
    request("/cases/case/ai/brief"),
    request("/cases/case/ai/brief"),
    request("/cases/case/ai/brief"),
  ]);
  for (const response of results) expect(response.status).toBe(200);
  const first = DossierBrief.parse(await results[0]!.json());
  expect(first.engine).toBe("ai");
  expect(transport).toHaveBeenCalledTimes(1);
  expect(DossierBrief.parse(await (await request("/cases/case/ai/brief")).json())).toEqual(first);
  expect((await request("/cases/case/ai/brief", "POST")).status).toBe(200);
  expect(transport).toHaveBeenCalledTimes(2);
  now = new Date(now.getTime() + 1);
  await db.update(cases).set({ updatedAt: now.toISOString() });
  expect((await request("/cases/case/ai/brief")).status).toBe(200);
  expect(transport).toHaveBeenCalledTimes(3);
});
it.each(["brief", "consistency", "dsu-prefill"])(
  "limits AI GET %s before cache misses reach the provider",
  async (task) => {
    await db.insert(rateLimits).values({
      key: rateKey(rateLimitSecret(undefined), "copilot:3600", "operator:op"),
      count: 60,
      resetAt: new Date(now.getTime() + 3600000).toISOString(),
    });
    const response = await request(`/cases/case/ai/${task}`);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(transport).not.toHaveBeenCalled();
    expect(await db.select().from(copilotCache)).toHaveLength(0);
  },
);

it("discards late responses when case changes during model work", async () => {
  reply = async () => {
    now = new Date(now.getTime() + 1);
    await db.update(cases).set({ updatedAt: now.toISOString() });
    return {
      output: {
        situation: "Riepilogo.",
        attention: [],
        missing: [],
        nextStep: "verify_documents",
        nextStepReason: "Verificare.",
      },
    };
  };
  expect((await request("/cases/case/ai/brief")).status).toBe(409);
  expect(await db.select().from(copilotCache)).toHaveLength(0);
});
it("keeps deterministic findings even when the model sees no issue, updates the queue and recovers missing versions", async () => {
  await document({
    analysis: {
      engine: "ai",
      detectedRequirementId: "account_balance",
      detectedLabel: "Saldo",
      confidence: 0.99,
      ownerName: "Mario Bianchi",
      referenceYear: 2024,
      expiresOn: "2026-01-01",
      legible: true,
      pagesComplete: true,
      findings: [],
    },
  });
  const report = DossierConsistency.parse(
    await (await request("/cases/case/ai/consistency")).json(),
  );
  expect(report.issues.map((i) => i.id)).toEqual(
    expect.arrayContaining([
      "document.wrong_owner:doc",
      "document.wrong_year:doc",
      "document.expired:doc",
    ]),
  );
  const list = CaseListResponse.parse(await (await request("/cases?ai=attention")).json());
  expect(list.items[0]?.aiAttention).toBe(
    report.issues.filter((i) => i.severity !== "info").length,
  );
  expect(list.items[0]?.aiPriority).toBe("attention");
  expect((await request("/cases/case/ai/consistency")).status).toBe(200);
  expect(transport).toHaveBeenCalledTimes(1);
  await db.update(cases).set({ updatedAt: new Date(now.getTime() + 1).toISOString() });
  const { mfaCipher } = await import("./mfa");
  const { defaultNotifications } = await import("./notification-config");
  await recoverCopilot({
    ...options(),
    production: false,
    mfa: mfaCipher({}),
    notifications: defaultNotifications(),
  });
  expect(transport).toHaveBeenCalledTimes(2);
});
it("uses heuristic responses with switches off or exhausted budget, without any provider call", async () => {
  await db.insert(settings).values({ organizationId: "a", aiCopilot: false });
  expect((await (await request("/cases/case/ai/brief")).json()).engine).toBe("heuristic");
  expect((await (await request("/cases/case/ai/consistency")).json()).engine).toBe("heuristic");
  expect((await (await request("/cases/case/ai/dsu-prefill")).json()).fields).toEqual([]);
  await db.update(settings).set({ aiCopilot: true, aiMonthlyBudgetEur: 0 });
  expect((await (await request("/cases/case/ai/brief")).json()).engine).toBe("heuristic");
  expect(transport).not.toHaveBeenCalled();
});
it("redacts contact data and excludes internal notes, filenames and message history from dossier prompts", async () => {
  await document();
  await request("/cases/case/ai/brief");
  const prompt = transport.mock.calls[0]![0].prompt;
  expect(prompt).not.toMatch(/secret@example|333|PRIVATE NOTE|synthetic-secret/);
  expect(prompt).toContain("José");
});
it("reads prefill values, caches them, records acceptance, shows confirmed provenance and invalidates on document change", async () => {
  await document();
  const d = await dossierView(db, await caseRow(), now);
  const slot = dsuPrefillSlots(d.dsuSheet, copilotDossier(d))[0]!;
  expect(slot).toBeDefined();
  let candidate: unknown;
  reply = async (req) => {
    if (req.system.includes("Read only the attached"))
      return {
        output: {
          fields: [
            {
              fieldId: slot.fieldId,
              value: 1234.56,
              page: 1,
              confidence: 0.99,
              rawValue: "1.234,56",
              quote: "Saldo al 31 dicembre: 1.234,56 euro",
            },
            {
              fieldId: dsuPrefillSlots(d.dsuSheet, copilotDossier(d))[1]!.fieldId,
              value: 2345.67,
              page: 1,
              confidence: 0.99,
              rawValue: "2.345,67",
              quote: "Giacenza media: 2.345,67 euro",
            },
          ],
        },
      };
    if (req.system.includes("Select DSU")) {
      const match = req.prompt.match(/\n(\[\{[\s\S]*\}\])\n<\/untrusted>/);
      candidate = JSON.parse(match![1]!);
      return { output: { fields: candidate } };
    }
    return { output: { issues: [] } };
  };
  const response = await request("/cases/case/ai/dsu-prefill");
  expect(response.status).toBe(200);
  const result = DsuPrefill.parse(await response.json());
  expect(result.fields[0]?.value).toBe(1234.56);
  expect(transport).toHaveBeenCalledTimes(2);
  expect((await request("/cases/case/ai/dsu-prefill")).status).toBe(200);
  expect(transport).toHaveBeenCalledTimes(2);
  const field = result.fields[0]!;
  expect(field.fieldId).toContain("~");
  expect(
    (
      await request(
        `/cases/case/ai/dsu-prefill/${encodeURIComponent(field.fieldId)}/accept`,
        "POST",
      )
    ).status,
  ).toBe(200);
  expect((await db.select().from(prefillDecisions))[0]?.decision).toBe("accepted");
  expect(result.fields).toHaveLength(2);
  const remaining = DsuPrefill.parse(await (await request("/cases/case/ai/dsu-prefill")).json());
  expect(remaining.fields).toHaveLength(1);
  expect(
    (
      await request(
        `/cases/case/ai/dsu-prefill/${encodeURIComponent(remaining.fields[0]!.fieldId)}/accept`,
        "POST",
      )
    ).status,
  ).toBe(200);
  expect(transport).toHaveBeenCalledTimes(2);
  const sheet = DsuSheet.parse((await dossierView(db, await caseRow(), now)).dsuSheet);
  expect(
    sheet.sections.flatMap((s) => s.rows).find((r) => r.label === "Saldo al 31 dicembre"),
  ).toMatchObject({ value: "1234,56", source: { kind: "document", operatorConfirmed: true } });
  expect(
    (await db.select().from(events)).some((e) => e.type.startsWith("dsu_prefill.accepted:")),
  ).toBe(true);
  await db.update(documents).set({ sha256: "new-content" });
  expect(
    (await dossierView(db, await caseRow(), now)).dsuSheet?.sections
      .flatMap((s) => s.rows)
      .find((r) => r.label === "Saldo al 31 dicembre")?.value,
  ).toBeNull();
  expect(
    (
      await request(
        `/cases/case/ai/dsu-prefill/${encodeURIComponent(field.fieldId)}/accept`,
        "POST",
      )
    ).status,
  ).toBe(409);
});
it("validates selected checklist and message IDs, drafts never send messages", async () => {
  expect(
    (await request("/cases/case/ai/request-draft", "POST", { checklistItemIds: ["other"] })).status,
  ).toBe(404);
  const d = await dossierView(db, await caseRow(), now);
  expect(
    (
      await request("/cases/case/ai/request-draft", "POST", {
        checklistItemIds: [d.checklist[0]!.id],
      })
    ).status,
  ).toBe(200);
  await db.insert(messages).values({
    id: "question",
    caseId: "case",
    role: "citizen",
    text: "Quale anno serve per ISEE?",
    createdAt: now.toISOString(),
  });
  expect(
    (await request("/cases/case/ai/reply-draft", "POST", { messageId: "question" })).status,
  ).toBe(200);
  expect(await db.select().from(messages)).toHaveLength(1);
  expect(
    (await request("/cases/case/ai/reply-draft", "POST", { messageId: "foreign-message" })).status,
  ).toBe(404);
});
it("prioritizes unread citizen questions before analysis and clears them only when dossier is read", async () => {
  await db.insert(messages).values({
    id: "question",
    caseId: "case",
    role: "citizen",
    text: "Dove trovo la giacenza?",
    createdAt: now.toISOString(),
  });
  let list = CaseListResponse.parse(await (await request("/cases?ai=citizen_question")).json());
  expect(list.items.map((i) => i.id)).toEqual(["case"]);
  expect(list.items[0]?.aiPriority).toBe("citizen_question");
  await request("/cases/case/ai/brief");
  list = CaseListResponse.parse(await (await request("/cases?ai=citizen_question")).json());
  expect(list.items).toHaveLength(1);
  await request("/cases/case");
  list = CaseListResponse.parse(await (await request("/cases?ai=citizen_question")).json());
  expect(list.items).toHaveLength(0);
});
it("returns sourced excerpts offline and no coverage outside knowledge, and enforces 60/hour", async () => {
  await db.insert(settings).values({ organizationId: "a", aiCopilot: false });
  const answer = OperatorAskResponse.parse(
    await (
      await request("/ai/ask", "POST", {
        question: "Per ISEE 2027 quale anno di redditi e patrimonio?",
        practiceId: "isee_ordinario",
      })
    ).json(),
  );
  expect(answer).toMatchObject({ coverage: "partial", engine: "heuristic" });
  expect(answer.citations.length).toBeGreaterThan(0);
  const outside = await request("/ai/ask", "POST", {
    question: "Ricetta carbonara guanciale pecorino?",
  });
  expect((await outside.json()).coverage).toBe("none");
  expect((await request("/ai/ask", "POST", { question: "ab" })).status).toBe(400);
  for (let i = 0; i < 57; i++)
    expect((await request("/ai/ask", "POST", { question: "Ricetta carbonara?" })).status).toBe(200);
  const limited = await request("/ai/ask", "POST", { question: "Ricetta carbonara?" });
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBe("3600");
  expect(transport).not.toHaveBeenCalled();
  expect(await db.select().from(aiUsage)).toHaveLength(0);
});

it("preserves omitted AI preferences on settings PATCH and disables the citizen provider independently", async () => {
  expect(
    (
      await request("/settings", "PATCH", {
        aiCopilot: false,
        aiCitizenAssistant: false,
        // Ignored: the AI budget is set by Avanti, not by the CAF.
        aiMonthlyBudgetEur: 7,
      })
    ).status,
  ).toBe(200);
  expect((await request("/settings", "PATCH", { linkDays: 40 })).status).toBe(200);
  expect(await (await request("/settings")).json()).toMatchObject({
    aiCopilot: false,
    aiCitizenAssistant: false,
    aiMonthlyBudgetEur: null,
    linkDays: 40,
  });
  await db.update(cases).set({ status: "intake" });
  const view = await (await createApp(options()).request(`/api/c/${"c".repeat(43)}`)).json();
  expect(view.aiCitizenAssistant).toBe(false);
  const response = await createApp(options()).request(`/api/c/${"c".repeat(43)}/turn`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "text", text: "Ho bisogno dell'ISEE per la mia famiglia" }),
  });
  expect(response.status).toBe(200);
  expect(transport).not.toHaveBeenCalled();
});

it("records rejection without changing the DSU amount or sending any message", async () => {
  await document();
  const d = await dossierView(db, await caseRow(), now),
    slot = dsuPrefillSlots(d.dsuSheet, copilotDossier(d))[0]!;
  const field = {
    sectionId: slot.sectionId,
    fieldId: `${slot.fieldId}~synthetic`,
    label: slot.label,
    value: 1234.56,
    documentId: "doc",
    page: 1,
    confidence: 0.99,
    note: "Saldo: 1.234,56 euro",
  };
  await db.insert(copilotCache).values({
    caseId: "case",
    caseVersion: now.toISOString(),
    task: "dsu-prefill",
    leaseToken: "completed",
    leaseUntil: now.toISOString(),
    payload: {
      fields: [field],
      engine: "ai",
      generatedAt: now.toISOString(),
      caseVersion: now.toISOString(),
    },
  });
  expect(
    (
      await request(
        `/cases/case/ai/dsu-prefill/${encodeURIComponent(field.fieldId)}/reject`,
        "POST",
      )
    ).status,
  ).toBe(200);
  expect((await db.select().from(prefillDecisions))[0]?.decision).toBe("rejected");
  expect(
    (await dossierView(db, await caseRow(), now)).dsuSheet?.sections
      .flatMap((s) => s.rows)
      .find((r) => r.label === "Saldo al 31 dicembre")?.value,
  ).toBeNull();
  expect(await db.select().from(messages)).toHaveLength(0);
});

it("offers quick review for readable complete uploads without treating the absence of manual review as an inconsistency", async () => {
  const { getQuestions } = await import("@avanti/core");
  const current = await caseRow();
  const answers = {
    ...current.answers,
    accounts_count: 0,
    properties_count: 0,
    vehicles_count: 0,
    housing: "hosted",
    disability: false,
    nonresident_parent: false,
    university: false,
    self_employed: false,
    foreign_income: false,
    foreign_assets: false,
    maintenance: false,
    exempt_income: false,
    excluded_savings: false,
  };
  for (let round = 0; round < 5; round++) {
    const missing = getQuestions("isee_ordinario", answers, "it").filter(
      (q) => !Object.hasOwn(answers, q.id),
    );
    if (!missing.length) break;
    for (const question of missing) {
      expect(question.kind).toBe("yes_no");
      Object.assign(answers, { [question.id]: false });
    }
  }
  await db.update(cases).set({ answers });
  const dossier = await dossierView(db, await caseRow(), now);
  for (const [index, item] of dossier.checklist.entries())
    await db.insert(documents).values({
      id: `quick-${index}`,
      caseId: "case",
      fileName: `sintetico-${index}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 3,
      sha256: `synthetic-quick-${index}`,
      storageKey: `synthetic-quick-${index}`,
      pages: 1,
      uploadedAt: now.toISOString(),
      checklistItemId: item.id,
      memberId: item.memberId,
      status: "analyzed",
      analysis: {
        engine: "ai",
        detectedRequirementId: item.requirementId,
        detectedLabel: item.title,
        confidence: 0.99,
        ownerName: item.memberName,
        referenceYear: 2025,
        expiresOn: null,
        legible: true,
        pagesComplete: true,
        findings: [],
      },
    });
  const analysis = DossierConsistency.parse(
    await (await request("/cases/case/ai/consistency")).json(),
  );
  expect(analysis.issues.filter((i) => i.severity !== "info")).toEqual([]);
  const list = CaseListResponse.parse(await (await request("/cases?ai=quick_review")).json());
  expect(list.items.map((i) => i.id)).toEqual(["case"]);
  expect(list.items[0]).toMatchObject({
    aiAttention: 0,
    aiPriority: "quick_review",
    status: "in_review",
  });
  expect(
    (
      await request("/cases/case", "PATCH", {
        status: "ready",
        expectedUpdatedAt: new Date(current.updatedAt).toISOString(),
      })
    ).status,
  ).toBe(409);
});

it("does not flag an intentional out-of-knowledge fallback as a provider failure", async () => {
  const response = await request("/ai/ask", "POST", {
    question: "Ricetta carbonara guanciale pecorino?",
  });
  expect((await response.json()).coverage).toBe("none");
  expect(transport).not.toHaveBeenCalled();
  expect(
    await db
      .select()
      .from(operationalCounters)
      .where(
        and(
          eq(operationalCounters.organizationId, "a"),
          eq(operationalCounters.metric, "ai_error"),
        ),
      ),
  ).toEqual([]);
});
