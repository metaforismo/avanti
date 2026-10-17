import { describe, expect, it } from "vitest";
import { isWorkingDay, queueWaitCutoff, queueWaitDays } from "./queue-wait";

const at = (iso: string) => new Date(iso);

describe("isWorkingDay", () => {
  it("excludes weekends and national holidays, Easter Monday included", () => {
    expect(isWorkingDay("2027-01-15")).toBe(true); // Friday
    expect(isWorkingDay("2027-01-16")).toBe(false); // Saturday
    expect(isWorkingDay("2027-01-17")).toBe(false); // Sunday
    expect(isWorkingDay("2027-01-06")).toBe(false); // Epifania, Wednesday
    expect(isWorkingDay("2027-03-29")).toBe(false); // Pasquetta 2027
    expect(isWorkingDay("2028-04-17")).toBe(false); // Pasquetta 2028
    expect(isWorkingDay("2027-03-30")).toBe(true);
    expect(isWorkingDay("2027-10-04")).toBe(false);
    expect(isWorkingDay("2025-10-04")).toBe(false); // Saturday anyway
    expect(isWorkingDay("2024-10-04")).toBe(true); // Friday, before the holiday returned
  });
});

describe("queueWaitCutoff", () => {
  it("keeps the Italian wall-clock hour two working days back", () => {
    // Wednesday 10:00 in Rome (CET, UTC+1) → Monday 10:00.
    expect(queueWaitCutoff(at("2027-01-13T09:00:00Z")).toISOString()).toBe(
      "2027-01-11T09:00:00.000Z",
    );
  });

  it("skips the weekend: on Tuesday afternoon the cutoff is Friday afternoon", () => {
    expect(queueWaitCutoff(at("2027-01-19T15:00:00Z")).toISOString()).toBe(
      "2027-01-15T15:00:00.000Z",
    );
  });

  it("does not accrue time over a weekend: on Monday a Friday case is not overdue", () => {
    const cutoff = queueWaitCutoff(at("2027-01-18T17:00:00Z"));
    // Monday 18:00 → Thursday 18:00 (Friday + Monday elapsed).
    expect(cutoff.toISOString()).toBe("2027-01-14T17:00:00.000Z");
    expect(at("2027-01-15T08:00:00Z") <= cutoff).toBe(false);
  });

  it("counts a weekend submission from Monday midnight", () => {
    // Wednesday 00:00 Rome: Monday and Tuesday fully elapsed.
    const cutoff = queueWaitCutoff(at("2027-01-19T23:00:00Z"));
    expect(cutoff.toISOString()).toBe("2027-01-17T23:00:00.000Z");
    expect(at("2027-01-16T10:00:00Z") <= cutoff).toBe(true);
  });

  it("skips Epifania at the start of the January peak", () => {
    // Thursday 7 January 2027 at 09:00 → Monday 4 January 09:00 (Tue 5 and Thu 7 count).
    expect(queueWaitCutoff(at("2027-01-07T08:00:00Z")).toISOString()).toBe(
      "2027-01-04T08:00:00.000Z",
    );
  });

  it("follows the Italian day across daylight saving time, not UTC", () => {
    // Tuesday 30 March 2027 at 10:00 CEST (UTC+2), after Easter Monday and the DST switch.
    // Working days back: Tue 30 (10 h), Fri 26 (full) → Thursday 25 March 10:00 CET.
    expect(queueWaitCutoff(at("2027-03-30T08:00:00Z")).toISOString()).toBe(
      "2027-03-25T09:00:00.000Z",
    );
  });

  it("uses the Rome date near midnight UTC", () => {
    // Saturday 00:30 in Rome is still Friday 23:30 UTC: no working time accrues on Saturday.
    expect(queueWaitCutoff(at("2027-01-15T23:30:00Z")).toISOString()).toBe(
      "2027-01-13T23:00:00.000Z",
    );
  });
});

describe("queueWaitDays", () => {
  it("counts Italian calendar days, not 24-hour spans", () => {
    expect(queueWaitDays(at("2027-01-15T22:30:00Z"), at("2027-01-15T23:30:00Z"))).toBe(1);
    expect(queueWaitDays(at("2027-01-15T08:00:00Z"), at("2027-01-15T18:00:00Z"))).toBe(0);
    expect(queueWaitDays(at("2027-03-27T12:00:00Z"), at("2027-03-29T12:00:00Z"))).toBe(2);
    expect(queueWaitDays(at("2027-01-16T08:00:00Z"), at("2027-01-15T08:00:00Z"))).toBe(0);
  });
});
