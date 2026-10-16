import { z } from "zod";

export const UsageMonth = z.string().regex(/^(20\d{2})-(0[1-9]|1[0-2])$/);
export const CommercialUsage = z
  .object({
    month: UsageMonth,
    delivered: z.number().int().nonnegative(),
    cap: z.number().int().positive().nullable(),
    percent: z.number().nonnegative().nullable(),
  })
  .strict();
export type CommercialUsage = z.infer<typeof CommercialUsage>;
export const PlatformUsageQuery = z
  .object({
    month: UsageMonth,
    org: z.string().trim().min(1).max(200).optional(),
    json: z.boolean().default(false),
  })
  .strict();
export const PlatformOrgCommand = z
  .object({
    org: z.string().trim().min(1).max(200),
    budget: z.number().finite().min(0).max(100000).nullable().optional(),
    cap: z.number().int().positive().max(2147483647).nullable().optional(),
    json: z.boolean().default(false),
  })
  .strict();
