import { calendarDate } from "@avanti/core";
import { LANGUAGES, PRACTICE_IDS, type Metrics } from "@avanti/contracts";
import { minutes, type CaseRow } from "./dossier";
import { ApiFailure } from "./security";

export interface MetricEvent {
  caseId: string | null;
  type: string;
  at: string;
  metadata: Record<string, number | boolean | null>;
}

export function metricsRange(from: string, to: string) {
  if (!validDate(from) || !validDate(to) || from > to) {
    throw new ApiFailure("bad_request", 400, "Intervallo di date non valido.");
  }
  const nextDay = new Date(`${to}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const start = romeMidnight(from);
  const end = romeMidnight(nextDay.toISOString().slice(0, 10));
  if (end.getTime() - start.getTime() > 366 * 86400000) {
    throw new ApiFailure("bad_request", 400, "Scegli un intervallo di massimo un anno.");
  }
  return { start, end };
}

function validDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date;
}

function average(values: (number | null)[]) {
  const measured = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : null;
}

export type MetricCase = Pick<
  CaseRow,
  | "id"
  | "createdAt"
  | "submittedAt"
  | "practiceId"
  | "language"
  | "firstSubmissionComplete"
  | "reviewStartedAt"
>;

export function calculateMetrics(
  from: string,
  to: string,
  rows: MetricCase[],
  events: MetricEvent[],
  baselineMinutesPerCase: number | null,
): Metrics {
  const { start, end } = metricsRange(from, to);
  const inRange = (at: string | null) =>
    at !== null && Date.parse(at) >= start.getTime() && Date.parse(at) < end.getTime();
  const started = rows.filter((row) => inRange(row.createdAt));
  const submitted = rows.filter((row) => inRange(row.submittedAt));
  const requested = new Set(
    events
      .filter(
        (event) =>
          ["citizen.requested", "case.requested"].includes(event.type) &&
          Date.parse(event.at) < end.getTime(),
      )
      .map((event) => event.caseId),
  );
  const completions = new Map<string, MetricEvent>();
  for (const event of events) {
    if (event.caseId && event.type === "review.completed" && inRange(event.at)) {
      const previous = completions.get(event.caseId);
      if (!previous || Date.parse(previous.at) < Date.parse(event.at))
        completions.set(event.caseId, event);
    }
  }
  const reviewDurations = rows.flatMap((row) => {
    const completion = completions.get(row.id);
    if (!completion) return [];
    const recorded = completion.metadata.durationMinutes;
    if (typeof recorded === "number" && recorded >= 0) return [recorded];
    // Older events still use their own completion time, never the row's later mutable timestamp.
    return [minutes(row.reviewStartedAt, completion.at)];
  });
  const startedByDay = new Map<string, number>();
  const submittedByDay = new Map<string, number>();
  for (const row of started) {
    const day = calendarDate(new Date(row.createdAt));
    startedByDay.set(day, (startedByDay.get(day) ?? 0) + 1);
  }
  for (const row of submitted) {
    const day = calendarDate(new Date(row.submittedAt!));
    submittedByDay.set(day, (submittedByDay.get(day) ?? 0) + 1);
  }
  const daily: Metrics["daily"] = [];
  for (
    let day = new Date(`${from}T00:00:00Z`);
    day.toISOString().slice(0, 10) <= to;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    daily.push({
      date,
      started: startedByDay.get(date) ?? 0,
      submitted: submittedByDay.get(date) ?? 0,
    });
  }
  return {
    from,
    to,
    casesStarted: started.length,
    casesSubmitted: submitted.length,
    casesReady: completions.size,
    completeAtFirstSubmission: submitted.length
      ? submitted.filter((row) => row.firstSubmissionComplete === true).length / submitted.length
      : null,
    avgCitizenMinutes: average(submitted.map((row) => minutes(row.createdAt, row.submittedAt))),
    avgReviewMinutes: average(reviewDurations),
    baselineMinutesPerCase,
    needsCitizenRate: submitted.length
      ? submitted.filter((row) => requested.has(row.id)).length / submitted.length
      : null,
    byPractice: PRACTICE_IDS.map((practiceId) => ({
      practiceId,
      count: started.filter((row) => row.practiceId === practiceId).length,
    })).filter((group) => group.count > 0),
    byLanguage: LANGUAGES.map((language) => ({
      language,
      count: started.filter((row) => row.language === language).length,
    })).filter((group) => group.count > 0),
    daily,
  };
}

function romeMidnight(date: string): Date {
  const utc = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    hourCycle: "h23",
  });
  let instant = utc;
  for (let attempt = 0; attempt < 2; attempt++) {
    const offset = Number(formatter.format(new Date(instant))) % 24;
    instant -= offset * 3600000;
  }
  return new Date(instant);
}
