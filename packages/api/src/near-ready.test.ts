import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  createDatabase,
  cases,
  documents,
  offices,
  organizations,
  operators,
  sessions,
  settings,
  nearReadyEvaluations,
  nearReadyEvents,
  nearReadyBlindReviews,
  events,
  copilotCache,
  messages,
  rateLimits,
  type Database,
} from "@avanti/db";
import {
  NearReady,
  NearReadyPilotResponse,
  CaseListResponse,
  CaseDossier,
  type AnswerValue,
} from "@avanti/contracts";
import { buildHousehold, buildChecklist, getQuestions } from "@avanti/core";
import { loadAiConfig, type Transport } from "@avanti/ai";
import { AiIntelligence } from "./ai";
import { createApp } from "./app";
import { hashToken } from "./security";
import { MemoryStorage } from "./storage";
import { nextCaseUpdate } from "./case-version";
import { rateKey } from "./middleware/rate-limit";
import { rateLimitSecret } from "./rate-limit-key";
let db: Database, close: () => Promise<void>, ai: AiIntelligence, storage: MemoryStorage;
let now: Date, reply: Transport;
const token = "a".repeat(43),
  second = "b".repeat(43),
  origin = "http://localhost:3400";
const logs: unknown[] = [];
const request = (path: string, method = "GET", input?: unknown, auth = token) =>
  createApp({
    db,
    ai,
    storage,
    clock: () => now,
    publicUrl: origin,
    errorLogger: (r) => {
      logs.push(r);
    },
    logger: (r) => {
      logs.push(r);
    },
  }).request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: `avanti_session=${auth}`,
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
const current = async () => {
  const row = (await db.select().from(cases).where(eq(cases.id, "case")))[0]!;
  return { ...row, updatedAt: new Date(row.updatedAt).toISOString() };
};
const evaluate = async () =>
  request("/cases/case/near-ready/evaluate", "POST", {
    expectedUpdatedAt: (await current()).updatedAt,
  });
const patchCase = async (input: Record<string, unknown>) =>
  request("/cases/case", "PATCH", { expectedUpdatedAt: (await current()).updatedAt, ...input });
const verifyAll = async () => {
  const row = await current();
  for (const item of buildChecklist(
    "isee_ordinario",
    row.answers,
    buildHousehold(row.answers),
    "it",
  ))
    expect(
      (
        await request(`/cases/case/checklist/${encodeURIComponent(item.id)}/review`, "POST", {
          expectedUpdatedAt: (await current()).updatedAt,
          decision: "verified",
        })
      ).status,
    ).toBe(200);
};
const finalDecision = async (input: Record<string, unknown>) =>
  request("/cases/case/near-ready/final-decision", "POST", {
    expectedUpdatedAt: (await current()).updatedAt,
    ...input,
  });
/** The operator asks for an integration (work), then the citizen reassigns a document (content). */
const citizenChanges = async () => {
  if ((await current()).status === "submitted")
    expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect(
    (
      await request("/cases/case/requests", "POST", {
        expectedUpdatedAt: (await current()).updatedAt,
        checklistItemIds: [],
        message: "Ricarica il documento, per favore.",
      })
    ).status,
  ).toBe(200);
  const [doc] = await db.select().from(documents).where(eq(documents.id, "doc0"));
  expect(
    (
      await request(`/c/${"c".repeat(43)}/documents/doc0`, "PATCH", {
        checklistItemId: doc!.checklistItemId,
      })
    ).status,
  ).toBe(200);
};
const baselineReply: Transport = async (r) => {
  if (r.system.includes("rapid-review screening")) {
    const match = r.prompt.match(/"slots"\s*:\s*(\[[\s\S]*?\])/);
    const slots = JSON.parse(match?.[1] ?? "[]") as { fieldId: string }[];
    return {
      output: {
        securityWarning: false,
        fields: slots.map((slot) => ({
          fieldId: slot.fieldId,
          page: 1,
          confidence: 0.99,
          consistent: true,
          value: "Valore sintetico riservato 12345,67",
        })),
      },
    };
  }
  if (r.system.includes("cross-check the pilot"))
    return { output: { consistent: true, securityWarning: false } };
  return { output: { issues: [] } };
};
let postgresAdmin: Awaited<ReturnType<typeof createDatabase>> | undefined;
let postgresName: string | undefined;
beforeAll(async () => {
  const postgresUrl = process.env.AVANTI_TEST_DATABASE_URL;
  if (!postgresUrl) {
    ({ db, close } = await createDatabase({ memory: true }));
    return;
  }
  const url = new URL(postgresUrl);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  )
    throw new Error("Near-ready parity requires a disposable local *_test Postgres database");
  postgresAdmin = await createDatabase({ url: postgresUrl, migrate: false });
  postgresName = `avanti_near_ready_${process.pid}_test`;
  await postgresAdmin.db.execute(sql`create database ${sql.identifier(postgresName)}`);
  url.pathname = `/${postgresName}`;
  ({ db, close } = await createDatabase({ url: url.href, migrate: true }));
});
afterAll(async () => {
  await close?.();
  try {
    if (postgresName)
      await postgresAdmin?.db.execute(sql`drop database ${sql.identifier(postgresName)}`);
  } finally {
    await postgresAdmin?.close();
  }
});
beforeEach(async () => {
  await db.execute(sql`truncate organizations, rate_limits cascade`);
  logs.length = 0;
  now = new Date("2027-01-15T12:00:00.000Z");
  reply = baselineReply;
  ai = new AiIntelligence({
    config: loadAiConfig({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "synthetic",
      AI_MAX_ATTEMPTS: "1",
    }),
    transport: (r) => reply(r),
  });
  storage = new MemoryStorage();
  await db.insert(organizations).values([
    { id: "org", name: "CAF sintetico", kind: "caf" },
    { id: "other", name: "Altro CAF", kind: "caf" },
  ]);
  await db.insert(offices).values({
    id: "office",
    organizationId: "org",
    slug: "synthetic",
    name: "Sede",
    address: "Esempio",
    city: "Milano",
  });
  await db.insert(operators).values([
    {
      id: "admin",
      organizationId: "org",
      name: "Admin",
      email: "admin@example.invalid",
      passwordHash: "unused",
      role: "admin",
    },
    {
      id: "operator",
      organizationId: "org",
      name: "Operatore",
      email: "operator@example.invalid",
      passwordHash: "unused",
      role: "operator",
    },
    {
      id: "foreign",
      organizationId: "other",
      name: "Altro",
      email: "foreign@example.invalid",
      passwordHash: "unused",
      role: "admin",
    },
  ]);
  await db.insert(sessions).values([
    {
      id: "session",
      operatorId: "admin",
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    },
    {
      id: "session2",
      operatorId: "operator",
      tokenHash: hashToken(second),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    },
    {
      id: "foreign-session",
      operatorId: "foreign",
      tokenHash: hashToken("f".repeat(43)),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    },
  ]);
  await db.insert(settings).values({ organizationId: "org", nearReadyMode: "visible" });
  const answers: Record<string, AnswerValue> = {
    household_count: 1,
    members: [
      {
        id: "person",
        firstName: "Persona",
        lastName: "Riservata",
        birthYear: 1985,
        role: "richiedente",
      },
    ],
    accounts_count: 0,
    properties_count: 0,
    vehicles_count: 0,
    housing: "hosted",
    income_present_person: false,
  };
  for (const q of getQuestions("isee_ordinario", answers, "it"))
    if (q.kind === "yes_no" && !(q.id in answers)) answers[q.id] = false;
  await db.insert(cases).values({
    id: "case",
    organizationId: "org",
    officeId: "office",
    tokenHash: hashToken("c".repeat(43)),
    reference: "TEST-1",
    practiceId: "isee_ordinario",
    language: "it",
    status: "submitted",
    answers,
    confirmedAnswers: getQuestions("isee_ordinario", answers, "it").map((q) => q.id),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    submittedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 86400000).toISOString(),
  });
  const checklist = buildChecklist("isee_ordinario", answers, buildHousehold(answers), "it");
  for (const [n, item] of checklist.entries()) {
    await storage.put(`doc${n}.pdf`, new Uint8Array([1, 2, n]));
    await db.insert(documents).values({
      id: `doc${n}`,
      caseId: "case",
      fileName: "NOME-RISERVATO.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      pages: 1,
      storageKey: `doc${n}.pdf`,
      sha256: `hash${n}`,
      uploadedAt: now.toISOString(),
      checklistItemId: item.id,
      memberId: item.memberId,
      status: "analyzed",
      analysis: {
        engine: "heuristic",
        detectedRequirementId: item.requirementId,
        detectedLabel: null,
        confidence: 0.8,
        ownerName: "Persona Riservata",
        referenceYear: null,
        expiresOn: item.requirementId === "identity" ? "2030-12-31" : null,
        legible: true,
        pagesComplete: true,
        findings: [],
      },
    });
  }
});
it("suggerisce solo con due compiti AI riusciti; espone badge, filtro e conteggio", async () => {
  const response = await evaluate();
  expect(response.status).toBe(200);
  const view = NearReady.parse(await response.json());
  expect(view).toMatchObject({ state: "suggested", result: "eligible" });
  expect(view.criticalFields.some((f) => f.documentId && f.page === 1)).toBe(true);
  const listResponse = await request("/cases?ai=near_ready");
  expect(listResponse.status).toBe(200);
  const list = CaseListResponse.parse(await listResponse.json());
  expect(list.items).toHaveLength(1);
  expect(list.items[0]).toMatchObject({ aiPriority: "near_ready", nearReadyBadge: true });
  expect(list.priorityCounts.near_ready).toBe(1);
  // An unread citizen question outranks the suggestion in the badge, the filter and the count.
  await db.insert(messages).values({
    id: "question",
    caseId: "case",
    role: "citizen",
    text: "Quando devo portare i documenti?",
    createdAt: now.toISOString(),
  });
  const asked = CaseListResponse.parse(await (await request("/cases?ai=near_ready")).json());
  expect(asked.items).toHaveLength(0);
  expect(asked.priorityCounts.near_ready).toBe(0);
  const all = CaseListResponse.parse(await (await request("/cases")).json());
  expect(all.items.find((item) => item.id === "case")?.aiPriority).toBe("citizen_question");
  await db.delete(messages).where(eq(messages.id, "question"));
  const [entry] = await db.select().from(nearReadyEvaluations);
  expect(entry?.snapshot.tasks.map((t) => t.task)).toEqual([
    "near_ready.read",
    "near_ready.read",
    "near_ready.compare",
  ]);
  expect(entry?.snapshot.tasks.every((t) => !!t.model && t.engine === "ai")).toBe(true);
  const dossierResponse = await request("/cases/case");
  expect(dossierResponse.status).toBe(200);
  expect(CaseDossier.parse(await dossierResponse.json()).nearReady?.state).toBe("suggested");
});
it("condivide il lavoro AI della prima valutazione tra letture concorrenti", async () => {
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const calls = vi.fn<Transport>(async (r) => {
    entered();
    await gate;
    return baselineReply(r);
  });
  reply = calls;
  const first = request("/cases/case");
  await started;
  const others = [request("/cases/case"), request("/cases/case")];
  await new Promise((resolve) => setTimeout(resolve, 40));
  release();
  const responses = await Promise.all([first, ...others]);
  expect(
    responses.map((r) => r.status),
    JSON.stringify(logs),
  ).toEqual([200, 200, 200]);
  const repeated = await Promise.all(Array.from({ length: 12 }, () => request("/cases/case")));
  expect(
    repeated.map((r) => r.status),
    JSON.stringify(logs),
  ).toEqual(Array(12).fill(200));
  expect(calls).toHaveBeenCalledTimes(3);
  expect(await db.select().from(nearReadyEvaluations)).toHaveLength(1);
});

it("limita anche il ricontrollo esplicito prima di chiamare il provider o cambiare versione", async () => {
  await db.insert(rateLimits).values({
    key: rateKey(rateLimitSecret(undefined), "copilot:3600", "operator:admin"),
    count: 60,
    resetAt: new Date(now.getTime() + 3600000).toISOString(),
  });
  const calls = vi.fn(baselineReply);
  reply = calls;
  const version = (await current()).updatedAt;
  const response = await evaluate();
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("3600");
  expect(calls).not.toHaveBeenCalled();
  expect((await current()).updatedAt).toBe(version);
  expect(await db.select().from(nearReadyEvaluations)).toHaveLength(0);
});

it("limita il report aggregato prima di leggere lo storico", async () => {
  await db.insert(rateLimits).values({
    key: rateKey(rateLimitSecret(undefined), "export:60", "operator:admin"),
    count: 20,
    resetAt: new Date(now.getTime() + 60000).toISOString(),
  });
  const response = await request("/reports/near-ready");
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("60");
});

it("non pubblica il suggerimento se una nuova incongruenza arriva durante la lettura AI", async () => {
  let changed = false;
  reply = async (r) => {
    if (!changed) {
      changed = true;
      await db.update(cases).set({ aiAttention: 1 }).where(eq(cases.id, "case"));
    }
    return baselineReply(r);
  };
  expect((await evaluate()).status).toBe(409);
  expect(await db.select().from(nearReadyEvaluations)).toHaveLength(0);
});

it("una nuova incongruenza ritira il suggerimento anche senza cambiare versione", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  const version = (await current()).updatedAt;
  await db.update(cases).set({ aiAttention: 1 }).where(eq(cases.id, "case"));
  expect((await current()).updatedAt).toBe(version);
  expect((await db.select().from(nearReadyEvaluations))[0]?.state).toBe("withdrawn");
  expect(
    (
      await request("/cases/case/near-ready/decision", "POST", {
        evaluationId: view.evaluationId,
        expectedUpdatedAt: version,
        decision: "accept",
      })
    ).status,
  ).toBe(409);
});

it("due operatori non possono accettare/scartare lo stesso suggerimento", async () => {
  const view = NearReady.parse(await (await evaluate()).json()),
    row = await current();
  const payload = {
    evaluationId: view.evaluationId,
    expectedUpdatedAt: row.updatedAt,
    decision: "accept",
  };
  const results = await Promise.all([
    request("/cases/case/near-ready/decision", "POST", payload),
    request(
      "/cases/case/near-ready/decision",
      "POST",
      { ...payload, decision: "dismiss", reason: "identity" },
      second,
    ),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await current()).status).toBe("submitted");
  expect(
    await db
      .select()
      .from(nearReadyEvents)
      .where(sql`${nearReadyEvents.action} in ('accepted','dismissed')`),
  ).toHaveLength(1);
});
it("ritira atomicamente su nuova versione e rifiuta una vecchia schermata", async () => {
  const view = NearReady.parse(await (await evaluate()).json()),
    row = await current();
  await db
    .update(cases)
    .set({ answers: { ...row.answers, housing: "rent" }, updatedAt: nextCaseUpdate(row, now) })
    .where(eq(cases.id, row.id));
  const response = await request("/cases/case");
  const dossier = CaseDossier.parse(await response.json());
  expect(dossier.nearReady).toMatchObject({
    state: "withdrawn",
    caseVersion: (await current()).updatedAt,
  });
  expect(
    (
      await request("/cases/case/near-ready/decision", "POST", {
        evaluationId: view.evaluationId,
        expectedUpdatedAt: row.updatedAt,
        decision: "accept",
      })
    ).status,
  ).toBe(409);
  expect(
    await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.action, "withdrawn")),
  ).toHaveLength(1);
  expect(
    CaseListResponse.parse(await (await request("/cases?ai=near_ready")).json()).items,
  ).toEqual([]);
});
it("shadow non rivela esito, motivi o campi prima del giudizio cieco di ogni operatore", async () => {
  await db
    .update(settings)
    .set({ nearReadyMode: "shadow" })
    .where(eq(settings.organizationId, "org"));
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view).toMatchObject({
    state: "shadow",
    result: null,
    evaluationId: null,
    criticalFields: [],
    exclusions: [],
    conditionsMet: [],
    blindReviewRequired: true,
  });
  const row = await current();
  const response = await request("/cases/case/near-ready/blind-review", "POST", {
    expectedUpdatedAt: row.updatedAt,
    ready: false,
    reason: "identity",
  });
  expect(response.status).toBe(200);
  expect(NearReady.parse(await response.json()).result).toBe("eligible");
  expect(
    CaseDossier.parse(await (await request("/cases/case", "GET", undefined, second)).json())
      .nearReady?.result,
  ).toBeNull();
  expect(
    (
      await request("/cases/case/near-ready/blind-review", "POST", {
        expectedUpdatedAt: row.updatedAt,
        ready: true,
        reason: "other",
      })
    ).status,
  ).toBe(409);
  expect(await db.select().from(nearReadyBlindReviews)).toHaveLength(1);
  expect(
    CaseListResponse.parse(await (await request("/cases?ai=near_ready")).json()).items,
  ).toHaveLength(0);
});
it("off non chiama AI; senza AI non suggerisce mai, nemmeno al refresh", async () => {
  const spy = vi.fn(baselineReply);
  reply = spy;
  await db.update(settings).set({ nearReadyMode: "off" }).where(eq(settings.organizationId, "org"));
  expect(
    NearReady.parse(await (await evaluate()).json()).exclusions.some((e) => e.code === "mode_off"),
  ).toBe(true);
  expect(spy).not.toHaveBeenCalled();
  await db
    .update(settings)
    .set({ nearReadyMode: "visible" })
    .where(eq(settings.organizationId, "org"));
  ai = new AiIntelligence({ config: loadAiConfig({}) });
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view.state).toBe("not_eligible");
  expect(view.exclusions).toContainEqual({
    code: "ai_unavailable",
    text: "Lettura AI non disponibile.",
  });
  ai = new AiIntelligence({
    config: loadAiConfig({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "synthetic",
      AI_MAX_ATTEMPTS: "1",
    }),
    transport: baselineReply,
  });
  expect(NearReady.parse(await (await evaluate()).json()).state).toBe("suggested");
});
it.each(["fallback", "security", "confidence", "compare"])(
  "esclude risposta AI %s",
  async (kind) => {
    reply = async (r) => {
      if (kind === "fallback") return { output: { invalid: true } };
      const result = await baselineReply(r);
      if (r.system.includes("rapid-review screening")) {
        const output = result.output as {
          securityWarning: boolean;
          fields: { confidence: number }[];
        };
        if (kind === "security") output.securityWarning = true;
        if (kind === "confidence") output.fields[0]!.confidence = 0.97;
      } else if (kind === "compare") result.output = { consistent: false, securityWarning: false };
      return result;
    };
    const response = await evaluate();
    expect(response.status).toBe(200);
    expect(NearReady.parse(await response.json()).state).toBe("not_eligible");
  },
);
it("registra esiti finali, misura precisione e sospende tutti i suggerimenti con errore critico confermato", async () => {
  await evaluate();
  await db
    .update(cases)
    .set({ reviewStartedAt: new Date(now.getTime() - 4 * 60000).toISOString() })
    .where(eq(cases.id, "case"));
  const row = await current();
  const response = await request("/cases/case/near-ready/final-decision", "POST", {
    expectedUpdatedAt: row.updatedAt,
    ready: false,
    reason: "identity",
    criticalError: "identity",
  });
  expect(response.status).toBe(200);
  const [policy] = await db.select().from(settings);
  expect(policy?.nearReadyMode).toBe("shadow");
  expect(new Date(policy!.nearReadySuspendedAt!).toISOString()).toBe(now.toISOString());
  const reportResponse = await request("/reports/near-ready");
  expect(reportResponse.status).toBe(200);
  const report = NearReadyPilotResponse.parse(await reportResponse.json());
  expect(report).toMatchObject({
    calibrationPassed: false,
    intervalMethod: "Clopper-Pearson",
    total: {
      selected: 1,
      falseNearReady: 1,
      precision: 0,
      criticalErrors: 1,
      suggestedReview: { medianMinutes: 4, p95Minutes: 4 },
    },
  });
  expect((await request("/reports/near-ready", "GET", undefined, second)).status).toBe(403);
  expect(
    CaseListResponse.parse(await (await request("/cases?ai=near_ready")).json()).items,
  ).toHaveLength(0);
  expect((await db.select().from(nearReadyEvaluations))[0]?.state).toBe("withdrawn");
});
it("non pubblica un risultato AI se cambia il caso durante la rete", async () => {
  let changed = false;
  reply = async (r) => {
    if (!changed) {
      changed = true;
      const row = await current();
      await db
        .update(cases)
        .set({ updatedAt: nextCaseUpdate(row, now) })
        .where(eq(cases.id, "case"));
    }
    return baselineReply(r);
  };
  expect((await evaluate()).status).toBe(409);
  expect(await db.select().from(nearReadyEvaluations)).toHaveLength(0);
});
it("nessun nome, filename, importo o nota in log, snapshot e audit; accessi isolati per CAF", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  const row = await current();
  await request("/cases/case/near-ready/decision", "POST", {
    evaluationId: view.evaluationId,
    expectedUpdatedAt: row.updatedAt,
    decision: "dismiss",
    reason: "other",
    note: "NOTA-RISERVATA",
  });
  const entries = await db
    .select({ snapshot: nearReadyEvaluations.snapshot })
    .from(nearReadyEvaluations);
  const serialized = JSON.stringify([
    logs,
    entries,
    await db.select().from(nearReadyEvents),
    await db.select().from(events),
  ]);
  for (const secret of ["Persona", "Riservata", "NOME-RISERVATO", "12345,67", "NOTA-RISERVATA"])
    expect(serialized).not.toContain(secret);
  expect(
    (
      await request(
        "/cases/case/near-ready/evaluate",
        "POST",
        { expectedUpdatedAt: row.updatedAt },
        "f".repeat(43),
      )
    ).status,
  ).toBe(404);
});
it("AI consistency aperta resta esclusa anche con confronto nuovo positivo", async () => {
  const row = await current();
  await db.insert(copilotCache).values({
    caseId: row.id,
    caseVersion: row.updatedAt,
    task: "consistency",
    payload: {
      engine: "ai",
      caseVersion: row.updatedAt,
      generatedAt: now.toISOString(),
      issues: [
        {
          id: "ai:existing",
          severity: "warning",
          text: "Da controllare",
          evidence: [{ id: "doc0", kind: "document", label: "Documento" }],
          checklistItemId: null,
        },
      ],
    },
    leaseToken: "lease",
    leaseUntil: now.toISOString(),
  });
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view.exclusions.some((e) => e.code === "ai_issues")).toBe(true);
});
it("riapre la verifica quando cambia profilo AI e rifiuta il suggerimento precedente", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  ai = new AiIntelligence({ config: loadAiConfig({}) });
  expect(CaseDossier.parse(await (await request("/cases/case")).json()).nearReady?.state).toBe(
    "withdrawn",
  );
  expect(
    CaseListResponse.parse(await (await request("/cases?ai=near_ready")).json()).items,
  ).toHaveLength(0);
  expect(
    (
      await request("/cases/case/near-ready/decision", "POST", {
        evaluationId: view.evaluationId,
        expectedUpdatedAt: (await current()).updatedAt,
        decision: "accept",
      })
    ).status,
  ).toBe(409);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total.evaluated).toBe(1);
  expect(report.calibration.evaluated).toBe(0);
});
it.each([false, true])(
  "correzioni dopo il suggerimento non riscrivono la verità originaria (cieco negativo: %s)",
  async (blind) => {
    if (blind)
      await db
        .update(settings)
        .set({ nearReadyMode: "shadow" })
        .where(eq(settings.organizationId, "org"));
    await evaluate();
    if (blind) {
      expect(
        (
          await request("/cases/case/near-ready/blind-review", "POST", {
            expectedUpdatedAt: (await current()).updatedAt,
            ready: false,
            reason: "identity",
          })
        ).status,
      ).toBe(200);
    }
    const original = (await db.select().from(nearReadyEvaluations))[0]!;
    // Operator work no longer supersedes the evaluation: the correction comes from the citizen.
    await citizenChanges();
    expect((await patchCase({ status: "in_review" })).status).toBe(200);
    await verifyAll();
    now = new Date(now.getTime() + 3 * 60000);
    const response = await request("/cases/case", "PATCH", {
      expectedUpdatedAt: (await current()).updatedAt,
      status: "ready",
    });
    expect(response.status).toBe(200);
    const report = NearReadyPilotResponse.parse(
      await (await request("/reports/near-ready")).json(),
    );
    expect(report.total).toMatchObject({
      precision: blind ? 0 : null,
      reviewedSelected: blind ? 1 : 0,
      falseNearReady: blind ? 1 : 0,
      unjudged: blind ? 0 : 1,
      disagreements: 0,
      suggestedReview: { count: 0, medianMinutes: null },
    });
    expect(
      await db
        .select()
        .from(nearReadyEvents)
        .where(
          and(
            eq(nearReadyEvents.evaluationId, original.id),
            eq(nearReadyEvents.action, "final_decision"),
          ),
        ),
    ).toEqual([]);
  },
);
it("la conferma pronta giudica la versione corrente prima di avanzarla", async () => {
  const { checklistReviews } = await import("@avanti/db");
  const row = await current();
  const items = buildChecklist("isee_ordinario", row.answers, buildHousehold(row.answers), "it");
  await db.insert(checklistReviews).values(
    items.map((item) => ({
      caseId: row.id,
      itemId: item.id,
      decision: "verified" as const,
      operatorId: "operator",
      reviewedAt: now.toISOString(),
    })),
  );
  await db
    .update(cases)
    .set({ status: "in_review", reviewStartedAt: now.toISOString() })
    .where(eq(cases.id, row.id));
  const screened = NearReady.parse(await (await evaluate()).json());
  now = new Date(now.getTime() + 3 * 60000);
  expect(
    (
      await request("/cases/case", "PATCH", {
        expectedUpdatedAt: (await current()).updatedAt,
        status: "ready",
      })
    ).status,
  ).toBe(200);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total).toMatchObject({
    unjudged: 0,
    disagreements: 0,
    precision: 1,
    reviewedSelected: 1,
    suggestedReview: { medianMinutes: 3 },
  });
  const [final] = await db
    .select()
    .from(nearReadyEvents)
    .where(eq(nearReadyEvents.action, "final_decision"));
  expect(new Date(final!.caseVersion).toISOString()).toBe(screened.evaluatedVersion);
  expect((await current()).updatedAt).not.toBe(screened.evaluatedVersion);
});
it("accettato, presa in carico e verifica delle voci: «pronta» etichetta la valutazione accettata", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view.state).toBe("suggested");
  expect(
    (
      await request("/cases/case/near-ready/decision", "POST", {
        evaluationId: view.evaluationId,
        expectedUpdatedAt: (await current()).updatedAt,
        decision: "accept",
      })
    ).status,
  ).toBe(200);
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  await verifyAll();
  expect((await patchCase({ internalNotes: "ESEMPIO nota" })).status).toBe(200);
  const dossier = CaseDossier.parse(await (await request("/cases/case")).json());
  expect(dossier.nearReady).toMatchObject({ state: "accepted", evaluationId: view.evaluationId });
  expect(dossier.nearReady?.reviewOrder.length).toBeGreaterThan(0);
  now = new Date(now.getTime() + 5 * 60000);
  expect((await patchCase({ status: "ready" })).status).toBe(200);
  const finals = await db
    .select()
    .from(nearReadyEvents)
    .where(eq(nearReadyEvents.action, "final_decision"));
  expect(finals).toMatchObject([{ evaluationId: view.evaluationId, ready: true }]);
  expect(new Date(finals[0]!.caseVersion).toISOString()).toBe(view.evaluatedVersion);
  expect(
    await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.action, "withdrawn")),
  ).toEqual([]);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total).toMatchObject({
    unjudged: 0,
    reviewedSelected: 1,
    correctSelected: 1,
    precision: 1,
    suggestedReview: { count: 1, medianMinutes: 5 },
  });
  // Never a silent 200: the outcome of this evaluation is already recorded.
  const again = await finalDecision({ ready: false, reason: "identity" });
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({
    error: { code: "conflict", message: expect.stringContaining("già registrato") },
  });
  expect(
    await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.action, "final_decision")),
  ).toHaveLength(1);
});
it("dopo l'accettazione il cittadino cambia il fascicolo: ritirato, nessun esito attribuito", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  await request("/cases/case/near-ready/decision", "POST", {
    evaluationId: view.evaluationId,
    expectedUpdatedAt: (await current()).updatedAt,
    decision: "accept",
  });
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await db.select().from(nearReadyEvaluations))[0]?.state).toBe("accepted");
  await citizenChanges();
  expect((await db.select().from(nearReadyEvaluations))[0]?.state).toBe("withdrawn");
  expect(CaseDossier.parse(await (await request("/cases/case")).json()).nearReady).toMatchObject({
    state: "withdrawn",
    reviewOrder: [],
  });
  const stale = await finalDecision({ ready: false, reason: "identity" });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({
    error: { code: "conflict", message: expect.stringContaining("Ricontrolla") },
  });
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  await verifyAll();
  expect((await patchCase({ status: "ready" })).status).toBe(200);
  expect(
    await db
      .select()
      .from(nearReadyEvents)
      .where(sql`${nearReadyEvents.action} in ('final_decision','critical_error')`),
  ).toEqual([]);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total).toMatchObject({ unjudged: 1, reviewedSelected: 0, precision: null });
});
it("«non era pronta» con errore critico marca solo la valutazione giudicata e sospende", async () => {
  await evaluate();
  const [first] = await db.select().from(nearReadyEvaluations);
  await citizenChanges();
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view).toMatchObject({ state: "suggested", evaluatedVersion: view.caseVersion });
  expect(view.evaluationId).not.toBe(first!.id);
  await request("/cases/case/near-ready/decision", "POST", {
    evaluationId: view.evaluationId,
    expectedUpdatedAt: (await current()).updatedAt,
    decision: "accept",
  });
  expect((await patchCase({ internalNotes: "ESEMPIO nota" })).status).toBe(200);
  const response = await finalDecision({
    ready: false,
    reason: "identity",
    criticalError: "identity",
  });
  expect(response.status).toBe(200);
  const marked = await db
    .select()
    .from(nearReadyEvents)
    .where(sql`${nearReadyEvents.action} in ('final_decision','critical_error')`);
  expect(marked.map((e) => [e.action, e.evaluationId]).sort()).toEqual([
    ["critical_error", view.evaluationId],
    ["final_decision", view.evaluationId],
  ]);
  const [policy] = await db.select().from(settings).where(eq(settings.organizationId, "org"));
  expect(policy).toMatchObject({ nearReadyMode: "shadow" });
  expect(new Date(policy!.nearReadySuspendedAt!).toISOString()).toBe(now.toISOString());
  // The cohort is the first screening, of content the critical error did not judge.
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total).toMatchObject({ evaluated: 1, unjudged: 1, criticalErrors: 0 });
});
it("un errore grave non si attribuisce a un controllo che non suggeriva nulla", async () => {
  reply = async (r) => {
    const result = await baselineReply(r);
    if (r.system.includes("cross-check the pilot"))
      result.output = { consistent: false, securityWarning: false };
    return result;
  };
  expect(NearReady.parse(await (await evaluate()).json()).state).toBe("not_eligible");
  const response = await finalDecision({
    ready: false,
    reason: "identity",
    criticalError: "identity",
  });
  expect(response.status).toBe(409);
  const [policy] = await db.select().from(settings).where(eq(settings.organizationId, "org"));
  expect(policy?.nearReadySuspendedAt).toBeNull();
  expect(
    await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.action, "critical_error")),
  ).toEqual([]);
  expect((await finalDecision({ ready: false, reason: "identity" })).status).toBe(200);
});
it("ombra: il lavoro dell'operatore non blocca il giudizio cieco; dopo un cambio del cittadino si ricontrolla", async () => {
  await db
    .update(settings)
    .set({ nearReadyMode: "shadow" })
    .where(eq(settings.organizationId, "org"));
  await evaluate();
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  const blindNow = async (ready: boolean) =>
    request("/cases/case/near-ready/blind-review", "POST", {
      expectedUpdatedAt: (await current()).updatedAt,
      ready,
      reason: "other",
    });
  expect(
    CaseDossier.parse(await (await request("/cases/case")).json()).nearReady?.blindReviewRequired,
  ).toBe(true);
  expect((await blindNow(true)).status).toBe(200);
  await citizenChanges();
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  const superseded = CaseDossier.parse(await (await request("/cases/case")).json()).nearReady;
  expect(superseded).toMatchObject({
    state: "withdrawn",
    blindReviewRequired: false,
    evaluationId: null,
    result: null,
    conditionsMet: [],
    criticalFields: [],
    exclusions: [expect.objectContaining({ code: "stale_version" })],
  });
  expect(superseded?.evaluatedVersion).not.toBe(superseded?.caseVersion);
  expect((await blindNow(false)).status).toBe(409);
  const rechecked = NearReady.parse(await (await evaluate()).json());
  expect(rechecked).toMatchObject({
    state: "shadow",
    blindReviewRequired: true,
    result: null,
    evaluatedVersion: rechecked.caseVersion,
  });
  expect(await db.select().from(nearReadyEvaluations)).toHaveLength(2);
  expect((await blindNow(false)).status).toBe(200);
  const reviews = await db.select().from(nearReadyBlindReviews);
  expect(new Set(reviews.map((r) => new Date(r.caseVersion).toISOString())).size).toBe(2);
});
it("cambiare una preferenza estranea non resetta modalità e soglie", async () => {
  await db
    .update(settings)
    .set({ nearReadyCriticalThreshold: 0.99 })
    .where(eq(settings.organizationId, "org"));
  expect((await request("/settings", "PATCH", { notifyCitizenReady: true })).status).toBe(200);
  const [policy] = await db.select().from(settings);
  expect(policy).toMatchObject({
    nearReadyMode: "visible",
    nearReadyCriticalThreshold: 0.99,
    notifyCitizenReady: true,
  });
});
it("revoca e retention includono le valutazioni senza duplicare dati personali", async () => {
  await evaluate();
  const response = await request("/cases/case", "DELETE", { confirmReference: "TEST-1" });
  expect(response.status).toBe(204);
  expect(await db.select().from(nearReadyEvaluations)).toHaveLength(0);
  expect(await db.select().from(nearReadyEvents)).toHaveLength(0);
  expect(await db.select().from(nearReadyBlindReviews)).toHaveLength(0);
});
it("il seed pulito attraversa davvero API e storage; offline resta escluso", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { seedDemo } = await import("../../db/src/demo");
  const { DiskStorage } = await import("./storage");
  await db.execute(sql`truncate organizations, rate_limits cascade`);
  const dir = await mkdtemp(join(tmpdir(), "avanti-near-ready-demo-"));
  try {
    await seedDemo(db, { now, uploadsDir: dir });
    await db.insert(sessions).values({
      id: "demo-session",
      operatorId: "demo-admin",
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    });
    await db
      .update(settings)
      .set({ nearReadyMode: "visible" })
      .where(eq(settings.organizationId, "demo-caf-milano"));
    const make = () =>
      createApp({
        db,
        ai,
        storage: new DiskStorage(dir),
        clock: () => now,
        publicUrl: origin,
        errorLogger: () => {},
      });
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: `avanti_session=${token}`,
    };
    let r = await make().request("/api/cases/demo-case-2", { headers });
    expect(r.status).toBe(200);
    let d = CaseDossier.parse(await r.json());
    expect(d.nearReady?.state).toBe("suggested");
    ai = new AiIntelligence({ config: loadAiConfig({}) });
    r = await make().request("/api/cases/demo-case-2/near-ready/evaluate", {
      method: "POST",
      headers,
      body: JSON.stringify({ expectedUpdatedAt: d.updatedAt }),
    });
    expect(r.status).toBe(200);
    expect(
      NearReady.parse(await r.json()).exclusions.some((e) => e.code === "ai_unavailable"),
    ).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("un controllo del giorno precedente non rimane utilizzabile senza nuova verifica", async () => {
  await evaluate();
  now = new Date(now.getTime() + 86400000);
  await db.update(sessions).set({
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600000).toISOString(),
  });
  const response = await request("/cases/case");
  expect(response.status).toBe(200);
  expect(CaseDossier.parse(await response.json()).nearReady?.state).toBe("withdrawn");
  expect(
    CaseListResponse.parse(await (await request("/cases?ai=near_ready")).json()).items,
  ).toHaveLength(0);
  expect(
    await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.action, "withdrawn")),
  ).toHaveLength(1);
});
it("budget finito non usa letture precedenti come ripiego positivo", async () => {
  const spy = vi.fn(baselineReply);
  reply = spy;
  await db
    .update(settings)
    .set({ aiMonthlyBudgetEur: 0 })
    .where(eq(settings.organizationId, "org"));
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view.state).toBe("not_eligible");
  expect(view.exclusions.some((e) => e.code === "ai_unavailable")).toBe(true);
  expect(spy).not.toHaveBeenCalled();
});
it("lettura manuale verificata usa solo il confronto AI e una metrica distinta", async () => {
  const { checklistReviews } = await import("@avanti/db");
  const row = await current();
  const items = buildChecklist("isee_ordinario", row.answers, buildHousehold(row.answers), "it");
  await db.insert(checklistReviews).values(
    items.map((item) => ({
      caseId: row.id,
      itemId: item.id,
      decision: "verified" as const,
      operatorId: "operator",
      reviewedAt: now.toISOString(),
    })),
  );
  expect(NearReady.parse(await (await evaluate()).json()).state).toBe("suggested");
  const [e] = await db.select().from(nearReadyEvaluations);
  expect(e?.reading).toBe("manual");
  expect(e?.snapshot.tasks.map((t) => t.task)).toEqual(["near_ready.compare"]);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.groups[0]?.reading).toBe("manual");
});
it("un modello di riserva riuscito non viene ammesso come lettura senza fallback", async () => {
  reply = async (r) => ({ ...(await baselineReply(r)), model: "other/model" });
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view.state).toBe("not_eligible");
  expect(view.exclusions.some((e) => e.code === "ai_fallback")).toBe(true);
});
it("una verifica manuale antecedente a nuove risposte non evita la rilettura degli originali", async () => {
  const { checklistReviews } = await import("@avanti/db");
  const row = await current();
  const items = buildChecklist("isee_ordinario", row.answers, buildHousehold(row.answers), "it");
  await db.insert(checklistReviews).values(
    items.map((item) => ({
      caseId: row.id,
      itemId: item.id,
      decision: "verified" as const,
      operatorId: "operator",
      reviewedAt: now.toISOString(),
    })),
  );
  now = new Date(now.getTime() + 1000);
  await db.update(cases).set({ updatedAt: now.toISOString() }).where(eq(cases.id, row.id));
  await db.insert(events).values({
    id: "new-answer",
    caseId: row.id,
    organizationId: "org",
    actor: "citizen",
    type: "answer.updated",
    at: now.toISOString(),
  });
  expect(NearReady.parse(await (await evaluate()).json()).state).toBe("suggested");
  const [evaluation] = await db.select().from(nearReadyEvaluations);
  expect(evaluation?.snapshot.tasks.filter((t) => t.task === "near_ready.read")).toHaveLength(
    items.length,
  );
  expect(evaluation?.reading).toBe("ai");
});
const askIntegration = async (checklistItemIds: string[]) =>
  request("/cases/case/requests", "POST", {
    expectedUpdatedAt: (await current()).updatedAt,
    checklistItemIds,
    message: "Serve un documento più leggibile.",
  });
const finals = () =>
  db.select().from(nearReadyEvents).where(eq(nearReadyEvents.action, "final_decision"));
it("integrazione su una voce obbligatoria: «non era pronta» sulla valutazione suggerita, contata dalla precisione", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view.state).toBe("suggested");
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  await db
    .update(cases)
    .set({ reviewStartedAt: new Date(now.getTime() - 3 * 60000).toISOString() })
    .where(eq(cases.id, "case"));
  expect((await askIntegration(["identity:person"])).status).toBe(200);
  expect(await finals()).toMatchObject([
    {
      evaluationId: view.evaluationId,
      ready: false,
      reason: "integration_requested",
      actorId: "admin",
      durationMinutes: 3,
    },
  ]);
  // A second request on the same content and the citizen's reply add nothing to this label.
  expect((await askIntegration(["tax_code:person"])).status).toBe(200);
  await citizenChanges();
  expect(await finals()).toHaveLength(1);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total).toMatchObject({
    unjudged: 0,
    reviewedSelected: 1,
    falseNearReady: 1,
    criticalErrors: 0,
    precision: 0,
  });
  const [policy] = await db.select().from(settings).where(eq(settings.organizationId, "org"));
  expect(policy?.nearReadySuspendedAt).toBeNull();
});
it("un suggerimento scartato riceve comunque l'esito dell'integrazione", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  const dismissed = await request("/cases/case/near-ready/decision", "POST", {
    evaluationId: view.evaluationId,
    expectedUpdatedAt: (await current()).updatedAt,
    decision: "dismiss",
    reason: "household",
  });
  expect(dismissed.status).toBe(200);
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await askIntegration(["tax_code:person"])).status).toBe(200);
  expect(await finals()).toMatchObject([{ ready: false, reason: "integration_requested" }]);
});
it("integrazione solo per voci facoltative o senza voci: nessun esito automatico", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  expect(view.state).toBe("suggested");
  // An optional item on the judged content (direct write: content_version does not move).
  await db
    .update(cases)
    .set({ answers: sql`${cases.answers} || '{"excluded_savings": true}'::jsonb` })
    .where(eq(cases.id, "case"));
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await askIntegration(["excluded_savings:case"])).status).toBe(200);
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await askIntegration([])).status).toBe(200);
  expect(await finals()).toEqual([]);
});
it("richiesta ritirata e poi «pronta» sullo stesso contenuto: vale l'esito dell'operatore", async () => {
  const view = NearReady.parse(await (await evaluate()).json());
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await askIntegration(["identity:person"])).status).toBe(200);
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await db.select().from(nearReadyEvaluations))[0]?.state).toBe("suggested");
  await verifyAll();
  expect((await patchCase({ status: "ready" })).status).toBe(200);
  expect(await finals()).toMatchObject([
    { evaluationId: view.evaluationId, ready: true, reason: null },
  ]);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total).toMatchObject({ correctSelected: 1, falseNearReady: 0 });
});
it("un esito già registrato resta; un motivo preciso o un errore grave sostituiscono quello automatico", async () => {
  await evaluate();
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await finalDecision({ ready: false, reason: "household" })).status).toBe(200);
  expect((await askIntegration(["identity:person"])).status).toBe(200);
  expect(await finals()).toMatchObject([{ ready: false, reason: "household" }]);

  await db.execute(sql`truncate near_ready_evaluations cascade`);
  await db.update(cases).set({ status: "in_review" }).where(eq(cases.id, "case"));
  await citizenChanges();
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect(NearReady.parse(await (await evaluate()).json()).state).toBe("suggested");
  expect((await askIntegration(["identity:person"])).status).toBe(200);
  const critical = await finalDecision({
    ready: false,
    reason: "identity",
    criticalError: "identity",
  });
  expect(critical.status).toBe(200);
  expect(await finals()).toMatchObject([{ ready: false, reason: "identity" }]);
  expect(
    await db.select().from(nearReadyEvents).where(eq(nearReadyEvents.action, "critical_error")),
  ).toHaveLength(1);
});
it("ombra: l'integrazione registra l'esito senza togliere il giudizio cieco; nulla senza suggerimento", async () => {
  await db
    .update(settings)
    .set({ nearReadyMode: "shadow" })
    .where(eq(settings.organizationId, "org"));
  expect(NearReady.parse(await (await evaluate()).json()).state).toBe("shadow");
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  expect((await askIntegration(["identity:person"])).status).toBe(200);
  expect(await finals()).toMatchObject([{ ready: false, reason: "integration_requested" }]);
  const dossier = CaseDossier.parse(await (await request("/cases/case")).json());
  expect(dossier.nearReady).toMatchObject({ blindReviewRequired: true, result: null });
  const blind = await request("/cases/case/near-ready/blind-review", "POST", {
    expectedUpdatedAt: (await current()).updatedAt,
    ready: true,
    reason: "other",
  });
  expect(blind.status).toBe(200);
  const report = NearReadyPilotResponse.parse(await (await request("/reports/near-ready")).json());
  expect(report.total).toMatchObject({ disagreements: 1, falseNearReady: 1 });

  await db.execute(sql`truncate near_ready_evaluations cascade`);
  reply = async (r) => {
    const result = await baselineReply(r);
    if (r.system.includes("cross-check the pilot"))
      result.output = { consistent: false, securityWarning: false };
    return result;
  };
  await citizenChanges();
  expect((await patchCase({ status: "in_review" })).status).toBe(200);
  await evaluate();
  expect((await db.select().from(nearReadyEvaluations))[0]?.eligible).toBe(false);
  expect((await askIntegration(["identity:person"])).status).toBe(200);
  expect(await finals()).toEqual([]);
});
