import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import {
  cases,
  createDatabase,
  documents,
  dossierChatTurns,
  idempotencyKeys,
  messages,
  events,
  offices,
  operators,
  organizations,
  sessions,
  type Database,
} from "@avanti/db";
import {
  AssistantReply,
  CaseDossier,
  CitizenCase,
  ConversationState,
  DossierAskResult,
  IDEMPOTENCY_HEADER,
  type AnswerValue,
} from "@avanti/contracts";
import { getQuestions } from "@avanti/core";
import type { Intelligence } from "./ai";
import { AiIntelligence } from "./ai";
import { createApp } from "./app";
import { MemoryStorage } from "./storage";
import { hashToken } from "./security";
import { MAX_CASE_DOCUMENTS } from "./citizen";
import { createHash } from "node:crypto";
import { IDEMPOTENCY_RETENTION_MS, fingerprint } from "./idempotency";

const origin = "http://localhost:3400";
const operatorToken = "o".repeat(43),
  colleagueToken = "p".repeat(43);
let db: Database, close: () => Promise<void>, now: Date, storage: MemoryStorage;
const local = new AiIntelligence();
const calls = { converse: 0, assistant: 0, task: 0 };
const ai: Intelligence = {
  intake: local.intake.bind(local),
  analyze: local.analyze.bind(local),
  translate: local.translate.bind(local),
  async converse(input) {
    calls.converse++;
    const { converseTask } = await import("@avanti/ai");
    return { ...converseTask.heuristic(input), engine: "ai" as const };
  },
  async assistant(input) {
    calls.assistant++;
    const { heuristicAssistant } = await import("@avanti/core");
    return { ...heuristicAssistant(input), engine: "ai" as const };
  },
  async runTask(task, input) {
    calls.task++;
    return {
      output: task.heuristic(input),
      engine: "ai" as const,
      model: "synthetic",
      attempts: 1,
      latencyMs: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      costEstimate: 0,
      fallbackReason: null,
      retryReasons: [],
    };
  },
};
let secret: string | undefined;
const app = () =>
  createApp({ db, storage, ai, clock: () => now, publicUrl: origin, rateLimitSecret: secret });
function call(
  path: string,
  {
    method = "POST",
    body,
    key,
    cookie,
  }: { method?: string; body?: unknown; key?: string; cookie?: string } = {},
) {
  return app().request(`/api${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body instanceof FormData || body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(key ? { [IDEMPOTENCY_HEADER]: key } : {}),
      ...(cookie ? { Cookie: `avanti_session=${cookie}` } : {}),
    },
    ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
}
const completeAnswers = () => {
  const answers: Record<string, AnswerValue> = {
    household_count: 1,
    members: [
      {
        id: "person",
        firstName: "Persona",
        lastName: "Esempio",
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
  return answers;
};
let sequence = 0;
async function seedCase(status: "intake" | "in_review" = "intake", answers = {}) {
  const id = `case-${++sequence}`;
  const token = String(sequence).padStart(2, "0").repeat(22).slice(0, 43);
  await db.insert(cases).values({
    id,
    organizationId: "org",
    officeId: "office",
    tokenHash: hashToken(token),
    reference: `AV-2027-${String(sequence).padStart(6, "0")}`,
    practiceId: "isee_ordinario",
    language: "it",
    status,
    answers,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(status === "in_review" ? { submittedAt: now.toISOString() } : {}),
    expiresAt: new Date(now.getTime() + 30 * 86400000).toISOString(),
  });
  return { id, token };
}
const turns = async (caseId: string, kind?: string) =>
  (await db.select().from(messages).where(eq(messages.caseId, caseId))).filter(
    (m) => (kind ? m.kind === kind : true) && m.role !== "system",
  );
async function pdf() {
  const document = await PDFDocument.create();
  document.addPage();
  return document.save();
}
function form(bytes: Uint8Array) {
  const body = new FormData();
  body.set("file", new File([bytes as BlobPart], "ESEMPIO.pdf", { type: "application/pdf" }));
  return body;
}

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
  await db.insert(operators).values([
    {
      id: "op",
      organizationId: "org",
      name: "Operatore",
      email: "op@example.invalid",
      passwordHash: "unused",
      role: "operator",
    },
    {
      id: "colleague",
      organizationId: "org",
      name: "Collega",
      email: "co@example.invalid",
      passwordHash: "unused",
      role: "operator",
    },
  ]);
}, 30000);
// Maintenance in the expiry test removes the sliding sessions: every test starts with its own.
async function ensureSessions() {
  const at = new Date("2027-01-05T10:00:00Z");
  await db
    .insert(sessions)
    .values([
      {
        id: "s1",
        operatorId: "op",
        tokenHash: hashToken(operatorToken),
        createdAt: at.toISOString(),
        expiresAt: "2027-02-01T00:00:00Z",
      },
      {
        id: "s2",
        operatorId: "colleague",
        tokenHash: hashToken(colleagueToken),
        createdAt: at.toISOString(),
        expiresAt: "2027-02-01T00:00:00Z",
      },
    ])
    .onConflictDoNothing();
}
afterAll(async () => close?.());
beforeEach(async () => {
  now = new Date("2027-01-05T10:00:00Z");
  secret = undefined;
  await ensureSessions();
  storage = new MemoryStorage();
  Object.assign(calls, { converse: 0, assistant: 0, task: 0 });
});

it("a retried conversation message is stored once and the provider is not called again", async () => {
  const { id, token } = await seedCase();
  const key = crypto.randomUUID();
  const first = await call(`/c/${token}/conversation`, { body: { text: "Vivo da solo." }, key });
  expect(first.status).toBe(200);
  now = new Date(now.getTime() + 5000);
  const retry = await call(`/c/${token}/conversation`, { body: { text: "Vivo da solo." }, key });
  expect(retry.status).toBe(200);
  const state = ConversationState.parse(await retry.json());
  expect(state.turns.filter((t) => t.role === "citizen")).toHaveLength(1);
  expect(await turns(id)).toHaveLength(2);
  expect(calls.converse).toBe(1);
  // The same words sent again as a new action are a new message.
  expect(
    (
      await call(`/c/${token}/conversation`, {
        body: { text: "Vivo da solo." },
        key: crypto.randomUUID(),
      })
    ).status,
  ).toBe(200);
  expect((await turns(id)).filter((m) => m.role === "citizen")).toHaveLength(2);
});

it("two simultaneous attempts with one key leave a single turn and the same answer", async () => {
  const { id, token } = await seedCase();
  const key = crypto.randomUUID();
  const responses = await Promise.all(
    [0, 1].map(() => call(`/c/${token}/conversation`, { body: { text: "Ho un conto." }, key })),
  );
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  const [a, b] = await Promise.all(
    responses.map(async (r) => ConversationState.parse(await r.json())),
  );
  expect(a!.turns.map((t) => t.id)).toEqual(b!.turns.map((t) => t.id));
  expect((await turns(id)).filter((m) => m.role === "citizen")).toHaveLength(1);
});

it("without a key behaves as before; a reused key with other content or route is refused", async () => {
  const { id, token } = await seedCase();
  for (let i = 0; i < 2; i++)
    expect((await call(`/c/${token}/conversation`, { body: { text: "Ciao" } })).status).toBe(200);
  expect((await turns(id)).filter((m) => m.role === "citizen")).toHaveLength(2);
  const key = crypto.randomUUID();
  expect((await call(`/c/${token}/conversation`, { body: { text: "Uno" }, key })).status).toBe(200);
  const other = await call(`/c/${token}/conversation`, { body: { text: "Due" }, key });
  expect(other.status).toBe(409);
  expect((await other.json()).error.code).toBe("conflict");
  expect(
    (await call(`/c/${token}/assistant/ask-desk`, { body: { message: "Uno" }, key })).status,
  ).toBe(409);
  expect(
    (await call(`/c/${token}/conversation`, { body: { text: "Tre" }, key: "corta" })).status,
  ).toBe(400);
  expect((await turns(id)).filter((m) => m.role === "citizen")).toHaveLength(3);
});

it("keys are isolated per case: another case runs its own action", async () => {
  const one = await seedCase(),
    two = await seedCase();
  const key = crypto.randomUUID();
  for (const c of [one, two])
    expect((await call(`/c/${c.token}/conversation`, { body: { text: "Ciao" }, key })).status).toBe(
      200,
    );
  expect(await turns(two.id)).toHaveLength(2);
});

it("assistant and «Chiedi allo sportello» answer a retry with the first result", async () => {
  const { id, token } = await seedCase();
  const key = crypto.randomUUID();
  const body = { message: "Quale documento serve?" };
  const first = AssistantReply.parse(
    await (await call(`/c/${token}/assistant`, { body, key })).json(),
  );
  const retry = await call(`/c/${token}/assistant`, { body, key });
  expect(retry.status).toBe(200);
  expect(AssistantReply.parse(await retry.json())).toEqual(first);
  expect(await turns(id, "citizen_assistant")).toHaveLength(2);
  expect(calls.assistant).toBe(1);
  const desk = crypto.randomUUID();
  const asks = await Promise.all(
    [0, 1].map(() =>
      call(`/c/${token}/assistant/ask-desk`, {
        body: { message: "Posso venire domani?" },
        key: desk,
      }),
    ),
  );
  expect(asks.map((r) => r.status)).toEqual([201, 201]);
  expect(await turns(id, "citizen_question")).toHaveLength(1);
});

it("an answered question tapped again after a lost reply adds one confirmation", async () => {
  const { id, token } = await seedCase("intake", { practice_year: 2027 });
  const [question] = getQuestions("isee_ordinario", { practice_year: 2027 }, "it").filter(
    (q) => q.id !== "practice_year",
  );
  expect(question?.kind).toBe("number");
  const key = crypto.randomUUID();
  const input = { type: "answer", questionId: question!.id, value: 1 };
  for (let i = 0; i < 2; i++)
    expect((await call(`/c/${token}/turn`, { body: input, key })).status).toBe(200);
  expect(await turns(id, "confirmation")).toHaveLength(1);
});

it("upload: a retry after a lost response stores one document and removes the extra copy", async () => {
  const { id, token } = await seedCase();
  const bytes = await pdf();
  const key = crypto.randomUUID();
  const put = vi.spyOn(storage, "put");
  const first = await call(`/c/${token}/documents`, { body: form(bytes), key });
  expect(first.status).toBe(201);
  const retry = await call(`/c/${token}/documents`, { body: form(bytes), key });
  expect(retry.status).toBe(201);
  expect(CitizenCase.parse(await retry.json()).documents).toHaveLength(1);
  // The retry is answered before the body reaches storage.
  expect(put).toHaveBeenCalledTimes(1);
  const together = crypto.randomUUID();
  const remove = vi.spyOn(storage, "delete");
  const both = await Promise.all(
    [0, 1].map(() => call(`/c/${token}/documents`, { body: form(bytes), key: together })),
  );
  expect(both.map((r) => r.status)).toEqual([201, 201]);
  expect(await db.select().from(documents).where(eq(documents.caseId, id))).toHaveLength(2);
  expect(remove.mock.calls.length).toBe(put.mock.calls.length - 2);
});

it("deleting a document twice with one key answers with the case, not «not found»", async () => {
  const { token } = await seedCase();
  const uploaded = CitizenCase.parse(
    await (await call(`/c/${token}/documents`, { body: form(await pdf()) })).json(),
  );
  const documentId = uploaded.documents[0]!.id;
  const key = crypto.randomUUID();
  const path = `/c/${token}/documents/${documentId}`;
  expect((await call(path, { method: "DELETE", key })).status).toBe(200);
  const retry = await call(path, { method: "DELETE", key });
  expect(retry.status).toBe(200);
  expect(CitizenCase.parse(await retry.json()).documents).toHaveLength(0);
  expect((await call(path, { method: "DELETE" })).status).toBe(404);
});

it("submit: the retry of a sent case returns it; without a key it still refuses", async () => {
  const { id, token } = await seedCase("intake", completeAnswers());
  const key = crypto.randomUUID();
  const body = { contact: { firstName: "Persona", lastName: "Esempio" }, confirmed: true };
  expect((await call(`/c/${token}/submit`, { body, key })).status).toBe(200);
  const retry = await call(`/c/${token}/submit`, { body, key });
  expect(retry.status).toBe(200);
  expect(CitizenCase.parse(await retry.json()).status).toBe("submitted");
  expect((await call(`/c/${token}/submit`, { body })).status).toBe(409);
  const submitted = await db
    .select()
    .from(events)
    .where(and(eq(events.caseId, id), eq(events.type, "case.submitted")));
  expect(submitted).toHaveLength(1);
});

it("operator: a retried integration request is sent once, per operator", async () => {
  const { id } = await seedCase("in_review");
  const version = new Date(
    (await db.select().from(cases).where(eq(cases.id, id)))[0]!.updatedAt,
  ).toISOString();
  const key = crypto.randomUUID();
  const body = {
    expectedUpdatedAt: version,
    checklistItemIds: [],
    message: "Serve la carta d'identità.",
  };
  const first = await call(`/cases/${id}/requests`, { body, key, cookie: operatorToken });
  expect(first.status).toBe(200);
  // The first attempt advanced the version: without the key this retry would be a conflict.
  const retry = await call(`/cases/${id}/requests`, { body, key, cookie: operatorToken });
  expect(retry.status).toBe(200);
  expect(CaseDossier.parse(await retry.json()).status).toBe("needs_citizen");
  expect((await turns(id)).filter((m) => m.role === "operator")).toHaveLength(1);
  const colleague = await call(`/cases/${id}/requests`, { body, key, cookie: colleagueToken });
  expect(colleague.status).toBe(409);
});

it("operator: a retried question to the dossier assistant reuses the saved answer", async () => {
  const { id } = await seedCase("in_review", completeAnswers());
  const key = crypto.randomUUID();
  const body = { question: "Mancano documenti?" };
  const first = DossierAskResult.parse(
    await (await call(`/cases/${id}/ai/ask`, { body, key, cookie: operatorToken })).json(),
  );
  const retry = await call(`/cases/${id}/ai/ask`, { body, key, cookie: operatorToken });
  expect(retry.status).toBe(200);
  expect(DossierAskResult.parse(await retry.json())).toEqual(first);
  expect(calls.task).toBe(1);
  expect(
    await db.select().from(dossierChatTurns).where(eq(dossierChatTurns.caseId, id)),
  ).toHaveLength(1);
  // Another operator's chat is private: the same key is a new question for them.
  expect((await call(`/cases/${id}/ai/ask`, { body, key, cookie: colleagueToken })).status).toBe(
    200,
  );
  expect(
    await db.select().from(dossierChatTurns).where(eq(dossierChatTurns.caseId, id)),
  ).toHaveLength(2);
});

it("keys expire after 24 hours and are purged by maintenance", async () => {
  const { id, token } = await seedCase();
  const key = crypto.randomUUID();
  expect(
    (await call(`/c/${token}/assistant/ask-desk`, { body: { message: "Ciao" }, key })).status,
  ).toBe(201);
  now = new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS + 1000);
  expect(
    (await call(`/c/${token}/assistant/ask-desk`, { body: { message: "Ciao" }, key })).status,
  ).toBe(201);
  expect(await turns(id, "citizen_question")).toHaveLength(2);
  now = new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS + 1000);
  const maintenance = createApp({
    db,
    storage,
    ai,
    clock: () => now,
    cronSecret: "synthetic-cron",
  });
  expect(
    (
      await maintenance.request("/api/cron/maintenance", {
        headers: { Authorization: "Bearer synthetic-cron" },
      })
    ).status,
  ).toBe(200);
  expect(
    await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.caseId, id), eq(idempotencyKeys.key, key))),
  ).toHaveLength(0);
});

it("a full case answers with case_full, not with a generic conflict", async () => {
  const { id, token } = await seedCase();
  await db.insert(documents).values(
    Array.from({ length: MAX_CASE_DOCUMENTS }, (_, n) => ({
      id: `${id}-doc${n}`,
      caseId: id,
      fileName: "ESEMPIO.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      pages: 1,
      storageKey: `${id}/doc${n}`,
      sha256: `hash${n}`,
      uploadedAt: now.toISOString(),
      status: "analyzed" as const,
    })),
  );
  const response = await call(`/c/${token}/documents`, { body: form(await pdf()) });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe("case_full");
});

const versionOf = async (id: string) =>
  new Date((await db.select().from(cases).where(eq(cases.id, id)))[0]!.updatedAt).toISOString();
const later = () => (now = new Date(now.getTime() + 5000));

it("conversation: an old key for «sì» does not swallow a new «sì» after the citizen spoke again", async () => {
  const { id, token } = await seedCase("intake", { practice_year: 2027 });
  const key = crypto.randomUUID();
  // The reply to «sì» is lost; the key stays pending on the phone.
  expect((await call(`/c/${token}/conversation`, { body: { text: "sì" }, key })).status).toBe(200);
  later();
  // An operator message in between is not the citizen answering: the retry is still a retry.
  await db.insert(messages).values({
    id: `${id}-operator`,
    caseId: id,
    role: "operator",
    text: "Messaggio dello sportello",
    createdAt: now.toISOString(),
  });
  later();
  expect((await call(`/c/${token}/conversation`, { body: { text: "sì" }, key })).status).toBe(200);
  expect((await turns(id)).filter((m) => m.role === "citizen")).toHaveLength(1);
  // The citizen answers another question with a tap (another hook, another key)…
  const [question] = getQuestions("isee_ordinario", { practice_year: 2027 }, "it").filter(
    (q) => q.id !== "practice_year",
  );
  later();
  expect(
    (
      await call(`/c/${token}/turn`, {
        body: { type: "answer", questionId: question!.id, value: 1 },
        key: crypto.randomUUID(),
      })
    ).status,
  ).toBe(200);
  // …then says «sì» to the next one: same words, same pending key, a new message.
  later();
  const next = await call(`/c/${token}/conversation`, { body: { text: "sì" }, key });
  expect(next.status).toBe(200);
  const state = ConversationState.parse(await next.json());
  expect(state.turns.filter((t) => t.role === "citizen" && t.text === "sì")).toHaveLength(2);
  expect(calls.converse).toBe(2);
  // The key now remembers the new message: a retry of it is answered, not stored a third time.
  later();
  expect((await call(`/c/${token}/conversation`, { body: { text: "sì" }, key })).status).toBe(200);
  expect((await turns(id)).filter((m) => m.role === "citizen" && m.text === "sì")).toHaveLength(2);
});

it("turn: the same tap after a conversation message is a new answer, a plain retry is not", async () => {
  const { id, token } = await seedCase("intake", { practice_year: 2027 });
  const [question] = getQuestions("isee_ordinario", { practice_year: 2027 }, "it").filter(
    (q) => q.id !== "practice_year",
  );
  const key = crypto.randomUUID();
  const input = { type: "answer", questionId: question!.id, value: 1 };
  expect((await call(`/c/${token}/turn`, { body: input, key })).status).toBe(200);
  later();
  expect((await call(`/c/${token}/turn`, { body: input, key })).status).toBe(200);
  expect(await turns(id, "confirmation")).toHaveLength(1);
  later();
  expect(
    (
      await call(`/c/${token}/conversation`, {
        body: { text: "Siamo in due." },
        key: crypto.randomUUID(),
      })
    ).status,
  ).toBe(200);
  later();
  expect((await call(`/c/${token}/turn`, { body: input, key })).status).toBe(200);
  expect(await turns(id, "confirmation")).toHaveLength(2);
});

it("submit: after an integration request the same contacts with the old key send the case again", async () => {
  const { id, token } = await seedCase("intake", completeAnswers());
  const key = crypto.randomUUID();
  const body = { contact: { firstName: "Persona", lastName: "Esempio" }, confirmed: true };
  expect((await call(`/c/${token}/submit`, { body, key })).status).toBe(200);
  // The response was lost; the desk opens the case and asks for one more document.
  await db.update(cases).set({ status: "in_review" }).where(eq(cases.id, id));
  later();
  const request = await call(`/cases/${id}/requests`, {
    body: { expectedUpdatedAt: await versionOf(id), checklistItemIds: [], message: "Serve altro." },
    cookie: operatorToken,
  });
  expect(request.status).toBe(200);
  later();
  const again = await call(`/c/${token}/submit`, { body, key });
  expect(again.status).toBe(200);
  expect(CitizenCase.parse(await again.json()).status).toBe("submitted");
  const submitted = () =>
    db
      .select()
      .from(events)
      .where(and(eq(events.caseId, id), eq(events.type, "case.submitted")));
  expect(await submitted()).toHaveLength(2);
  // A retry of this second submission is still a retry.
  later();
  expect((await call(`/c/${token}/submit`, { body, key })).status).toBe(200);
  expect(await submitted()).toHaveLength(2);
});

it("operator: the retry of a request after the dossier refreshed is the same request", async () => {
  const { id } = await seedCase("in_review");
  const key = crypto.randomUUID();
  const payload = { checklistItemIds: [], message: "Serve la carta d'identità." };
  const first = await call(`/cases/${id}/requests`, {
    body: { ...payload, expectedUpdatedAt: await versionOf(id) },
    key,
    cookie: operatorToken,
  });
  expect(first.status).toBe(200);
  // The response was lost; a document finished its analysis and the dossier polled again.
  later();
  await db.update(cases).set({ updatedAt: now.toISOString() }).where(eq(cases.id, id));
  const refreshed = await call(`/cases/${id}/requests`, {
    body: { ...payload, expectedUpdatedAt: await versionOf(id) },
    key,
    cookie: operatorToken,
  });
  expect(refreshed.status).toBe(200);
  const operatorMessages = async () =>
    (await turns(id)).filter((m) => m.role === "operator").length;
  expect(await operatorMessages()).toBe(1);
  // The citizen answered and the desk reopened the case: the request is over. The same items and
  // words with the old key are a new request, still bound to the version the operator saw.
  const stale = await versionOf(id);
  later();
  await db
    .update(cases)
    .set({ status: "in_review", updatedAt: now.toISOString() })
    .where(eq(cases.id, id));
  const outdated = await call(`/cases/${id}/requests`, {
    body: { ...payload, expectedUpdatedAt: stale },
    key,
    cookie: operatorToken,
  });
  expect(outdated.status).toBe(409);
  expect(await operatorMessages()).toBe(1);
  const renewed = await call(`/cases/${id}/requests`, {
    body: { ...payload, expectedUpdatedAt: await versionOf(id) },
    key,
    cookie: operatorToken,
  });
  expect(renewed.status).toBe(200);
  expect(CaseDossier.parse(await renewed.json()).status).toBe("needs_citizen");
  expect(await operatorMessages()).toBe(2);
});

it("upload: another file with a used key is refused before analysis and storage", async () => {
  const { id, token } = await seedCase("intake", completeAnswers());
  const key = crypto.randomUUID();
  const bytes = await pdf();
  expect((await call(`/c/${token}/documents`, { body: form(bytes), key })).status).toBe(201);
  const put = vi.spyOn(storage, "put");
  const analyze = vi.spyOn(ai, "analyze");
  const other = await PDFDocument.create();
  other.addPage();
  other.addPage();
  const changed = await call(`/c/${token}/documents`, { body: form(await other.save()), key });
  expect(changed.status).toBe(409);
  expect((await changed.json()).error.code).toBe("conflict");
  expect(put).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
  expect(await db.select().from(documents).where(eq(documents.caseId, id))).toHaveLength(1);
  // The same file is still answered as a retry, even once the case has been sent.
  expect(
    (
      await call(`/c/${token}/submit`, {
        body: { contact: { firstName: "Persona", lastName: "Esempio" }, confirmed: true },
      })
    ).status,
  ).toBe(200);
  const sameFile = await call(`/c/${token}/documents`, { body: form(bytes), key });
  expect(sameFile.status).toBe(201);
  expect(CitizenCase.parse(await sameFile.json()).documents).toHaveLength(1);
  expect(put).not.toHaveBeenCalled();
  analyze.mockRestore();
});

it("the fingerprint is keyed with the server secret, not a plain hash of what was written", async () => {
  secret = "synthetic-idempotency-secret-one";
  const { id, token } = await seedCase();
  const key = crypto.randomUUID();
  expect(
    (await call(`/c/${token}/conversation`, { body: { text: "3331234567" }, key })).status,
  ).toBe(200);
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.caseId, id), eq(idempotencyKeys.key, key)));
  const plain = createHash("sha256")
    .update("conversation")
    .update("\0")
    .update(JSON.stringify({ text: "3331234567" }))
    .digest("base64url");
  expect(row!.fingerprint).not.toBe(plain);
  expect(row!.fingerprint).toBe(fingerprint(secret, "conversation", { text: "3331234567" }));
  expect(row!.fingerprint).not.toBe(
    fingerprint("synthetic-idempotency-secret-two", "conversation", { text: "3331234567" }),
  );
  // Same secret, same words: the retry is still recognised.
  expect(
    (await call(`/c/${token}/conversation`, { body: { text: "3331234567" }, key })).status,
  ).toBe(200);
  expect((await turns(id)).filter((m) => m.role === "citizen")).toHaveLength(1);
});
