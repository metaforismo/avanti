import { describe, expect, it } from "vitest";
import { interviewEstimate } from "./view";

const base = { documentsDone: 0, documentsRequired: 0, percent: 0 };

describe("interviewEstimate", () => {
  it("uses the exact total when there is one", () => {
    expect(interviewEstimate({ ...base, questionsAnswered: 3, questionsTotal: 4 })).toEqual({
      remaining: { min: 1, max: 1 },
      percent: 75,
    });
  });
  it("gives a range and a mid-range bar while follow-up questions are unknown", () => {
    const estimate = interviewEstimate({
      ...base,
      questionsAnswered: 4,
      questionsTotal: 0,
      questionsRemaining: { min: 2, max: 6 },
    });
    expect(estimate.remaining).toEqual({ min: 2, max: 6 });
    expect(estimate.percent).toBe(50);
  });
  it("says nothing rather than something wrong", () => {
    expect(interviewEstimate({ ...base, questionsAnswered: 0, questionsTotal: 0 })).toEqual({
      remaining: null,
      percent: null,
    });
    expect(
      interviewEstimate({ ...base, questionsAnswered: 5, questionsTotal: 5 }).remaining,
    ).toBeNull();
  });
});
