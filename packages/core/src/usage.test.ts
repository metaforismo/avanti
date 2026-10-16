import { expect, it } from "vitest";
import { usageDay, usageMonth, usageMonthRange, usagePercent } from "./usage";

it.each([
  ["2027-01-31T22:59:59Z", "2027-01-31"],
  ["2027-01-31T23:00:00Z", "2027-02-01"],
  ["2027-03-31T21:59:59Z", "2027-03-31"],
  ["2027-03-31T22:00:00Z", "2027-04-01"],
  ["2026-12-31T23:00:00Z", "2027-01-01"],
])("uses Rome at the month boundary %s", (date, day) => {
  expect(usageDay(new Date(date))).toBe(day);
  expect(usageMonth(new Date(date))).toBe(day.slice(0, 7));
});
it("rolls December and reports overage and unset/zero denominators", () => {
  expect(usageMonthRange("2027-12")).toEqual({ from: "2027-12-01", until: "2028-01-01" });
  expect(usagePercent(11, 10)).toBeCloseTo(110);
  expect(usagePercent(0, null)).toBeNull();
  expect(usagePercent(0, 0)).toBe(0);
  expect(usagePercent(1, 0)).toBeNull();
});
