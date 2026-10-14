import { describe, expect, it } from "vitest";
import { PilotReport, PilotReportQuery } from "@avanti/contracts";
import { PDFDocument } from "pdf-lib";
import { calculatePilotReport, pilotReportRange, type PilotCase } from "./pilot-report";
import { pilotReportCsv, pilotReportPdf } from "./pilot-report-export";
import type { MetricEvent } from "./operator-metrics";

const now = new Date("2027-11-01T12:00:00Z");
const office = { id: "office", name: "Sportello centro" };
const q = PilotReportQuery.parse({ from: "2027-01-01", to: "2027-01-31" });
function rows(n: number, deliveries = n): PilotCase[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `private-case-${i}`,
    officeId: office.id,
    createdAt: "2027-01-05T10:00:00Z",
    submittedAt: i < deliveries ? "2027-01-05T10:12:00Z" : null,
    firstSubmissionComplete: i < deliveries ? true : null,
    reviewStartedAt: "2027-01-05T11:00:00Z",
    language: "it",
    practiceId: "isee_ordinario",
  }));
}
const report = (cases: PilotCase[], events: MetricEvent[] = [], baseline: number | null = 30) =>
  calculatePilotReport(q, cases, events, [office], baseline, now);
const conversion = (r: PilotReport) => r.total.thresholds.find((t) => t.id === "delivery_rate")!;

it("empty periods distinguish zeros from unmeasured averages and missing baseline", () => {
  const r = report([], [], null);
  expect(r.total.starts).toBe(0);
  expect(r.total.deliveries).toBe(0);
  expect(r.total.deliveryRate.value).toBeNull();
  expect(r.total.completeness.value).toBeNull();
  expect(r.total.times.every((t) => t.value === null && t.sample === 0)).toBe(true);
  expect(r.baseline.manualMinutesPerCase).toBeNull();
  expect(
    r.total.thresholds.every((t) => t.outcome === "dati_insufficienti" && t.minimumSample === 50),
  ).toBe(true);
});
it("a single case never exposes its count, times, completeness, identifiers or event metadata", () => {
  const r = report(rows(1), [
    {
      caseId: "private-case-0",
      type: "review.completed",
      at: "2027-01-05T11:30:00Z",
      metadata: { durationMinutes: 30 },
    },
  ]);
  expect(r.total.starts).toBe("<5");
  expect(r.total.deliveries).toBe("<5");
  expect(r.total.byLanguage).toEqual([{ language: "it", count: "<5" }]);
  expect(r.total.times.every((t) => t.sample === "<5" && t.value === null)).toBe(true);
  expect(r.total.completeness.value).toBeNull();
  expect(JSON.stringify(r)).not.toMatch(/private-case|durationMinutes|tokenHash|answers|contact/);
});
it("retains abandoned starts and counts only first deliveries from the same cohort", () => {
  const data = rows(50, 35);
  data.push({ ...rows(1)[0]!, id: "before", createdAt: "2026-12-31T22:59:59Z" });
  data.push({ ...rows(1)[0]!, id: "after", createdAt: "2027-01-31T23:00:00Z" });
  const r = report(data);
  expect(r.total.starts).toBe(50);
  expect(r.total.deliveries).toBe(35);
  expect(r.total.deliveryRate.value).toBe(0.7);
});
it("evaluates the exact 70% boundary without rounding, and declares insufficient samples", () => {
  expect(conversion(report(rows(50, 35)))).toMatchObject({
    target: 0.7,
    observed: 0.7,
    outcome: "raggiunta",
    sample: 50,
    minimumSample: 50,
  });
  expect(conversion(report(rows(50, 34))).outcome).toBe("non_raggiunta");
  expect(conversion(report(rows(49, 35))).outcome).toBe("dati_insufficienti");
});
it("does not convert exactly five calendar minutes saved or a 15-point proxy into verified success", () => {
  const r = report(rows(50), [], 17); // 17 - 12 = 5, but not active work.
  expect(r.total.times[0]?.value).toBe(12);
  expect(r.total.completeness.value).toBe(1);
  expect(r.baseline).toMatchObject({
    manualMinutesPerCase: 17,
    completeAtFirstAppointment: null,
    sample: null,
  });
  expect(r.total.thresholds.slice(0, 2).map((t) => t.outcome)).toEqual([
    "dati_insufficienti",
    "dati_insufficienti",
  ]);
  expect(r.total.thresholds.slice(0, 2).map((t) => t.target)).toEqual([5, 15]);
});
it("counts requests after submission once per case, uses recorded last review duration and excludes unknown completeness", () => {
  const data = rows(20);
  data.slice(0, 5).forEach((r) => {
    r.firstSubmissionComplete = null;
  });
  const events: MetricEvent[] = data.slice(0, 5).flatMap((r): MetricEvent[] => [
    { caseId: r.id, type: "case.requested", at: "2027-01-05T10:00:00Z", metadata: {} }, // Before submission, excluded.
    { caseId: r.id, type: "case.requested", at: "2027-01-06T10:00:00Z", metadata: {} },
    { caseId: r.id, type: "citizen.requested", at: "2027-01-07T10:00:00Z", metadata: {} },
    {
      caseId: r.id,
      type: "review.completed",
      at: "2027-01-08T10:00:00Z",
      metadata: { durationMinutes: 999 },
    },
    {
      caseId: r.id,
      type: "review.completed",
      at: "2027-01-09T10:00:00Z",
      metadata: { durationMinutes: 7 },
    },
  ]);
  events.push({
    caseId: data[5]!.id,
    type: "review.completed",
    at: "2027-01-09T10:00:00Z",
    metadata: {},
  });
  const r = report(data, events);
  expect(r.total.integrations).toEqual({ requests: 10, cases: 5 });
  expect(r.total.completeness).toMatchObject({ sample: 15, missing: 5, value: 1 });
  expect(r.total.times[1]).toMatchObject({ sample: 5, value: 7 });
});
it("suppresses complementary distribution cells, totals across offices, ratios and weighted times", () => {
  const data = rows(10);
  data[0]!.language = "ar";
  data[0]!.practiceId = null;
  const r = report(data);
  expect(r.offices[0]!.byLanguage).toContainEqual({ language: "ar", count: "<5" });
  expect(r.offices[0]!.byLanguage).toContainEqual({ language: "it", count: null });
  expect(r.total.starts).toBeNull();
  expect(r.total.times[0]?.value).toBeNull();
  const second = { id: "small", name: "Piccolo" };
  const across = calculatePilotReport(
    q,
    [...rows(10), { ...rows(1)[0]!, id: "small-case", officeId: second.id }],
    [],
    [office, second],
    30,
    now,
  );
  expect(across.total.starts).toBeNull();
  expect(across.offices[1]!.starts).toBe("<5");
});
it("cannot reconstruct one unsubmitted case or one missing completeness value through samples", () => {
  const r = report(rows(10, 9));
  expect(r.offices[0]!.deliveries).toBeNull();
  expect(r.offices[0]!.deliveryRate.value).toBeNull();
  expect(r.offices[0]!.times[0]?.sample).toBeNull();
  const data = rows(10);
  data[0]!.firstSubmissionComplete = null;
  const missing = report(data).offices[0]!;
  expect(missing.completeness.sample).toBeNull();
  expect(missing.completeness.value).toBeNull();
  expect(missing.completeness.missing).toBe("<5");
});
it("does not decide for future or unfinished periods, nor include future records", () => {
  const unfinished = calculatePilotReport(
    q,
    rows(50),
    [],
    [office],
    30,
    new Date("2027-01-10T10:00:00Z"),
  );
  expect(conversion(unfinished).outcome).toBe("dati_insufficienti");
  expect(unfinished.period.observedUntilExclusive).toBe("2027-01-10T10:00:00.000Z");
  expect(
    calculatePilotReport(q, rows(50), [], [office], 30, new Date("2026-12-01T00:00:00Z")).total
      .starts,
  ).toBe(0);
});

describe("inclusive Rome dates and daylight saving", () => {
  it.each([
    ["2027-03-28", "2027-03-27T23:00:00.000Z", "2027-03-28T22:00:00.000Z", 23],
    ["2027-10-31", "2027-10-30T22:00:00.000Z", "2027-10-31T23:00:00.000Z", 25],
  ])("includes both local boundaries for %s (%i hours)", (day, start, end, hours) => {
    const query = PilotReportQuery.parse({ from: day, to: day });
    const data = [
      new Date(Date.parse(start) - 1).toISOString(),
      start,
      new Date(Date.parse(end) - 1).toISOString(),
      end,
    ].map((at, i) => ({ ...rows(1)[0]!, id: `boundary-${i}`, createdAt: at, submittedAt: null }));
    const r = calculatePilotReport(query, data, [], [office], null, now);
    expect(r.period.startInclusive).toBe(start);
    expect(r.period.endExclusive).toBe(end);
    expect((Date.parse(end) - Date.parse(start)) / 3600000).toBe(hours);
    expect(r.total.starts).toBe("<5");
    // Duplicate the valid boundary records until the public count is observable.
    const replicated = Array.from({ length: 3 }, (_, j) =>
      data.map((r) => ({ ...r, id: `${j}-${r.id}` })),
    ).flat();
    expect(calculatePilotReport(query, replicated, [], [office], null, now).total.starts).toBe(6);
  });
  it.each([
    { from: "2027-02-30", to: "2027-03-01" },
    { from: "2027-02-02", to: "2027-02-01" },
    { from: "2027-01-01", to: "2028-01-01" },
    { from: "2028-01-01", to: "2029-01-01" },
    { from: "2027-01-01", to: "2027-01-01", extra: "ignored" },
  ])("rejects invalid queries %j", (raw) =>
    expect(PilotReportQuery.safeParse(raw).success).toBe(false),
  );
  it("accepts a full calendar year even when leap days and DST add 366 days plus one hour", () => {
    const query = PilotReportQuery.parse({ from: "2027-10-31", to: "2028-10-30" });
    const { start, end } = pilotReportRange(query);
    expect(start.toISOString()).toBe("2027-10-30T22:00:00.000Z");
    expect(end.toISOString()).toBe("2028-10-30T23:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(366 * 86400000 + 3600000);
    expect(() =>
      calculatePilotReport(query, [], [], [office], null, new Date("2028-11-01T00:00:00Z")),
    ).not.toThrow();
  });
  it("accepts a full leap year and a single day", () => {
    expect(PilotReportQuery.safeParse({ from: "2028-01-01", to: "2028-12-31" }).success).toBe(true);
    expect(PilotReportQuery.safeParse({ from: "2027-01-01", to: "2027-01-01" }).success).toBe(true);
  });
});

it("CSV reuses formula neutralization for whitespace, controls, BOM, quotes and Unicode office names", () => {
  for (const name of ['=HYPERLINK("bad")', " \t+SUM(1,2)", "\uFEFF@cmd", "-2+3"]) {
    const r = calculatePilotReport(q, [], [], [{ ...office, name }], null, now);
    const csv = pilotReportCsv(r);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"'");
    expect(csv).not.toContain("\t");
    expect(csv).toContain("minimumSample");
    expect(csv).toContain("Avvio:");
  }
  expect(
    pilotReportCsv(
      calculatePilotReport(q, [], [], [{ ...office, name: "مكتب المساعدة" }], null, now),
    ),
  ).toContain("مكتب المساعدة");
});
it("PDF uses the shared A4 Unicode pipeline with Arabic office names and many pages", async () => {
  const r = calculatePilotReport(
    q,
    rows(50, 35),
    [],
    [{ ...office, name: "مكتب المساعدة - Sportello centrale" }],
    30,
    now,
  );
  const bytes = await pilotReportPdf(r);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  for (const page of pdf.getPages()) {
    expect(page.getWidth()).toBeCloseTo(595.28, 1);
    expect(page.getHeight()).toBeCloseTo(841.89, 1);
  }
  expect(pdf.getTitle()).toBe("Avanti - Rapporto del pilota");
});
