import { describe, expect, it } from "vitest";
import { firstSteps, isFirstDay, type SetupFacts } from "./first-steps";

const base: SetupFacts = {
  admin: true,
  offices: [{ openingHours: null }],
  mfaEnabled: false,
  counts: {},
  operators: 1,
  baselineSet: false,
  marked: new Set(),
};

describe("isFirstDay", () => {
  it("is not known before the counts arrive", () => {
    expect(isFirstDay(undefined)).toBe(false);
  });

  it("lasts while only test cases still being filled in exist", () => {
    expect(isFirstDay({ intake: 2, submitted: 0 })).toBe(true);
  });

  it("ends with the first dossier that reaches the CAF, or one already archived", () => {
    expect(isFirstDay({ intake: 2, submitted: 1 })).toBe(false);
    expect(isFirstDay({ closed: 1 })).toBe(false);
  });
});

describe("firstSteps", () => {
  it("gives administrators the setup of the office, operators the daily work", () => {
    expect(firstSteps(base).steps.map((s) => s.key)).toEqual([
      "office",
      "poster",
      "trial",
      "colleagues",
      "baseline",
      "mfa",
    ]);
    expect(firstSteps({ ...base, admin: false }).steps.map((s) => s.key)).toEqual([
      "guide",
      "trial",
      "poster",
      "mfa",
    ]);
  });

  it("ticks off what the console can see and what this browser remembers", () => {
    const result = firstSteps({
      ...base,
      offices: [{ openingHours: "lun–ven 9–13" }],
      counts: { intake: 1 },
      operators: 3,
      baselineSet: true,
      mfaEnabled: true,
      marked: new Set(["poster"]),
    });
    expect(result.steps.every((s) => s.done)).toBe(true);
    expect(result.done).toBe(6);
  });

  it("wants opening hours on every office, and at least one office", () => {
    const offices = [{ openingHours: "9–13" }, { openingHours: "" }];
    expect(firstSteps({ ...base, offices }).steps[0]!.done).toBe(false);
    expect(firstSteps({ ...base, offices: [] }).steps[0]!.done).toBe(false);
  });

  it("is not known while the operators or the settings are still loading", () => {
    expect(firstSteps({ ...base, operators: undefined }).known).toBe(false);
    expect(firstSteps({ ...base, baselineSet: undefined }).known).toBe(false);
    expect(firstSteps(base).known).toBe(true);
    // Operators never load the admin lists: their steps are always known.
    expect(firstSteps({ ...base, admin: false, operators: undefined }).known).toBe(true);
  });

  it("does not count the administrator alone as a colleague", () => {
    expect(firstSteps(base).steps.find((s) => s.key === "colleagues")!.done).toBe(false);
  });
});
