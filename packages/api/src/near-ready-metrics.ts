import { asc, eq, inArray } from "drizzle-orm";
import { cases, nearReadyEvaluations, nearReadyEvents, type Database } from "@avanti/db";
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
  const ids = evaluations.map((e) => e.evaluation.id);
  const history = ids.length
    ? await db
        .select()
        .from(nearReadyEvents)
        .where(inArray(nearReadyEvents.evaluationId, ids))
        .orderBy(asc(nearReadyEvents.at))
    : [];
  // First screening per case is the prospective cohort. Later rescreening after human
  // corrections must not turn an ordinary review into a successful suggestion.
  const seen = new Set<string>(),
    observations: PilotObservation[] = [];
  const calibrationRows: PilotObservation[] = [];
  const policy = await nearReadyPolicy(db, org);
  for (const { evaluation: e } of evaluations) {
    if (seen.has(e.caseId) || e.mode === "off" || !e.snapshot.conditions.active) continue;
    seen.add(e.caseId);
    const final = history.find((h) => h.evaluationId === e.id && h.action === "final_decision");
    const observation: PilotObservation = {
      caseId: e.caseId,
      language: e.language,
      reading: e.reading,
      selected: e.eligible,
      ready: final?.ready ?? null,
      criticalError: history.some((h) => h.evaluationId === e.id && h.action === "critical_error"),
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
