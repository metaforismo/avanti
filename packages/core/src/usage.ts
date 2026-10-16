/** Commercial months and new AI telemetry use the platform's Italian business calendar. */
export function usageDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function usageMonth(now: Date): string {
  return usageDay(now).slice(0, 7);
}
export function usageMonthRange(month: string) {
  const year = Number(month.slice(0, 4));
  const next = (Number(month.slice(5)) % 12) + 1;
  return {
    from: `${month}-01`,
    until: `${year + (next === 1 ? 1 : 0)}-${String(next).padStart(2, "0")}-01`,
  };
}
export function usagePercent(used: number, limit: number | null): number | null {
  return limit === null ? null : limit === 0 ? (used === 0 ? 0 : null) : (used * 100) / limit;
}
