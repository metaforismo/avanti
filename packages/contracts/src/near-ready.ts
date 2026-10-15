import { z } from "zod";

const instant = z.string().datetime({ offset: true });
const id = z.string().min(1).max(200);
export const NearReadyMode = z.enum(["off", "shadow", "visible"]);
export type NearReadyMode = z.infer<typeof NearReadyMode>;
export const NearReadyReason = z.enum([
  "unsupported_practice",
  "case_status",
  "interview_incomplete",
  "pending_proposals",
  "household_unidentified",
  "ownership_missing",
  "catalog_outdated",
  "documents_missing",
  "document_rejected",
  "document_processing",
  "document_duplicate",
  "document_unmatched",
  "open_request",
  "rule_issues",
  "ai_issues",
  "security_notice",
  "complex_case",
  "stale_version",
  "ai_unavailable",
  "ai_fallback",
  "ai_not_run",
  "field_missing",
  "field_confidence",
  "field_inconsistent",
  "mode_off",
  "suspended",
]);
export type NearReadyReason = z.infer<typeof NearReadyReason>;
export const NearReadyDismissReason = z.enum([
  "identity",
  "household",
  "document_match",
  "year",
  "amount",
  "other",
]);
export const NearReadyCriticalError = z.enum(["identity", "household", "year", "missing_document"]);
export const NearReadyField = z.object({
  fieldId: id,
  label: z.string(),
  critical: z.boolean(),
  source: z.enum(["ai", "manual", "answer"]),
  documentId: id.nullable(),
  page: z.number().int().positive().nullable(),
  answerId: id.nullable(),
  confidence: z.number().min(0).max(1),
});
export type NearReadyField = z.infer<typeof NearReadyField>;
export const NearReady = z.object({
  evaluationId: id.nullable(),
  state: z.enum(["suggested", "not_eligible", "withdrawn", "accepted", "dismissed", "shadow"]),
  result: z.enum(["eligible", "not_eligible"]).nullable(),
  caseVersion: instant,
  evaluatedVersion: instant,
  checkedAt: instant,
  mode: NearReadyMode,
  rulesVersion: id,
  conditionsMet: z.array(z.string()),
  criticalFields: z.array(NearReadyField),
  visualChecks: z.array(z.string()),
  reviewOrder: z.array(id).default([]),
  exclusions: z.array(z.object({ code: NearReadyReason, text: z.string() })),
  blindReviewRequired: z.boolean(),
});
export type NearReady = z.infer<typeof NearReady>;
export const NearReadyVersionRequest = z.object({ expectedUpdatedAt: instant });
export const NearReadyDecisionRequest = NearReadyVersionRequest.extend({
  evaluationId: id,
  decision: z.enum(["accept", "dismiss"]),
  reason: NearReadyDismissReason.optional(),
  note: z.string().trim().max(1000).optional(),
}).refine((v) => v.decision !== "dismiss" || v.reason !== undefined);
export const NearReadyBlindRequest = NearReadyVersionRequest.extend({
  ready: z.boolean(),
  reason: NearReadyDismissReason,
});
export const NearReadyFinalRequest = NearReadyVersionRequest.extend({
  ready: z.boolean(),
  reason: NearReadyDismissReason.optional(),
  criticalError: NearReadyCriticalError.optional(),
})
  .refine((v) => v.ready || v.reason !== undefined)
  .refine((v) => !v.ready || v.criticalError === undefined);
const distribution = z.object({
  count: z.number(),
  medianMinutes: z.number().nullable(),
  p95Minutes: z.number().nullable(),
});
export const NearReadyPilotGroup = z.object({
  language: z.string(),
  reading: z.enum(["ai", "manual", "mixed", "heuristic", "unavailable"]),
  evaluated: z.number(),
  selected: z.number(),
  selectionRate: z.number().nullable(),
  reviewedSelected: z.number(),
  correctSelected: z.number(),
  falseNearReady: z.number(),
  criticalErrors: z.number(),
  missedOpportunities: z.number(),
  precision: z.number().nullable(),
  precisionInterval: z
    .object({ lower: z.number(), upper: z.number(), oneSidedLower95: z.number() })
    .nullable(),
  suggestedReview: distribution,
  ordinaryReview: distribution,
});
export const NearReadyPilotResponse = z.object({
  mode: NearReadyMode,
  suspendedAt: instant.nullable(),
  total: NearReadyPilotGroup,
  groups: z.array(NearReadyPilotGroup),
  calibrationPassed: z.boolean(),
  calibrationProfile: id,
  calibration: NearReadyPilotGroup,
  intervalMethod: z.literal("Clopper-Pearson"),
  confidenceLevel: z.literal(0.95),
  synthetic: z.boolean(),
});
export type NearReadyPilotGroup = z.infer<typeof NearReadyPilotGroup>;
