/**
 * Art. 12(3) GDPR: answer «within one month of receipt». A period in months ends on the same
 * day of the following month, or on its last day when that day does not exist (Reg. 1182/71,
 * art. 3(2)(c)): 31 January ends 28/29 February, not 3 March. Days counted in Rome.
 */
export function erasureDeadline(requestedAt: string): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(requestedAt))
    .split("-")
    .map(Number) as [number, number, number];
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const last = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return { year: nextYear, month: nextMonth, day: Math.min(day, last) };
}

export function formatDeadline({ year, month, day }: ReturnType<typeof erasureDeadline>) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
