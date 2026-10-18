import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDatabase,
  organizations,
  offices,
  cases,
  events,
  messages,
  settings,
  type Database,
} from "@avanti/db";
import { ConversationState, LANGUAGES, type Language } from "@avanti/contracts";
import { getQuestions, t } from "@avanti/core";
import { createApp } from "./app";
import { AiIntelligence } from "./ai";
import { MemoryStorage } from "./storage";
import { validateProposals } from "./conversation-state";
import { dossierView } from "./dossier";
import { eraseCase } from "./case-erasure";
import type { ConverseOutput } from "@avanti/ai";

let db: Database;
let close: () => Promise<void>;
const now = new Date("2027-01-05T10:00:00Z");
const origin = "http://localhost:3400";
let generated: ConverseOutput = { proposals: [], reply: "", intent: "answer" };
const local = new AiIntelligence();
const appOptions = () => ({
  db,
  storage: new MemoryStorage(),
  clock: () => now,
  publicUrl: origin,
});
const app = () =>
  createApp({
    ...appOptions(),
    ai: {
      intake: local.intake.bind(local),
      analyze: local.analyze.bind(local),
      translate: local.translate.bind(local),
      converse: async () => ({ ...generated, engine: "ai" as const }),
    },
  });
async function request(path: string, input?: unknown, target = app()) {
  return target.request(`/api${path}`, {
    method: input === undefined ? "GET" : "POST",
    headers: { origin, "content-type": "application/json" },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}
async function start(
  language: Language = "it",
  target = app(),
  practice = true,
  slug = "conversation-test",
) {
  const response = await request(
    "/intake",
    {
      officeSlug: slug,
      language,
      privacyAccepted: true,
      ...(practice ? { practiceId: "isee_ordinario" } : {}),
    },
    target,
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { token: string; case: { id: string } };
}
async function row(id: string) {
  return (await db.select().from(cases).where(eq(cases.id, id)))[0]!;
}
async function converse(token: string, text: string, target = app()) {
  const res = await request(`/c/${token}/conversation`, { text }, target);
  expect(res.status).toBe(200);
  return ConversationState.parse(await res.json());
}
beforeAll(async () => {
  const database = await createDatabase({ memory: true });
  db = database.db;
  close = database.close;
  await db
    .insert(organizations)
    .values({ id: "conversation-org", name: "CAF Esempio", kind: "caf" });
  await db.insert(offices).values({
    id: "conversation-office",
    organizationId: "conversation-org",
    slug: "conversation-test",
    name: "Sportello",
    address: "Via Esempio",
    city: "Milano",
  });
  await db
    .insert(organizations)
    .values({ id: "conversation-other-org", name: "Altro CAF", kind: "caf" });
  await db.insert(offices).values({
    id: "conversation-other-office",
    organizationId: "conversation-other-org",
    slug: "conversation-other",
    name: "Altro sportello",
    address: "Via Esempio",
    city: "Milano",
  });
}, 30000);
afterAll(async () => close?.());

it("keeps direct conversation text local when the CAF disables citizen AI", async () => {
  const provider = vi.fn(async () => ({ ...generated, engine: "ai" as const }));
  const target = createApp({
    ...appOptions(),
    ai: {
      intake: local.intake.bind(local),
      analyze: local.analyze.bind(local),
      translate: local.translate.bind(local),
      converse: provider,
    },
  });
  await db.insert(settings).values({
    organizationId: "conversation-org",
    aiCitizenAssistant: false,
  });
  try {
    const { token } = await start("it", target);
    const state = await converse(token, "Siamo in quattro", target);
    expect(provider).not.toHaveBeenCalled();
    expect(state.engine).toBe("heuristic");
    expect(state.proposals.find((p) => p.questionId === "household_count")?.value).toBe(4);
    expect(state.ask).toHaveLength(1);
  } finally {
    await db.delete(settings).where(eq(settings.organizationId, "conversation-org"));
  }
});

it.each([
  { text: "Mio marito mi sta picchiando", violence: true },
  { text: "Non respiro", violence: false },
])(
  "handles conversation danger locally without storing the sensitive story: $text",
  async ({ text, violence }) => {
    const provider = vi.fn(async () => ({ ...generated, engine: "ai" as const }));
    const target = createApp({
      ...appOptions(),
      ai: {
        intake: local.intake.bind(local),
        analyze: local.analyze.bind(local),
        translate: local.translate.bind(local),
        converse: provider,
      },
    });
    const { token, case: item } = await start("it", target);
    const state = await converse(token, text, target);
    expect(provider).not.toHaveBeenCalled();
    expect(state.engine).toBe("heuristic");
    expect(state.proposals).toEqual([]);
    expect(state.turns.at(-1)?.text).toContain("112");
    if (violence) expect(state.turns.at(-1)?.text).toContain("1522");
    expect(
      JSON.stringify(await db.select().from(messages).where(eq(messages.caseId, item.id))),
    ).not.toContain(text);
  },
);

it("keeps initial intake answers as proposals and confirms corrected values through the same domain path", async () => {
  const { token, case: item } = await start("it", app(), false);
  const res = await request(`/c/${token}/turn`, {
    type: "text",
    text: "Devo fare ISEE, siamo in quattro e ho un conto Fineco",
  });
  expect(res.status).toBe(200);
  const initial = await row(item.id);
  expect(initial.practiceId).toBe("isee_ordinario");
  expect(initial.answers).toEqual({});
  const proposal = initial.conversationProposals.find((p) => p.questionId === "household_count")!;
  expect(proposal.value).toBe(4);
  const confirmed = await request(`/c/${token}/conversation/confirm`, {
    accept: [{ proposalId: proposal.id, value: 3 }],
    reject: [],
  });
  expect(confirmed.status).toBe(200);
  expect((await row(item.id)).answers.household_count).toBe(3);
  expect((await row(item.id)).confirmedAnswers).toContain("household_count");
  expect(
    ConversationState.parse(await confirmed.json()).turns.some(
      (t) => t.kind === "confirmation" && t.text === "3",
    ),
  ).toBe(true);
});

it("drops invalid, hidden and answered questions; downgrades ungrounded evidence; supports partial confirmation and rejection", async () => {
  const { token, case: item } = await start();
  const questions = getQuestions("isee_ordinario", {}, "it");
  const boolean = questions.find((q) => q.kind === "yes_no")!;
  generated = {
    proposals: [
      { questionId: "household_count", value: 4, confidence: 0.99, evidence: "SIAMO  IN QUATTRO" },
      { questionId: boolean.id, value: true, confidence: 0.99, evidence: "inventato" },
      { questionId: "household_count", value: 999, confidence: 1, evidence: "quattro" },
      { questionId: "fake", value: true, confidence: 1, evidence: "quattro" },
      { questionId: "account_owner_0", value: "fake", confidence: 1, evidence: "quattro" },
    ],
    reply: "Ho capito. Quante persone?",
    intent: "answer",
  };
  let state = await converse(token, "Siamo in quattro");
  expect(state.proposals).toHaveLength(2);
  expect(state.proposals.find((p) => p.questionId === boolean.id)!.confidence).toBe(0.3);
  const count = state.proposals.find((p) => p.questionId === "household_count")!;
  const res = await request(`/c/${token}/conversation/confirm`, {
    accept: [{ proposalId: count.id }],
    reject: [],
  });
  state = ConversationState.parse(await res.json());
  expect(state.proposals).toHaveLength(1);
  const denied = await request(`/c/${token}/conversation/confirm`, {
    accept: [{ proposalId: count.id }],
    reject: [],
  });
  expect(denied.status).toBe(409);
  const reject = await request(`/c/${token}/conversation/confirm`, {
    accept: [],
    reject: [state.proposals[0]!.id],
  });
  expect(ConversationState.parse(await reject.json()).proposals).toEqual([]);
  expect((await row(item.id)).answers[boolean.id]).toBeUndefined();
});

it("rolls back all accepted proposals on invalid corrections and rejects duplicate IDs", async () => {
  const { token, case: item } = await start();
  generated = {
    proposals: [{ questionId: "household_count", value: 4, confidence: 0.9, evidence: "4" }],
    reply: "Quante persone?",
    intent: "answer",
  };
  const state = await converse(token, "4");
  const id = state.proposals[0]!.id;
  expect(
    (
      await request(`/c/${token}/conversation/confirm`, {
        accept: [{ proposalId: id, value: 1000 }],
        reject: [],
      })
    ).status,
  ).toBe(400);
  expect((await row(item.id)).answers).toEqual({});
  expect(
    (
      await request(`/c/${token}/conversation/confirm`, {
        accept: [{ proposalId: id }],
        reject: [id],
      })
    ).status,
  ).toBe(400);
});

it("retains confirmed members, rejects invented names and needs explicit edit before proposing a correction", async () => {
  const { token, case: item } = await start();
  await request(`/c/${token}/turn`, { type: "answer", questionId: "household_count", value: 1 });
  const current = await row(item.id);
  const candidates = [
    {
      questionId: "members",
      value: [{ role: "richiedente" as const, firstName: "Inventato" }],
      confidence: 1,
      evidence: "vivo solo",
    },
  ];
  expect(validateProposals(current, candidates, ["vivo solo"], now)).toEqual([]);
  await request(`/c/${token}/turn`, {
    type: "answer",
    questionId: "members",
    value: [{ role: "richiedente", firstName: "Ada" }],
  });
  generated = {
    proposals: [{ questionId: "household_count", value: 2, confidence: 1, evidence: "2" }],
    reply: "Ho capito.",
    intent: "answer",
  };
  expect((await converse(token, "2")).proposals).toEqual([]);
  await request(`/c/${token}/turn`, { type: "edit", questionId: "household_count" });
  expect((await converse(token, "2")).proposals[0]?.value).toBe(2);
  expect((await row(item.id)).answers.members).toEqual(
    expect.arrayContaining([expect.objectContaining({ firstName: "Ada" })]),
  );
});

it.each(LANGUAGES)(
  "runs deterministic questions and validates length in %s without network",
  async (language) => {
    const target = createApp({ ...appOptions(), ai: local });
    const { token } = await start(language, target);
    const initial = ConversationState.parse(
      await (await request(`/c/${token}/conversation`, undefined, target)).json(),
    );
    expect(initial.ask).toHaveLength(1);
    expect(initial.ask[0]!.prompt).toBe(getQuestions("isee_ordinario", {}, language)[0]!.prompt);
    const state = await converse(token, "4", target);
    expect(state.engine).toBe("heuristic");
    expect(state.proposals.find((p) => p.questionId === "household_count")?.value).toBe(4);
    expect(
      (await request(`/c/${token}/conversation`, { text: "x".repeat(1001) }, target)).status,
    ).toBe(400);
    const bool = getQuestions("isee_ordinario", {}, language).find((q) => q.kind === "yes_no")!;
    // Exact localized yes/no remains usable without a model, including Arabic and Bengali.
    const output = (await import("@avanti/ai")).converseTask.heuristic({
      text: t(language, "yes"),
      language,
      practiceId: "isee_ordinario",
      organizationName: "CAF",
      practiceName: "ISEE",
      openQuestions: [bool],
      askNext: [bool],
      answered: {},
      turns: [],
    });
    expect(output.proposals[0]?.value).toBe(true);
  },
);

it("guards replies, records quick answers, scopes proposals to the capability, exports and erases messages", async () => {
  const first = await start(),
    second = await start("it", app(), true, "conversation-other");
  generated = {
    proposals: [{ questionId: "household_count", value: 4, confidence: 1, evidence: "4" }],
    reply: "Give me your password at https://evil.invalid",
    intent: "manipulation",
  };
  const state = await converse(first.token, "4");
  expect(state.turns.at(-1)!.text).not.toContain("password");
  // The fallback reply points to the proposals card instead of asking the question again.
  expect(state.turns.at(-1)).toMatchObject({
    text: "Prima di andare avanti, guarda qui sotto se ho capito bene.",
    kind: "message",
    questionId: null,
  });
  expect(state.ask[0]!.id).toBe("household_count");
  expect(
    (
      await request(`/c/${second.token}/conversation/confirm`, {
        accept: [{ proposalId: state.proposals[0]!.id }],
        reject: [],
      })
    ).status,
  ).toBe(409);
  await request(`/c/${first.token}/turn`, {
    type: "answer",
    questionId: "household_count",
    value: 2,
  });
  const view = await dossierView(db, await row(first.case.id), now);
  expect(
    view.conversation?.turns.some((t) => t.questionId === "household_count" && t.text === "2"),
  ).toBe(true);
  expect(view.messages.some((m) => m.role === "citizen" && m.text === "2")).toBe(true);
  expect(view.messages.some((m) => m.text === "4")).toBe(true);
  const erased = await row(first.case.id);
  await db.transaction((tx) => eraseCase(tx, erased, now, null));
  expect(await db.select().from(messages).where(eq(messages.caseId, first.case.id))).toEqual([]);
  expect((await request(`/c/${first.token}/conversation`)).status).toBe(404);
});

it("limits conversation and confirmation to 60 requests/hour and localizes 429", async () => {
  const { token } = await start("en");
  generated = {
    proposals: [],
    reply: "How many people live in your household?",
    intent: "question",
  };
  const target = app();
  for (let i = 0; i < 60; i++)
    expect(
      (await request(`/c/${token}/conversation`, { text: "I do not know" }, target)).status,
    ).toBe(200);
  const response = await request(
    `/c/${token}/conversation/confirm`,
    { accept: [], reject: [] },
    target,
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("3600");
  expect(((await response.json()) as { error: { message: string } }).error.message).toContain(
    "request limit",
  );
});

it("rejects concurrent stale AI work and changes after submission", async () => {
  const { token, case: item } = await start();
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  const target = createApp({
    ...appOptions(),
    ai: {
      intake: local.intake.bind(local),
      analyze: local.analyze.bind(local),
      translate: local.translate.bind(local),
      converse: async () => {
        started!();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return {
          proposals: [],
          reply: "Quante persone?",
          intent: "question" as const,
          engine: "ai" as const,
        };
      },
    },
  });
  const pending = request(`/c/${token}/conversation`, { text: "ciao" }, target);
  await waiting;
  await request(
    `/c/${token}/turn`,
    { type: "answer", questionId: "household_count", value: 2 },
    target,
  );
  release!();
  expect((await pending).status).toBe(409);
  await db.update(cases).set({ status: "submitted" }).where(eq(cases.id, item.id));
  expect(
    (await request(`/c/${token}/conversation/confirm`, { accept: [], reject: [] })).status,
  ).toBe(409);
});

it("applies retention to pending proposals and dialogue through the maintenance endpoint", async () => {
  const { token, case: item } = await start();
  generated = {
    proposals: [{ questionId: "household_count", value: 4, confidence: 0.9, evidence: "4" }],
    reply: "Quante persone?",
    intent: "answer",
  };
  await converse(token, "4");
  expect((await row(item.id)).conversationProposals).toHaveLength(1);
  await db
    .update(cases)
    .set({ expiresAt: new Date(now.getTime() - 200 * 86400000).toISOString() })
    .where(eq(cases.id, item.id));
  const target = createApp({ ...appOptions(), cronSecret: "synthetic-cron-secret" });
  const response = await target.request("/api/cron/maintenance", {
    headers: { Authorization: "Bearer synthetic-cron-secret" },
  });
  expect(response.status).toBe(200);
  expect(((await response.json()) as { deletedCases: number }).deletedCases).toBe(1);
  expect(await db.select().from(cases).where(eq(cases.id, item.id))).toEqual([]);
  expect(await db.select().from(messages).where(eq(messages.caseId, item.id))).toEqual([]);
});

it("tags the question only on replies that ask it, and asks again after a language switch", async () => {
  const { token } = await start();
  const target = app();
  const prompt = (language: Language) =>
    getQuestions("isee_ordinario", {}, language).find((q) => q.id === "household_count")!.prompt;
  // An off-topic reply need not restate the question: the card under it keeps its own.
  generated = { proposals: [], reply: "Parliamo della tua pratica.", intent: "off_topic" };
  let state = await converse(token, "Che tempo fa a Milano?", target);
  expect(state.turns.at(-1)).toMatchObject({ kind: "message", questionId: null });
  generated = { proposals: [], reply: "Quante persone vivono con te?", intent: "question" };
  state = await converse(token, "Cosa vuol dire nucleo?", target);
  expect(state.turns.at(-1)).toMatchObject({ kind: "question", questionId: "household_count" });
  // The bubble asking it is in Italian: switching to English asks again in English.
  const switchTo = (language: Language) =>
    target.request(`/api/c/${token}/language`, {
      method: "PUT",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ language }),
    });
  expect((await switchTo("en")).status).toBe(200);
  state = ConversationState.parse(await (await request(`/c/${token}/conversation`)).json());
  expect(state.turns.at(-1)).toMatchObject({
    role: "assistant",
    text: prompt("en"),
    kind: "question",
    questionId: "household_count",
  });
  const turns = state.turns.length;
  expect((await switchTo("en")).status).toBe(200);
  state = ConversationState.parse(await (await request(`/c/${token}/conversation`)).json());
  expect(state.turns).toHaveLength(turns);
  // Back and forth rewrites the question it asked again instead of stacking one per switch,
  // and the model's own reply above it stays as it was.
  for (const language of ["it", "en", "it", "en"] as const) {
    expect((await switchTo(language)).status).toBe(200);
    state = ConversationState.parse(await (await request(`/c/${token}/conversation`)).json());
    expect(state.turns).toHaveLength(turns);
    expect(state.turns.at(-1)).toMatchObject({
      text: prompt(language),
      questionId: "household_count",
    });
    expect(state.turns.at(-2)).toMatchObject({ text: "Quante persone vivono con te?" });
  }
});

it("limits language switches per link and audits only real changes", async () => {
  const { token, case: created } = await start();
  const target = app();
  const switchTo = (language: Language) =>
    target.request(`/api/c/${token}/language`, {
      method: "PUT",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ language }),
    });
  const audited = async () =>
    (
      await db.select({ type: events.type }).from(events).where(eq(events.caseId, created.id))
    ).filter((e) => e.type === "language.updated").length;
  // The language already in use: nothing written.
  expect((await switchTo("it")).status).toBe(200);
  expect(await audited()).toBe(0);
  for (let i = 0; i < 9; i++) expect((await switchTo(i % 2 ? "it" : "en")).status).toBe(200);
  expect(await audited()).toBe(9);
  const limited = await switchTo("fr");
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(await audited()).toBe(9);
});

it("falls back to the deterministic reply when every proposal of the model is refused", async () => {
  const { token } = await start();
  generated = {
    proposals: [{ questionId: "household_count", value: -3, confidence: 1, evidence: "tre" }],
    reply: "Ho capito: siete in tre. Controlla qui sotto e conferma.",
    intent: "answer",
  };
  const state = await converse(token, "Siamo in tre");
  expect(state.proposals).toEqual([]);
  expect(state.turns.at(-1)).toMatchObject({
    text: getQuestions("isee_ordinario", {}, "it").find((q) => q.id === "household_count")!.prompt,
    kind: "question",
    questionId: "household_count",
  });
});

it("with a card still waiting, a message with nothing new points to it instead of asking", async () => {
  const target = createApp({
    ...appOptions(),
    ai: {
      intake: local.intake.bind(local),
      analyze: local.analyze.bind(local),
      translate: local.translate.bind(local),
    },
  });
  const { token } = await start("it", target);
  let state = await converse(token, "Siamo in quattro", target);
  expect(state.proposals).toHaveLength(1);
  state = await converse(token, "non lo so", target);
  expect(state.proposals).toHaveLength(1);
  expect(state.turns.at(-1)).toMatchObject({
    text: t("it", "checkProposals"),
    kind: "message",
    questionId: null,
  });
});
