import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  cases,
  createDatabase,
  documents,
  events,
  messages,
  offices,
  operators,
  organizations,
  sessions,
  rateLimits,
  type Database,
} from "@avanti/db";
import { AssistantHistory, AssistantReply, CitizenCase, Language } from "@avanti/contracts";
import { createApp } from "./app";
import { createCase } from "./citizen";
import { AiIntelligence } from "./ai";
import { dossierView, caseListViews, caseListColumns } from "./dossier";
import { eraseCase } from "./case-erasure";
import { MemoryStorage } from "./storage";
import { rateKey, rateLimitSecret } from "./rate-limit-key";
import { hashToken } from "./security";
import { loadAiConfig } from "@avanti/ai";
const now = new Date("2027-01-05T10:00:00Z");
let db: Database, close: () => Promise<void>, office: typeof offices.$inferSelect;
beforeAll(async () => {
  ({ db, close } = await createDatabase({ memory: true }));
  await db.insert(organizations).values([
    { id: "caf", name: "CAF", kind: "caf" },
    { id: "other", name: "Other CAF", kind: "caf" },
  ]);
  [office] = (await db
    .insert(offices)
    .values({
      id: "desk",
      organizationId: "caf",
      slug: "desk",
      name: "Sportello",
      city: "Roma",
      address: "Via Esempio",
      openingHours: "09–12",
      bookingUrl: "https://example.test/book",
      citizenNote: "Solo su appuntamento",
    })
    .returning()) as [typeof offices.$inferSelect];
  await db.insert(operators).values({
    id: "op-other",
    organizationId: "other",
    name: "Other",
    email: "other@example.test",
    passwordHash: "unused",
    role: "operator",
  });
  await db.insert(sessions).values({
    id: "session-other",
    tokenHash: hashToken("o".repeat(43)),
    operatorId: "op-other",
    createdAt: now.toISOString(),
    expiresAt: new Date(+now + 3600000).toISOString(),
  });
}, 60000);
afterAll(async () => close?.());
const app = () =>
  createApp({ db, clock: () => now, ai: new AiIntelligence(), storage: new MemoryStorage() });
const post = (a: ReturnType<typeof app>, path: string, input: unknown) =>
  a.request(path, {
    method: "POST",
    headers: { Origin: "http://localhost:3400", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
const fresh = (language: Language = "it") =>
  createCase(db, office, { language, practiceId: "isee_ordinario" }, now);
describe("citizen assistant capability and persistence", () => {
  for (const language of Language.options)
    it(`uses server focus and localized fallback: ${language}`, async () => {
      const { row, token } = await fresh(language),
        a = app();
      const view = CitizenCase.parse(await (await a.request(`/api/c/${token}`)).json());
      const response = await post(a, `/api/c/${token}/assistant`, {
        message: "?",
        focus: { questionId: view.nextQuestion!.id },
        history: [{ text: "internal fake data" }],
      });
      expect(response.status).toBe(200);
      const reply = AssistantReply.parse(await response.json());
      expect(reply).toMatchObject({
        engine: "heuristic",
        action: "explain_question",
        reply: view.nextQuestion!.help ?? view.nextQuestion!.prompt,
      });
      const h = AssistantHistory.parse(await (await a.request(`/api/c/${token}/assistant`)).json());
      expect(h.messages).toHaveLength(2);
      expect(h.remainingToday).toBe(79);
      const dossier = await dossierView(db, row, now);
      expect(dossier.assistantTurns).toHaveLength(2);
      expect(dossier.messages).toHaveLength(1);
    });
  it("refuses long messages, unknown capabilities and cross-CAF operator reads", async () => {
    const { token, row } = await fresh("ar"),
      a = app();
    const response = await post(a, `/api/c/${token}/assistant`, { message: "a".repeat(601) });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain("600");
    expect(
      (await post(a, `/api/c/${"x".repeat(43)}/assistant`, { message: "ciao" })).status,
    ).not.toBe(200);
    expect(
      (
        await a.request(`/api/cases/${row.id}`, {
          headers: { Cookie: `avanti_session=${"o".repeat(43)}` },
        })
      ).status,
    ).not.toBe(200);
  });
  it("enforces 30 hourly assistant questions and 5 daily desk questions", async () => {
    const { token, row } = await fresh(),
      a = app();
    for (let i = 0; i < 30; i++)
      expect((await post(a, `/api/c/${token}/assistant`, { message: "ciao" })).status).toBe(200);
    const denied = await post(a, `/api/c/${token}/assistant`, { message: "ciao" });
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Retry-After")).toBe("3600");
    for (let i = 0; i < 5; i++)
      expect(
        (await post(a, `/api/c/${token}/assistant/ask-desk`, { message: "Aiuto con il documento" }))
          .status,
      ).toBe(201);
    expect(
      (await post(a, `/api/c/${token}/assistant/ask-desk`, { message: "ancora" })).status,
    ).toBe(429);
    const [listRow] = await db.select(caseListColumns).from(cases).where(eq(cases.id, row.id));
    expect((await caseListViews(db, [listRow!], now))[0]?.hasCitizenQuestion).toBe(true);
    expect(
      (await dossierView(db, row, now)).timeline.filter((t) => t.type === "citizen.question"),
    ).toHaveLength(5);
  }, 30000);
  it("deletes assistant history and desk messages with the retained case", async () => {
    const { token, row } = await fresh(),
      a = app();
    await post(a, `/api/c/${token}/assistant`, { message: "ciao" });
    await post(a, `/api/c/${token}/assistant/ask-desk`, { message: "aiuto" });
    await db.transaction((tx) => eraseCase(tx, row, now, null));
    expect(await db.select().from(messages).where(eq(messages.caseId, row.id))).toHaveLength(0);
    const audit = await db.select().from(events).where(eq(events.deletedCaseId, row.id));
    expect(audit.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain("aiuto");
  });
  it("does not persist offered secrets and does not call a provider for emergencies", async () => {
    const { token } = await fresh(),
      a = app();
    const reply = await post(a, `/api/c/${token}/assistant`, {
      message: "La mia password SPID è secret-example-123",
    });
    expect(reply.status).toBe(200);
    const history = await (await a.request(`/api/c/${token}/assistant`)).text();
    expect(history).not.toContain("secret-example-123");
    const emergency = AssistantReply.parse(
      await (await post(a, `/api/c/${token}/assistant`, { message: "Non respiro" })).json(),
    );
    expect(emergency.intent).toBe("emergency");
    expect(emergency.reply).toContain("112");
  });
  it("rejects a late model result after capability rotation", async () => {
    const { token, row } = await fresh();
    let finish!: (x: {
      reply: string;
      intent: "answer";
      action: "none";
      sources: string[];
      engine: "ai";
    }) => void;
    let started!: () => void;
    const ready = new Promise<void>((r) => (started = r)),
      pending = new Promise<Parameters<typeof finish>[0]>((r) => (finish = r));
    const ai = new AiIntelligence();
    ai.assistant = async () => {
      started();
      return pending;
    };
    const a = createApp({ db, clock: () => now, ai, storage: new MemoryStorage() });
    const response = post(a, `/api/c/${token}/assistant`, { message: "Cosa succede dopo?" });
    await ready;
    await db.update(cases).set({ tokenHash: "rotated" }).where(eq(cases.id, row.id));
    finish({
      reply: "Lo sportello controlla.",
      intent: "answer",
      action: "none",
      sources: [],
      engine: "ai",
    });
    expect((await response).status).toBe(410);
    expect(
      await db
        .select()
        .from(messages)
        .where(and(eq(messages.caseId, row.id), eq(messages.kind, "citizen_assistant"))),
    ).toHaveLength(0);
  });
  it("keeps a document without changing the operator decision; scopes document ids", async () => {
    const { token, row } = await fresh(),
      other = await fresh(),
      a = app();
    await db.insert(documents).values({
      id: "doc-keep",
      caseId: row.id,
      fileName: "esempio.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      storageKey: "unused",
      sha256: "hash",
      status: "analyzed",
      uploadedAt: now.toISOString(),
    });
    expect((await post(a, `/api/c/${other.token}/documents/doc-keep/keep`, {})).status).toBe(404);
    expect((await post(a, `/api/c/${token}/documents/doc-keep/keep`, {})).status).toBe(200);
    const view = CitizenCase.parse(await (await a.request(`/api/c/${token}`)).json());
    expect(view.documents[0]?.citizenKeptAt).toBe(now.toISOString());
    expect(view.documents[0]?.citizenCheck.status).toBe("warning");
    expect((await dossierView(db, row, now)).timeline.some((t) => t.type === "document.kept")).toBe(
      true,
    );
  });
  it("returns localized 503 without AI and validates actual audio before transport", async () => {
    const { token } = await fresh("es");
    const form = new FormData();
    form.set("file", new File(["not audio"], "voice.wav", { type: "audio/wav" }));
    form.set("language", "es");
    const response = await app().request(`/api/c/${token}/transcribe`, {
      method: "POST",
      headers: { Origin: "http://localhost:3400" },
      body: form,
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "transcription_unavailable" } });
    const ai = new AiIntelligence({
      config: loadAiConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic" }),
      transport: async () => {
        throw new Error("MustNotRun");
      },
    });
    const a = createApp({ db, clock: () => now, ai, storage: new MemoryStorage() });
    expect(
      (
        await a.request(`/api/c/${token}/transcribe`, {
          method: "POST",
          headers: { Origin: "http://localhost:3400" },
          body: form,
        })
      ).status,
    ).toBe(400);
  });
});

it("keeps the daily quota across capability rotation and localizes the voice quota", async () => {
  const { token, row } = await fresh("fr"),
    a = app();
  await db.insert(rateLimits).values({
    key: rateKey(rateLimitSecret(undefined), "assistant:86400", `case:${row.id}`),
    count: 79,
    resetAt: new Date(+now + 86400000).toISOString(),
  });
  expect((await post(a, `/api/c/${token}/assistant`, { message: "Bonjour" })).status).toBe(200);
  expect(
    AssistantHistory.parse(await (await a.request(`/api/c/${token}/assistant`)).json())
      .remainingToday,
  ).toBe(0);
  const next = "z".repeat(43);
  await db
    .update(cases)
    .set({ tokenHash: hashToken(next) })
    .where(eq(cases.id, row.id));
  expect((await post(a, `/api/c/${next}/assistant`, { message: "Bonjour" })).status).toBe(429);
  const audioCase = await fresh("bn");
  await db.insert(rateLimits).values({
    key: rateKey(rateLimitSecret(undefined), "transcribe:3600", `case:${audioCase.row.id}`),
    count: 20,
    resetAt: new Date(+now + 3600000).toISOString(),
  });
  const blocked = await post(a, `/api/c/${audioCase.token}/transcribe`, {});
  expect(blocked.status).toBe(429);
  expect(((await blocked.json()) as { error: { message: string } }).error.message).toMatch(
    /\p{Script=Bengali}/u,
  );
});
it("applies the shared trusted IP ceiling after the case quota", async () => {
  const { token } = await fresh(),
    secret = "test-rate-secret",
    ip = "203.0.113.19";
  await db.insert(rateLimits).values({
    key: rateKey(secret, "assistant:60", `ip:${ip}`),
    count: 1500,
    resetAt: new Date(+now + 60000).toISOString(),
  });
  const a = createApp({
    db,
    clock: () => now,
    rateLimitSecret: secret,
    clientAddress: () => ip,
    ai: new AiIntelligence(),
    storage: new MemoryStorage(),
  });
  expect((await post(a, `/api/c/${token}/assistant`, { message: "ciao" })).status).toBe(429);
});
it("returns editable transcription without saving audio or text in the dossier", async () => {
  const { token, row } = await fresh("es");
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(new URL("./fixtures/synthetic-audio.ogg", import.meta.url));
  const ai = new AiIntelligence({
    config: loadAiConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic" }),
    transport: async () => ({ output: { text: "Quiero pedir el ISEE para mi familia" } }),
  });
  const a = createApp({ db, clock: () => now, ai, storage: new MemoryStorage() });
  const form = new FormData();
  form.set("file", new File([bytes], "forged.pdf", { type: "application/pdf" }));
  form.set("language", "es");
  const response = await a.request(`/api/c/${token}/transcribe`, {
    method: "POST",
    headers: { Origin: "http://localhost:3400" },
    body: form,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ language: "es", engine: "ai" });
  const history = await db.select().from(messages).where(eq(messages.caseId, row.id));
  expect(history).toHaveLength(1);
  expect(await db.select().from(documents).where(eq(documents.caseId, row.id))).toHaveLength(0);
});
it("never calls a provider when the CAF switched off AI for citizens", async () => {
  const { settings } = await import("@avanti/db");
  const { token } = await fresh();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(new URL("./fixtures/synthetic-audio.ogg", import.meta.url));
  let calls = 0;
  const ai = new AiIntelligence({
    config: loadAiConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic" }),
    transport: async () => {
      calls++;
      return { output: { text: "non deve arrivare" } };
    },
  });
  await db
    .insert(settings)
    .values({ organizationId: "caf", aiCitizenAssistant: false })
    .onConflictDoUpdate({ target: settings.organizationId, set: { aiCitizenAssistant: false } });
  try {
    const a = createApp({ db, clock: () => now, ai, storage: new MemoryStorage() });
    const reply = AssistantReply.parse(
      await (await post(a, `/api/c/${token}/assistant`, { message: "Cos'è l'ISEE?" })).json(),
    );
    expect(reply.engine).toBe("heuristic");
    const form = new FormData();
    form.set("file", new File([bytes], "voce.ogg", { type: "audio/ogg" }));
    form.set("language", "it");
    const voice = await a.request(`/api/c/${token}/transcribe`, {
      method: "POST",
      headers: { Origin: "http://localhost:3400" },
      body: form,
    });
    expect(voice.status).toBe(503);
    expect(calls).toBe(0);
  } finally {
    await db
      .update(settings)
      .set({ aiCitizenAssistant: true })
      .where(eq(settings.organizationId, "caf"));
  }
});
