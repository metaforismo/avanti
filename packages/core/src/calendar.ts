const romeCalendar = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calendarDate(now: Date): string {
  return romeCalendar.format(now);
}

export function calendarYear(now: Date): number {
  return Number(calendarDate(now).slice(0, 4));
}

/** Instant of midnight in Italy at the start of a YYYY-MM-DD civil date, across DST. */
export function romeMidnight(date: string): Date {
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
