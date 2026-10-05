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
