import { describe, expect, it } from "vitest";
import { AnswerValue, CitizenContact, IntakeTurn, MemberInput } from "@avanti/contracts";
import {
  applyAnswer,
  buildChecklist,
  buildHousehold,
  calendarDate,
  calendarYear,
  evaluateDossier,
  getPractice,
  ownerMatches,
} from "./index";
import type { DossierInput } from "./evaluation";

const now = new Date("2027-01-05T10:00:00Z");
it.each(Array.from({ length: 20 }, (_, i) => i + 1))(
  "household: %i members retain unique identities and checklist ownership",
  (count) => {
    const members = Array.from({ length: count }, (_, i) => ({
      id: `member-${i}`,
      role: i === 0 ? "richiedente" : "figlio",
      firstName: i % 2 === 0 ? "محمد علي" : "রহিম উদাহরণ",
      birthYear: 2000 + i,
    }));
    const answers = applyAnswer(
      "isee_ordinario",
      { household_count: count },
      "members",
      members,
      "it",
      now,
    );
    const household = buildHousehold(answers);
    expect(household).toHaveLength(count);
    expect(new Set(household.map((m) => m.id)).size).toBe(count);
    const checklist = buildChecklist("isee_ordinario", answers, household, "it");
    expect(checklist.filter((i) => i.requirementId === "identity")).toHaveLength(count);
    expect(
      checklist.every((item) => !item.memberId || household.some((m) => m.id === item.memberId)),
    ).toBe(true);
  },
);
it.each([0, 21, 1.5, Infinity, NaN])("household: rejects count %s", (value) => {
  expect(() => applyAnswer("isee_ordinario", {}, "household_count", value, "it", now)).toThrow();
});
it.each(["محمد علي", "রহিম উদাহরণ", "  MARIA   Rossi  ", "Élisa", "Persona 🙂"])(
  "text: preserves Unicode and name casing: %s",
  (name) => {
    expect(MemberInput.parse({ role: "richiedente", firstName: name }).firstName).toBe(name.trim());
    expect(IntakeTurn.parse({ type: "text", text: `  ${name} 🧑🏽‍💻  ` })).toMatchObject({
      text: `${name} 🧑🏽‍💻`.trim(),
    });
  },
);
it("names: ignores spaces, case and token order without losing Arabic/Bengali marks", () => {
  expect(
    ownerMatches("rossi MARIA", {
      id: "a",
      role: "richiedente",
      firstName: " Maria ",
      lastName: "  ROSSI  ",
    }),
  ).toBe(true);
  expect(
    ownerMatches("علي محمد", { id: "a", role: "richiedente", firstName: "محمد", lastName: "علي" }),
  ).toBe(true);
  expect(
    ownerMatches("রহিম উদাহরণ", {
      id: "a",
      role: "richiedente",
      firstName: "রহিম",
      lastName: "উদাহরণ",
    }),
  ).toBe(true);
});
it("text: bounds long input while allowing multiline notes and emoji", () => {
  expect(IntakeTurn.safeParse({ type: "text", text: "🙂".repeat(1000) }).success).toBe(true);
  expect(IntakeTurn.safeParse({ type: "text", text: "x".repeat(2001) }).success).toBe(false);
  expect(MemberInput.safeParse({ role: "richiedente", firstName: "x".repeat(81) }).success).toBe(
    false,
  );
  expect(AnswerValue.safeParse("Prima riga\nSeconda riga\t🙂").success).toBe(true);
});
it.each(["\u0000", "\u001b", "\u0085", "\u202e", "\u2066"])(
  "text: rejects unsafe controls U+%s before persistence",
  (control) => {
    expect(IntakeTurn.safeParse({ type: "text", text: `Ciao${control}` }).success).toBe(false);
    expect(
      MemberInput.safeParse({ role: "richiedente", firstName: `Persona${control}` }).success,
    ).toBe(false);
    expect(
      CitizenContact.safeParse({ firstName: `Persona${control}`, lastName: "Esempio" }).success,
    ).toBe(false);
  },
);

describe("Rome calendar and document deadlines", () => {
  it("keeps the catalog reference year explicit across midnight and guards unsupported years", () => {
    expect(calendarYear(new Date("2026-12-31T22:59:59Z"))).toBe(2026);
    expect(calendarYear(new Date("2026-12-31T23:00:00Z"))).toBe(2027);
    expect(getPractice("isee_ordinario", "it")?.referenceYear).toBe(2025);
    const input: DossierInput = {
      practiceId: "isee_ordinario",
      answers: {},
      household: [],
      checklist: [],
      documents: [],
      language: "it",
      now: new Date("2027-12-31T23:00:00Z"),
    };
    expect(
      evaluateDossier(input).findings.some(
        (f) => f.code === "practice.outdated_catalog" && f.severity === "blocker",
      ),
    ).toBe(true);
  });
  it.each([
    "2027-03-28T00:59:59Z",
    "2027-03-28T01:00:00Z",
    "2027-10-31T00:59:59Z",
    "2027-10-31T01:00:00Z",
  ])("keeps the Rome day through the clock change: %s", (instant) => {
    expect(calendarDate(new Date(instant))).toBe(instant.slice(0, 10));
  });
  it.each([
    ["2027-01-05T22:59:59Z", false],
    ["2027-01-05T23:00:00Z", true],
  ] as const)("expiry is inclusive through the Rome date: %s", (instant, expired) => {
    const input: DossierInput = {
      practiceId: "isee_ordinario",
      answers: {},
      household: [],
      checklist: [],
      language: "it",
      now: new Date(instant),
      documents: [
        {
          id: "d",
          citizenCheck: { status: "pending", messages: [] },
          citizenKeptAt: null,
          fileName: "ESEMPIO.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          pages: 1,
          uploadedAt: now.toISOString(),
          checklistItemId: null,
          memberId: null,
          status: "analyzed",
          analysis: {
            engine: "ai",
            detectedRequirementId: "identity",
            detectedLabel: null,
            confidence: 1,
            ownerName: null,
            referenceYear: null,
            expiresOn: "2027-01-05",
            legible: true,
            pagesComplete: true,
            findings: [],
          },
        },
      ],
    };
    expect(evaluateDossier(input).findings.some((f) => f.code === "document.expired")).toBe(
      expired,
    );
  });
});

it.each(["\ud800", "\udfff"])(
  "text: rejects unpaired UTF-16 surrogates before PostgreSQL JSONB",
  (surrogate) => {
    expect(IntakeTurn.safeParse({ type: "text", text: `Ciao${surrogate}` }).success).toBe(false);
    expect(
      MemberInput.safeParse({ role: "richiedente", firstName: `Persona${surrogate}` }).success,
    ).toBe(false);
  },
);
