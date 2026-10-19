import { describe, expect, it } from "vitest";
import { erasureDeadline, formatDeadline } from "./erasure-deadline";

describe("erasureDeadline", () => {
  it("ends on the same day of the next month", () => {
    expect(erasureDeadline("2027-03-15T10:00:00Z")).toEqual({ year: 2027, month: 4, day: 15 });
  });
  it("ends on the last day when the next month is shorter", () => {
    expect(erasureDeadline("2027-01-31T10:00:00Z")).toEqual({ year: 2027, month: 2, day: 28 });
    expect(erasureDeadline("2028-01-31T10:00:00Z")).toEqual({ year: 2028, month: 2, day: 29 });
  });
  it("counts the day in Rome and crosses the year", () => {
    // 23:30 UTC on 31 December is already 1 January in Rome.
    expect(erasureDeadline("2027-12-31T23:30:00Z")).toEqual({ year: 2028, month: 2, day: 1 });
    expect(erasureDeadline("2027-12-10T10:00:00Z")).toEqual({ year: 2028, month: 1, day: 10 });
  });
  it("prints an Italian date", () => {
    expect(formatDeadline({ year: 2027, month: 2, day: 28 })).toBe("28 febbraio 2027");
  });
});
