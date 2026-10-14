import { z } from "zod";
import { LANGUAGES, PRACTICE_IDS } from "./constants";

const date = z.iso.date();
export const PilotReportQuery = z
  .object({
    from: date,
    to: date,
    office: z.string().min(1).max(64).optional(),
    format: z.enum(["json", "csv", "pdf"]).default("json"),
  })
  .strict()
  .refine(
    (q) => {
      if (q.from > q.to) return false;
      const anniversary = new Date(`${q.from}T00:00:00Z`);
      anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
      // Inclusive dates: the final day must precede the first anniversary.
      return Date.parse(`${q.to}T00:00:00Z`) < anniversary.getTime();
    },
    { message: "Scegli un periodo valido di massimo un anno." },
  );
export type PilotReportQuery = z.infer<typeof PilotReportQuery>;

/** null means complementary suppression; zero is public, positive cells below five are masked. */
export const PilotCount = z.union([
  z
    .number()
    .int()
    .nonnegative()
    .refine((n) => n === 0 || n >= 5),
  z.literal("<5"),
  z.null(),
]);
const measurement = z.object({
  label: z.string(),
  value: z.number().nonnegative().nullable(),
  sample: PilotCount,
});
export const PilotThreshold = z.object({
  id: z.enum(["net_minutes_saved", "completeness_gain_pp", "delivery_rate"]),
  target: z.number(),
  unit: z.enum(["minutes", "percentage_points", "ratio"]),
  minimumSample: z.number().int().positive(),
  sample: PilotCount,
  baselineSample: PilotCount,
  observed: z.number().nullable(),
  outcome: z.enum(["raggiunta", "non_raggiunta", "dati_insufficienti"]),
  reason: z.string(),
});
export const PilotReportGroup = z.object({
  office: z.object({ id: z.string(), name: z.string() }).nullable(),
  starts: PilotCount,
  deliveries: PilotCount,
  deliveryRate: measurement,
  completeness: measurement.extend({ complete: PilotCount, missing: PilotCount }),
  integrations: z.object({ requests: PilotCount, cases: PilotCount }),
  times: z.array(
    measurement.extend({
      id: z.enum(["creation_to_submission", "review_to_ready"]),
      unit: z.literal("minutes"),
    }),
  ),
  byLanguage: z.array(z.object({ language: z.enum(LANGUAGES), count: PilotCount })),
  byPractice: z.array(z.object({ practiceId: z.enum(PRACTICE_IDS).nullable(), count: PilotCount })),
  thresholds: z.array(PilotThreshold),
});
export const PilotReport = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime({ offset: true }),
  period: z.object({
    from: date,
    to: date,
    timeZone: z.literal("Europe/Rome"),
    startInclusive: z.iso.datetime(),
    endExclusive: z.iso.datetime(),
    observedUntilExclusive: z.iso.datetime(),
  }),
  baseline: z.object({
    manualMinutesPerCase: z.number().nullable(),
    sample: z.null(),
    completeAtFirstAppointment: z.null(),
    label: z.string(),
  }),
  method: z.array(z.string()),
  total: PilotReportGroup,
  offices: z.array(PilotReportGroup),
});
export type PilotReport = z.infer<typeof PilotReport>;
export type PilotReportGroup = z.infer<typeof PilotReportGroup>;
export type PilotThreshold = z.infer<typeof PilotThreshold>;
export type PilotCount = z.infer<typeof PilotCount>;
