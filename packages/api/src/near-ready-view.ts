import { currentNearReadyProfile } from "./near-ready-profile";
import { and, desc, eq } from "drizzle-orm";
import { nearReadyBlindReviews, nearReadyEvaluations, settings, type Database } from "@avanti/db";
import type { NearReady } from "@avanti/contracts";
import {
  NEAR_READY_RULES_VERSION,
  nearReadyConditionText,
  nearReadyReasonText,
  nearReadyVisualChecks,
} from "@avanti/core";

function policyView(row?: typeof settings.$inferSelect | null) {
  return {
    mode: row?.nearReadyMode ?? "shadow",
    criticalThreshold: row?.nearReadyCriticalThreshold ?? 0.98,
    otherThreshold: row?.nearReadyOtherThreshold ?? 0.95,
    suspendedAt: row?.nearReadySuspendedAt ?? null,
    aiCopilot: row?.aiCopilot ?? true,
  };
}
export const nearReadyPolicy = async (db: Database, org: string) => {
  const [row] = await db.select().from(settings).where(eq(settings.organizationId, org));
  return policyView(row);
};
export async function latestNearReady(db: Database, caseId: string) {
  const [row] = await db
    .select()
    .from(nearReadyEvaluations)
    .where(eq(nearReadyEvaluations.caseId, caseId))
    .orderBy(desc(nearReadyEvaluations.caseVersion))
    .limit(1);
  return row;
}
export type NearReadyViewData = {
  evaluation: typeof nearReadyEvaluations.$inferSelect;
  policy: typeof settings.$inferSelect | null;
  blind: string | null;
};
export async function nearReadyView(
  db: Database,
  row: { id: string; organizationId: string; contentVersion: string },
  operatorId?: string,
  profile?: string,
  now?: Date,
  preloaded?: NearReadyViewData | null,
): Promise<NearReady | null> {
  // Evaluations judge the content; operator work on the case does not make them stale.
  const version = new Date(row.contentVersion).toISOString();
  const entry =
    preloaded !== undefined
      ? preloaded
      : (
          await db
            .select({
              evaluation: nearReadyEvaluations,
              policy: settings,
              blind: nearReadyBlindReviews.caseId,
            })
            .from(nearReadyEvaluations)
            .leftJoin(settings, eq(settings.organizationId, row.organizationId))
            .leftJoin(
              nearReadyBlindReviews,
              and(
                eq(nearReadyBlindReviews.caseId, row.id),
                eq(nearReadyBlindReviews.caseVersion, version),
                eq(nearReadyBlindReviews.operatorId, operatorId ?? ""),
              ),
            )
            .where(eq(nearReadyEvaluations.caseId, row.id))
            .orderBy(desc(nearReadyEvaluations.caseVersion))
            .limit(1)
        )[0];
  if (!entry) return null;
  const { evaluation, blind } = entry;
  const policy = policyView(entry.policy);
  const hidden = policy.mode === "shadow" && !blind && !policy.suspendedAt;
  // A withdrawal can happen at the same version (AI profile changed): it is stale too.
  const stale =
    evaluation.state === "withdrawn" ||
    new Date(evaluation.caseVersion).toISOString() !== version ||
    !currentNearReadyProfile(evaluation.snapshot, profile, now);
  // A blind review of a superseded evaluation would be refused: offer a recheck instead,
  // still without revealing the old result.
  const blindReviewRequired = hidden && !stale;
  const reasons =
    policy.mode === "off"
      ? ["mode_off" as const]
      : policy.suspendedAt
        ? ["suspended" as const]
        : stale
          ? ["stale_version" as const]
          : evaluation.snapshot.exclusions;
  return {
    evaluationId: hidden ? null : evaluation.id,
    state: hidden
      ? blindReviewRequired
        ? "shadow"
        : "withdrawn"
      : policy.mode === "off" || policy.suspendedAt
        ? "not_eligible"
        : stale
          ? "withdrawn"
          : policy.mode === "shadow"
            ? "shadow"
            : evaluation.state === "shadow"
              ? evaluation.eligible
                ? "suggested"
                : "not_eligible"
              : evaluation.state,
    result: hidden ? null : evaluation.eligible && !reasons.length ? "eligible" : "not_eligible",
    caseVersion: version,
    evaluatedVersion: new Date(evaluation.caseVersion).toISOString(),
    checkedAt: new Date(evaluation.checkedAt).toISOString(),
    mode: policy.mode,
    rulesVersion: evaluation.snapshot.rulesVersion ?? NEAR_READY_RULES_VERSION,
    conditionsMet: hidden
      ? []
      : Object.entries(evaluation.snapshot.conditions)
          .filter(([, ok]) => ok)
          .map(([key]) => nearReadyConditionText[key] ?? key),
    criticalFields: hidden || stale ? [] : evaluation.snapshot.fields.filter((f) => f.critical),
    visualChecks: nearReadyVisualChecks,
    reviewOrder:
      !hidden && !stale && evaluation.state === "accepted"
        ? [
            ...new Set(
              evaluation.snapshot.fields
                .filter((f) => f.critical && f.documentId)
                .map((f) => f.documentId!),
            ),
          ]
        : [],
    exclusions: blindReviewRequired
      ? []
      : (hidden ? (["stale_version"] as const) : reasons).map((code) => ({
          code,
          text: nearReadyReasonText[code],
        })),
    blindReviewRequired,
  };
}
