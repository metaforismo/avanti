import { describe, expect, it } from "vitest";
import { formatBytes, formatMinutes, timeAgo } from "./labels";

describe("formatMinutes", () => {
  it.each([
    [null, "—"],
    [Number.NaN, "—"],
    [0.4, "< 1 min"],
    [12.4, "12 min"],
    [60, "1 h"],
    [95, "1 h 35 min"],
  ])("%s → %s", (input, expected) => {
    expect(formatMinutes(input)).toBe(expected);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 byte"],
    [999, "999 byte"],
    [1499, "1 kB"],
    [999_499, "999 kB"],
    [1_000_000, "1 MB"],
    [12_449_000, "12,4 MB"],
    [120_000_000, "120 MB"],
  ])("%s → %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2027-01-15T10:00:00Z");
  it("says now for the last minute", () => {
    expect(timeAgo("2027-01-15T09:59:30Z", now)).toBe("adesso");
  });
  it("uses relative minutes and hours", () => {
    expect(timeAgo("2027-01-15T09:45:00Z", now)).toBe("15 minuti fa");
    expect(timeAgo("2027-01-15T07:00:00Z", now)).toBe("3 ore fa");
  });
  it("switches to a date after a week", () => {
    expect(timeAgo("2026-12-20T10:00:00Z", now)).toMatch(/20 dic/);
  });
});
