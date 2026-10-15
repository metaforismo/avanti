import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ApiError,
  CitizenCase,
  IntakeTurnResponse,
  LANGUAGES,
  StartIntakeResponse,
} from "@avanti/contracts";
import { cases, createDatabase, offices, organizations, type Database } from "@avanti/db";
import { t } from "@avanti/core";
import { eq } from "drizzle-orm";
import { citizenView } from "./dossier";
import { createApp } from "./app";
import { GatewayIntelligence } from "./ai";
import { MemoryStorage } from "./storage";
import { applyTurn } from "./citizen-turn";
import type { CaseRow } from "./dossier";

const now = new Date("2027-01-05T10:00:00Z");
describe("intake recovery and household minimum over HTTP", () => {
  let db: Database;
  let close: () => Promise<void>;
  beforeAll(async () => {
    const resource = await createDatabase({ memory: true });
    db = resource.db;
    close = resource.close;
    await db
      .insert(organizations)
      .values({ id: "org-intake-fixes", name: "CAF Esempio", kind: "caf" });
    await db.insert(offices).values({
      id: "office-intake-fixes",
      organizationId: "org-intake-fixes",
      slug: "intake-fixes",
      name: "Sede Esempio",
      address: "Via Esempio",
      city: "Milano",
    });
  }, 20_000);
  afterAll(async () => close?.());
  function harness(ai = new GatewayIntelligence()) {
    const records: unknown[] = [];
    const app = createApp({
      db,
      ai,
      storage: new MemoryStorage(),
      clock: () => new Date(now),
      logger: (record) => records.push(record),
      errorLogger: (record) => records.push(record),
    });
    const post = (path: string, input: unknown) =>
      app.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3400" },
        body: JSON.stringify(input),
      });
    const start = async (language = "it", practiceId?: string) =>
      StartIntakeResponse.parse(
        await (
          await post("/api/intake", {
            officeSlug: "intake-fixes",
            language,
            privacyAccepted: true,
            ...(practiceId ? { practiceId } : {}),
          })
        ).json(),
      );
    const turn = (token: string, input: unknown) => post(`/api/c/${token}/turn`, input);
    const view = async (token: string) =>
      CitizenCase.parse(await (await app.request(`/api/c/${token}`)).json());
    return { post, start, turn, view, records };
  }
  it.each(LANGUAGES)(
    "saves unavailable free text and a localized reply in %s, then accepts another practice",
    async (language) => {
      const { start, turn, view, records } = harness();
      const intake = await start(language);
      const text = "RED";
      const response = await turn(intake.token, { type: "text", text });
      expect(response.status).toBe(200);
      const unavailable = IntakeTurnResponse.parse(await response.json());
      expect(unavailable.unavailablePractice).toBe("red");
      expect(unavailable.practice).toBeNull();
      expect(unavailable.step).toBe("need");
      expect(unavailable.answers).toEqual({});
      expect(unavailable.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "citizen", text }),
          expect.objectContaining({ role: "assistant", text: t(language, "unavailablePractice") }),
        ]),
      );
      const reloaded = await view(intake.token);
      expect(reloaded.messages).toEqual(unavailable.messages);
      const chosen = IntakeTurnResponse.parse(
        await (
          await turn(intake.token, { type: "choose_practice", practiceId: "isee_ordinario" })
        ).json(),
      );
      expect(chosen.unavailablePractice).toBeNull();
      expect(chosen.practice?.id).toBe("isee_ordinario");
      expect(JSON.stringify(records)).not.toContain('"RED"');
    },
  );
  it.each(["red", "isee_universitario", "naspi"])(
    "explicit start and choice of %s use the dedicated error and preserve the case",
    async (practiceId) => {
      const { post, start, turn, view } = harness();
      const rejected = await post("/api/intake", {
        officeSlug: "intake-fixes",
        practiceId,
        privacyAccepted: true,
      });
      expect(rejected.status).toBe(400);
      expect(ApiError.parse(await rejected.json()).error.code).toBe("practice_unavailable");
      const intake = await start("en");
      const response = await turn(intake.token, { type: "choose_practice", practiceId });
      expect(response.status).toBe(400);
      expect(ApiError.parse(await response.json()).error.code).toBe("practice_unavailable");
      expect(await view(intake.token)).toEqual(intake.case);
    },
  );
  it("the reproduced university story advances with spouse facts and an operator warning", async () => {
    const { post, start, turn, view } = harness();
    const intake = await start();
    const response = await turn(intake.token, {
      type: "text",
      text: "Devo fare l'ISEE per l'università, vivo con mia moglie",
    });
    expect(response.status).toBe(200);
    const result = IntakeTurnResponse.parse(await response.json());
    expect(result.unavailablePractice).toBeNull();
    expect(result.practice?.id).toBe("isee_ordinario");
    expect(result.answers).toEqual({});
    expect(result.conversation?.proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: "university", value: true }),
        expect.objectContaining({ questionId: "household_count", value: 2 }),
      ]),
    );
    await post(`/api/c/${intake.token}/conversation/confirm`, {
      accept: result.conversation!.proposals.map((p) => ({ proposalId: p.id })),
      reject: [],
    });
    await turn(intake.token, {
      type: "answer",
      questionId: "members",
      value: [
        { role: "richiedente", firstName: "Ada" },
        { role: "coniuge", firstName: "Eve" },
      ],
    });
    await turn(intake.token, { type: "edit", questionId: "household_count" });
    expect((await view(intake.token)).nextQuestion).toMatchObject({
      id: "household_count",
      min: 2,
    });
    const [stored] = await db.select().from(cases).where(eq(cases.id, result.id));
    const operator = await citizenView(db, stored!, now, "it", true);
    expect(operator.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "practice.university_review" })]),
    );
  });
  it("does not erase a chosen practice on an unavailable AI classification", async () => {
    const ai = new GatewayIntelligence();
    ai.intake = async () => ({
      practiceId: "red",
      confidence: 1,
      answers: { household_count: 1 },
      reply: "Ignored",
      engine: "ai",
    });
    const { start, turn } = harness(ai);
    const intake = await start("uk", "isee_ordinario");
    const result = IntakeTurnResponse.parse(
      await (await turn(intake.token, { type: "text", text: "RED" })).json(),
    );
    expect(result.unavailablePractice).toBe("red");
    expect(result.practice?.id).toBe("isee_ordinario");
    expect(result.answers).toEqual({});
    expect(result.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "assistant", text: t("uk", "unavailablePractice") }),
      ]),
    );
  });
  it.each(LANGUAGES)(
    "validates the known household minimum in %s and permits editing the member list",
    async (language) => {
      const ai = new GatewayIntelligence();
      ai.intake = async () => ({
        practiceId: "isee_ordinario",
        confidence: 1,
        answers: { household_roles: ["richiedente", "coniuge"], household_count: 2 },
        reply: "",
        engine: "ai",
      });
      const { start, turn, view } = harness(ai);
      const intake = await start(language);
      await turn(intake.token, { type: "text", text: "Esempio" });
      await turn(intake.token, { type: "answer", questionId: "household_count", value: 2 });
      await turn(intake.token, {
        type: "answer",
        questionId: "members",
        value: [
          { role: "richiedente", firstName: "Esempio" },
          { role: "coniuge", firstName: "Coniuge" },
        ],
      });
      await turn(intake.token, { type: "edit", questionId: "household_count" });
      const rejected = await turn(intake.token, {
        type: "answer",
        questionId: "household_count",
        value: 1,
      });
      expect(rejected.status).toBe(400);
      expect(ApiError.parse(await rejected.json()).error.message).toBe(
        t(language, "householdSpouseMinimum"),
      );
      const accepted = await turn(intake.token, {
        type: "answer",
        questionId: "household_count",
        value: 2,
      });
      expect(accepted.status).toBe(200);
      await turn(intake.token, {
        type: "answer",
        questionId: "members",
        value: [
          { role: "richiedente", firstName: "Esempio" },
          { role: "coniuge", firstName: "Coniuge" },
        ],
      });
      await turn(intake.token, { type: "edit", questionId: "members" });
      const edited = await turn(intake.token, {
        type: "answer",
        questionId: "members",
        value: [{ role: "richiedente", firstName: "Esempio" }],
      });
      expect(edited.status).toBe(200);
      await turn(intake.token, { type: "edit", questionId: "household_count" });
      expect((await view(intake.token)).nextQuestion).toMatchObject({
        id: "household_count",
        min: 1,
      });
      expect(
        (await turn(intake.token, { type: "answer", questionId: "household_count", value: 1 }))
          .status,
      ).toBe(200);
    },
  );
  it("retains the original operator context while foreign assets remain proposals", async () => {
    const { start, turn } = harness();
    const intake = await start();
    const result = IntakeTurnResponse.parse(
      await (
        await turn(intake.token, {
          type: "text",
          text: "ISEE vivo con mia madre e mio fratello, ho un conto all'estero in Monobank e un mutuo sulla casa",
        })
      ).json(),
    );
    expect(result.answers).toEqual({});
    expect(result.conversation?.proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: "household_count", value: 3 }),
        expect.objectContaining({ questionId: "foreign_assets", value: true }),
      ]),
    );
    const [stored] = await db.select().from(cases).where(eq(cases.id, result.id));
    const operator = await citizenView(db, stored!, now, "it", true);
    expect(operator.messages).toContainEqual(
      expect.objectContaining({
        role: "citizen",
        text: expect.stringContaining("Monobank e un mutuo"),
      }),
    );
    expect(operator.answers).toEqual({});
  });
});

it("low confidence and absent proposals stay recoverable without starting an unavailable practice", () => {
  const current = { practiceId: null, language: "it", answers: {} } as CaseRow;
  expect(applyTurn(current, { type: "text", text: "?" }, null, now)).toMatchObject({
    practiceId: null,
    unavailablePractice: null,
  });
  expect(
    applyTurn(
      current,
      { type: "text", text: "?" },
      { practiceId: "red", confidence: 0.4, answers: {}, reply: "", engine: "ai" },
      now,
    ),
  ).toMatchObject({ practiceId: null, unavailablePractice: null });
});
