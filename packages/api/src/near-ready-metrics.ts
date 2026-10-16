import { and, asc, eq, ne, or } from "drizzle-orm";
import {
  cases,
  nearReadyBlindReviews,
  nearReadyEvaluations,
  nearReadyEvents,
  type Database,
} from "@avanti/db";
import { NearReadyPilotResponse } from "@avanti/contracts";
import { nearReadyPilotGroup, type PilotObservation } from "@avanti/core";
import { currentNearReadyProfile } from "./near-ready-profile";
import { nearReadyPolicy } from "./near-ready-view";
export async function nearReadyPilot(db: Database, org: string, profile: string) {
  const evaluations = await db
    .select({ evaluation: nearReadyEvaluations })
    .from(nearReadyEvaluations)
    .innerJoin(cases, eq(cases.id, nearReadyEvaluations.caseId))
    .where(eq(cases.organizationId, org))
    .orderBy(asc(nearReadyEvaluations.caseVersion));
  const history = evaluations.length
    ? await db
        .select({ event: nearReadyEvents })
        .from(nearReadyEvents)
        .innerJoin(nearReadyEvaluations, eq(nearReadyEvaluations.id, nearReadyEvents.evaluationId))
        .innerJoin(cases, eq(cases.id, nearReadyEvaluations.caseId))
        // Compare versions in SQL, preserving PostgreSQL's microsecond precision
        // for historical rows as well as the current millisecond API versions.
        .where(
          and(
            eq(cases.organizationId, org),
            or(
              ne(nearReadyEvents.action, "final_decision"),
              eq(nearReadyEvents.caseVersion, nearReadyEvaluations.caseVersion),
            ),
          ),
        )
        .orderBy(asc(nearReadyEvents.at))
    : [];
  const historyByEvaluation = new Map<string, (typeof nearReadyEvents.$inferSelect)[]>();
  for (const { event } of history) {
    const group = historyByEvaluation.get(event.evaluationId);
    if (group) group.push(event);
    else historyByEvaluation.set(event.evaluationId, [event]);
  }
  const blindReviews = evaluations.length
    ? await db
        .select({ evaluationId: nearReadyEvaluations.id, ready: nearReadyBlindReviews.ready })
        .from(nearReadyBlindReviews)
        .innerJoin(
          nearReadyEvaluations,
          and(
            eq(nearReadyEvaluations.caseId, nearReadyBlindReviews.caseId),
            eq(nearReadyEvaluations.caseVersion, nearReadyBlindReviews.caseVersion),
          ),
        )
        .innerJoin(cases, eq(cases.id, nearReadyEvaluations.caseId))
        .where(eq(cases.organizationId, org))
    : [];
  const blindByEvaluation = new Map<string, boolean[]>();
  for (const review of blindReviews) {
    const group = blindByEvaluation.get(review.evaluationId);
    if (group) group.push(review.ready);
    else blindByEvaluation.set(review.evaluationId, [review.ready]);
  }
  // First screening per case is the prospective cohort. Later rescreening after human
  // corrections must not turn an ordinary review into a successful suggestion.
  const seen = new Set<string>(),
    observations: PilotObservation[] = [];
  const calibrationRows: PilotObservation[] = [];
  const policy = await nearReadyPolicy(db, org);
  for (const { evaluation: e } of evaluations) {
    if (seen.has(e.caseId) || e.mode === "off" || !e.snapshot.conditions.active) continue;
    seen.add(e.caseId);
    const events = historyByEvaluation.get(e.id) ?? [];
    // Older writers attached later outcomes to every evaluation. Their recorded
    // caseVersion is the provenance: never relabel an earlier dossier with them.
    const final = events.find((h) => h.action === "final_decision" && h.ready !== null);
    const labels = [...(blindByEvaluation.get(e.id) ?? [])];
    if (final?.ready !== null && final?.ready !== undefined) labels.push(final.ready);
    const criticalError = events.some((h) => h.action === "critical_error");
    const observation: PilotObservation = {
      caseId: e.caseId,
      language: e.language,
      reading: e.reading,
      selected: e.eligible,
      ready: criticalError ? false : labels.length ? labels.every(Boolean) : null,
      disagreement: labels.includes(true) && labels.includes(false),
      criticalError,
      durationMinutes: final?.durationMinutes ?? null,
    };
    observations.push(observation);
    if (
      currentNearReadyProfile(e.snapshot, profile) &&
      e.snapshot.criticalThreshold === policy.criticalThreshold &&
      e.snapshot.otherThreshold === policy.otherThreshold
    )
      calibrationRows.push(observation);
  }
  const total = nearReadyPilotGroup(observations),
    calibration = nearReadyPilotGroup(calibrationRows);
  const keys = [...new Set(observations.map((o) => `${o.language}:${o.reading}`))];
  return NearReadyPilotResponse.parse({
    mode: policy.mode,
    suspendedAt: policy.suspendedAt ? new Date(policy.suspendedAt).toISOString() : null,
    total,
    groups: keys.map((key) => {
      const [language, reading] = key.split(":");
      return nearReadyPilotGroup(
        observations.filter((o) => o.language === language && o.reading === reading),
        language,
        reading as PilotObservation["reading"],
      );
    }),
    calibrationProfile: profile,
    calibration,
    calibrationPassed:
      org !== "demo-caf-milano" &&
      !policy.suspendedAt &&
      calibration.reviewedSelected >= 300 &&
      (calibration.precision ?? 0) >= 0.99 &&
      (calibration.precisionInterval?.oneSidedLower95 ?? 0) >= 0.98 &&
      calibration.criticalErrors === 0,
    intervalMethod: "Clopper-Pearson",
    confidenceLevel: 0.95,
    synthetic: org === "demo-caf-milano",
  });
}
