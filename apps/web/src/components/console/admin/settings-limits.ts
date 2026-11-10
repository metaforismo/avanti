/** Whole numbers only; `unit` is drawn inside the field so the number is never ambiguous. */
export const LIMITS = {
  baselineMinutesPerCase: { min: 1, max: 600, unit: "min" },
  linkDays: { min: 1, max: 365, unit: "giorni" },
  retentionDays: { min: 30, max: 3650, unit: "giorni" },
  nearReadyCriticalThreshold: { min: 80, max: 100, unit: "%" },
  nearReadyOtherThreshold: { min: 80, max: 100, unit: "%" },
} as const;

export type NumberKey = keyof typeof LIMITS;

export const message = (key: NumberKey) => {
  const { min, max, unit } = LIMITS[key];
  if (unit === "%") return `Inserisci una percentuale tra ${min} e ${max}.`;
  return `Inserisci un numero intero tra ${min} e ${max} ${unit === "min" ? "minuti" : unit}.`;
};

/** The value as a whole number in range, or null: «12abc», «1.5», «0» and «9999999» are all no. */
export function wholeNumber(key: NumberKey, raw: string) {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= LIMITS[key].min && n <= LIMITS[key].max ? n : null;
}
