import { calendarDate, romeMidnight } from "./calendar";

/**
 * A submitted case nobody has taken stands out after this many working days: a case sent on
 * Monday morning by Wednesday morning, one sent on Friday afternoon by Tuesday afternoon. One
 * working day is normal turnaround at the January peak; two means it has slipped through.
 */
export const QUEUE_WAIT_OVERDUE_WORKING_DAYS = 2;

// National holidays (L. 260/1949 and later amendments; 4 October again from 2026). Patron
// saints' days vary by city and are not counted: the threshold errs a little on the early side.
const FIXED_HOLIDAYS = new Set([
  "01-01",
  "01-06",
  "04-25",
  "05-01",
  "06-02",
  "08-15",
  "11-01",
  "12-08",
  "12-25",
  "12-26",
]);

function easterMonday(year: number): string {
  // Anonymous Gregorian computus (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return shiftDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, 1);
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Monday to Friday in Italy, national holidays excluded. `date` is YYYY-MM-DD. */
export function isWorkingDay(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const year = Number(date.slice(0, 4));
  const monthDay = date.slice(5);
  if (FIXED_HOLIDAYS.has(monthDay)) return false;
  if (monthDay === "10-04" && year >= 2026) return false;
  return date !== easterMonday(year);
}

/**
 * Latest submission instant that counts as overdue at `now`. Working time accrues only on
 * working days, each counted for its real length (23 or 25 hours across DST), so the answer
 * keeps the wall-clock hour: Friday 16:00 plus two working days is Tuesday 16:00.
 */
export function queueWaitCutoff(
  now: Date,
  workingDays: number = QUEUE_WAIT_OVERDUE_WORKING_DAYS,
): Date {
  let remaining = workingDays;
  let date = calendarDate(now);
  let end = now.getTime();
  // A year of holidays never holds more than a few consecutive non-working days.
  for (let guard = 0; guard < 400; guard++) {
    const start = romeMidnight(date).getTime();
    if (isWorkingDay(date)) {
      const length = romeMidnight(shiftDate(date, 1)).getTime() - start;
      const elapsed = (end - start) / length;
      if (elapsed >= remaining) return new Date(end - remaining * length);
      remaining -= elapsed;
    }
    end = start;
    date = shiftDate(date, -1);
  }
  return new Date(end);
}

/** Whole calendar days in Italy between the submission and now: 0 today, 1 yesterday. */
export function queueWaitDays(since: Date, now: Date): number {
  const days =
    (Date.parse(`${calendarDate(now)}T00:00:00Z`) -
      Date.parse(`${calendarDate(since)}T00:00:00Z`)) /
    86_400_000;
  return Math.max(0, Math.round(days));
}
