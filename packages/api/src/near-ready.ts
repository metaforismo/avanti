import { and, eq, sql } from "drizzle-orm";
import {
  cases,
  documents,
  events,
  messages,
  copilotCache,
  checklistReviews,
  nearReadyBlindReviews,
  nearReadyEvaluations,
  nearReadyEvents,
  organizations,
  settings,
  type Database,
  type NearReadySnapshot,
} from "@avanti/db";
import {
  NearReadyBlindRequest,
  NearReadyDecisionRequest,
  NearReadyFinalRequest,
  NearReadyVersionRequest,
  DossierConsistency,
  Id,
  type NearReadyField,
} from "@avanti/contracts";
import {
  CATALOG_VERSION,
  calendarDate,
  NEAR_READY_RULES_VERSION,
  NEAR_READY_SCHEMA_VERSION,
  evaluateNearReady,
  nearReadySlots,
  nearReadyValidUntil,
} from "@avanti/core";
import { manipulationCount, type Task, type TaskResult } from "@avanti/ai";
import {
  nearReadyReadTask,
  nearReadyCompareTask,
  NearReadyReadInput,
} from "@avanti/ai/operator-tasks";
import { body, parse, type App, type Services } from "./context";
import { audit, caseById, dossierView, iso, type CaseRow } from "./dossier";
import { copilotDossier } from "./copilot-context";
import { cached } from "./copilot";
import { assertCaseVersion, nextCaseUpdate } from "./case-version";
import { lockOperatorAccess } from "./operator-access";
import { deadline } from "./deadline";
import { observeAi } from "./operational-telemetry";
import { aiBudget } from "./ai-usage";
import { ApiFailure } from "./security";
import { nearReadyProfile, currentNearReadyProfile } from "./near-ready-profile";
import { latestNearReady, nearReadyPolicy, nearReadyView } from "./near-ready-view";
import { administer } from "./routes/administration";
import { nearReadyPilot } from "./near-ready-metrics";
const conflict = () =>
  new ApiFailure("conflict", 409, "Il controllo non è più attuale. Ricarica il fascicolo.");
type Evaluation = typeof nearReadyEvaluations.$inferSelect;
export async function nearReadyEvent(
  db: Database,
  evaluation: Evaluation,
  action: (typeof nearReadyEvents.$inferInsert)["action"],
  now: Date,
  actorId: string | null = null,
  detail: Partial<
    Pick<typeof nearReadyEvents.$inferInsert, "reason" | "ready" | "durationMinutes">
  > = {},
  version = evaluation.currentVersion,
) {
  await db.insert(nearReadyEvents).values({
    id: crypto.randomUUID(),
    evaluationId: evaluation.id,
    action,
    actor: actorId ? "operator" : "system",
    actorId,
    at: now.toISOString(),
    caseVersion: version,
    ...detail,
  });
}
export async function evaluateCaseNearReady(s: Services, row: CaseRow) {
  const current = await caseById(s.db, row.id, row.organizationId);
  assertCaseVersion(current, iso(row.updatedAt));
  const previous = await latestNearReady(s.db, row.id);
  if (previous && iso(previous.caseVersion) === iso(current.updatedAt)) return previous;
  // Share the durable copilot lease across HTTP reads and background workers. Only the
  // evaluation id is cached; document readings and values never enter this payload.
  const id = await cached(
    s,
    current,
    "near-ready",
    Id,
    false,
    async () => (await screenNearReady(s, current)).id,
  );
  const [evaluation] = await s.db
    .select()
    .from(nearReadyEvaluations)
    .where(and(eq(nearReadyEvaluations.id, id), eq(nearReadyEvaluations.caseId, row.id)));
  if (!evaluation) throw conflict();
  return evaluation;
}
async function screenNearReady(s: Services, row: CaseRow) {
  const policy = await nearReadyPolicy(s.db, row.organizationId);
  const version = iso(row.updatedAt);
  const previous = await latestNearReady(s.db, row.id);
  // A version is screened once; retrying unavailable AI requires a fresh version/recheck.
  if (previous && iso(previous.caseVersion) === version) return previous;
  const started = performance.now();
  const d = await dossierView(s.db, row, s.clock());
  const [stored, safety, openQuestions, consistency, manualReviews] = await Promise.all([
    s.db.select().from(documents).where(eq(documents.caseId, row.id)),
    s.db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.caseId, row.id), sql`${events.type} like '%safety%'`))
      .limit(1),
    s.db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.caseId, row.id),
          eq(messages.role, "citizen"),
          eq(messages.kind, "citizen_question"),
          sql`not exists (select 1 from messages reply where reply.case_id = ${row.id} and reply.role = 'operator' and reply.created_at > "messages"."created_at")`,
        ),
      )
      .limit(1),
    s.db
      .select()
      .from(copilotCache)
      .where(
        and(
          eq(copilotCache.caseId, row.id),
          eq(copilotCache.caseVersion, version),
          eq(copilotCache.task, "consistency"),
        ),
      ),
    s.db.select().from(checklistReviews).where(eq(checklistReviews.caseId, row.id)),
  ]);
  const aiAvailable =
    !!s.ai.configured &&
    !!s.ai.runTask &&
    policy.aiCopilot &&
    !(await aiBudget(s, row.organizationId)).exhausted;
  const fields: (NearReadyField & { consistent: boolean })[] = [];
  const tasks: NearReadySnapshot["tasks"] = [];
  const readings: {
    documentId: string;
    fields: TaskResult<import("zod").infer<typeof nearReadyReadTask.output>>["output"]["fields"];
  }[] = [];
  let security = safety.length > 0 || manipulationCount(JSON.stringify(copilotDossier(d))) > 0;
  const unresolved =
    (row.aiAttention !== null && row.aiAttention > 0 && consistency.length === 0) ||
    consistency.some((cache) =>
      DossierConsistency.safeParse(cache.payload).data?.issues.some(
        (issue) =>
          issue.severity !== "info" &&
          !issue.id.startsWith("document.unchecked") &&
          !issue.id.startsWith("practice.provisional_year"),
      ),
    );
  let aiOk = aiAvailable,
    aiIssues = unresolved;
  async function run<I, O>(task: Task<I, O>, input: I) {
    let result: TaskResult<O>;
    try {
      result = await observeAi(s, row, () => s.ai.runTask!(task, input));
    } catch {
      result = {
        output: task.heuristic(input),
        engine: "heuristic",
        model: null,
        attempts: 0,
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
        costEstimate: 0,
        fallbackReason: "provider_error",
        retryReasons: [],
      };
    }
    const expectedModel = s.ai.configuration?.models[task.tier];
    aiOk &&=
      result.engine === "ai" &&
      result.fallbackReason === null &&
      !!result.model &&
      result.retryReasons.length === 0 &&
      result.attempts === 1 &&
      (!expectedModel || result.model === expectedModel);
    security ||=
      result.fallbackReason === "guard_violation" ||
      result.retryReasons.includes("guard_violation");
    tasks.push({
      task: task.id,
      version: task.version,
      model: result.model,
      engine: result.engine,
      fallbackReason: result.fallbackReason,
      latencyMs: result.latencyMs,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costEstimate: result.costEstimate,
      attempts: result.attempts,
    });
    return result.output;
  }
  const slots = nearReadySlots(d);
  const lastCitizenChange = Math.max(
    0,
    ...d.timeline.filter((e) => e.actor === "citizen").map((e) => Date.parse(e.at)),
  );
  const precheck = () =>
    evaluateNearReady({
      dossier: d,
      answers: row.answers,
      confirmedAnswers: row.confirmedAnswers,
      editingQuestion: row.editingQuestion,
      pendingProposals: row.conversationProposals.length > 0,
      openRequest: !!row.citizenRequestId || openQuestions.length > 0,
      securityNotice: security,
      duplicate: new Set(stored.map((doc) => doc.sha256)).size !== stored.length,
      caseVersion: version,
      analysisVersion: version,
      catalogVersion: CATALOG_VERSION,
      now: s.clock(),
      aiAvailable,
      aiOk,
      aiIssues,
      aiAttempted: tasks.length > 0,
      fields,
      criticalThreshold: policy.criticalThreshold,
      otherThreshold: policy.otherThreshold,
    });
  const initial = precheck();
  const canRead =
    policy.mode !== "off" &&
    !policy.suspendedAt &&
    aiAvailable &&
    initial.exclusions.every((r) => ["field_missing", "ai_issues"].includes(r));
  if (canRead) {
    for (const doc of stored.filter((doc) => slots.some((slot) => slot.documentId === doc.id))) {
      if (performance.now() - started > 40_000) {
        aiOk = false;
        break;
      }
      const docSlots = slots.filter((slot) => slot.documentId === doc.id);
      const manual = manualReviews.find(
        (review) => review.itemId === doc.checklistItemId && review.decision === "verified",
      );
      if (
        docSlots.every((slot) => slot.manual) &&
        manual &&
        Date.parse(manual.reviewedAt) >= Math.max(lastCitizenChange, Date.parse(doc.uploadedAt))
      ) {
        for (const slot of docSlots)
          fields.push({
            ...slot,
            source: "manual",
            page: null,
            answerId: null,
            confidence: 1,
            consistent: true,
          });
        continue;
      }
      const mime = NearReadyReadInput.shape.mime.safeParse(doc.mimeType);
      if (!mime.success || !doc.pages) {
        aiOk = false;
        continue;
      }
      try {
        const output = await run(nearReadyReadTask, {
          synthetic: !s.production && row.organizationId === "demo-caf-milano",
          today: calendarDate(s.clock()),
          bytes: new Uint8Array(await deadline(s.storage.get(doc.storageKey), 10_000)),
          mime: mime.data,
          documentId: doc.id,
          pages: doc.pages,
          dossier: copilotDossier(d),
          slots: docSlots,
        });
        security ||= output.securityWarning;
        readings.push({ documentId: doc.id, fields: output.fields });
        for (const field of output.fields) {
          const slot = docSlots.find((slot) => slot.fieldId === field.fieldId);
          if (!slot) continue;
          fields.push({
            fieldId: slot.fieldId,
            label: slot.label,
            critical: slot.critical,
            documentId: doc.id,
            page: field.page,
            answerId: null,
            source: "ai",
            confidence: field.confidence,
            consistent: field.consistent,
          });
        }
      } catch {
        aiOk = false;
      }
    }
    if (performance.now() - started <= 40_000) {
      const output = await run(nearReadyCompareTask, {
        synthetic: !s.production && row.organizationId === "demo-caf-milano",
        today: calendarDate(s.clock()),
        dossier: copilotDossier(d),
        readings,
      });
      aiIssues = unresolved || !output.consistent;
      security ||= output.securityWarning;
    } else {
      aiOk = false;
      aiIssues = true;
    }
  }
  for (const q of d.answers.filter((q) => row.confirmedAnswers.includes(q.questionId)))
    fields.push({
      fieldId: `answer:${q.questionId}`,
      label: "Risposta confermata",
      critical: true,
      source: "answer",
      documentId: null,
      page: null,
      answerId: q.questionId,
      confidence: 1,
      consistent: true,
    });
  if (!canRead) aiOk = false;
  const result = precheck();
  if (policy.mode === "off") result.exclusions.push("mode_off");
  if (policy.suspendedAt) result.exclusions.push("suspended");
  const eligible = result.exclusions.length === 0;
  return s.db.transaction(async (tx) => {
    // Policy and publication share the tenant lock. Network calls have already finished.
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, row.organizationId))
      .for("share");
    const current = await caseById(tx, row.id, row.organizationId, true);
    assertCaseVersion(current, version);
    // Consistency publishes derived attention without advancing the dossier version.
    // A reading started before that publication must not approve the older picture.
    if (current.aiAttention !== row.aiAttention) throw conflict();
    const existing = await latestNearReady(tx, row.id);
    if (existing && iso(existing.caseVersion) === version) return existing;
    const currentPolicy = await nearReadyPolicy(tx, row.organizationId);
    if (JSON.stringify(currentPolicy) !== JSON.stringify(policy)) throw conflict();
    const state = policy.mode === "shadow" ? "shadow" : eligible ? "suggested" : "not_eligible";
    const [evaluation] = await tx
      .insert(nearReadyEvaluations)
      .values({
        id: crypto.randomUUID(),
        caseId: row.id,
        caseVersion: version,
        currentVersion: version,
        checkedAt: s.clock().toISOString(),
        eligible,
        mode: policy.mode,
        state,
        language: row.language,
        reading: !aiAvailable
          ? "unavailable"
          : fields.some((f) => f.source === "manual")
            ? fields.some((f) => f.source === "ai")
              ? "mixed"
              : "manual"
            : fields.some((f) => f.source === "ai")
              ? "ai"
              : stored.some((doc) => doc.analysis?.engine === "heuristic")
                ? "heuristic"
                : "unavailable",
        snapshot: {
          configurationKey: nearReadyProfile(s.ai),
          validUntil: nearReadyValidUntil(s.clock()),
          rulesVersion: NEAR_READY_RULES_VERSION,
          catalogVersion: CATALOG_VERSION,
          schemaVersion: NEAR_READY_SCHEMA_VERSION,
          conditions: result.conditions,
          criticalThreshold: policy.criticalThreshold,
          otherThreshold: policy.otherThreshold,
          fields: result.fields,
          exclusions: result.exclusions,
          tasks,
          durationMs: performance.now() - started,
        },
      })
      .returning();
    await nearReadyEvent(tx, evaluation!, "evaluated", s.clock());
    if (eligible) await nearReadyEvent(tx, evaluation!, "proposed", s.clock());
    return evaluation!;
  });
}
export async function recordNearReadyFinal(
  db: Database,
  row: CaseRow,
  now: Date,
  actorId: string,
  ready: boolean,
  reason?: (typeof nearReadyEvents.$inferInsert)["reason"],
  criticalError?: (typeof nearReadyEvents.$inferInsert)["reason"],
) {
  const evaluations = await db
    .select()
    .from(nearReadyEvaluations)
    .where(
      and(
        eq(nearReadyEvaluations.caseId, row.id),
        eq(nearReadyEvaluations.caseVersion, row.updatedAt),
      ),
    );
  for (const evaluation of evaluations) {
    const [final] = await db
      .select({ id: nearReadyEvents.id })
      .from(nearReadyEvents)
      .where(
        and(
          eq(nearReadyEvents.evaluationId, evaluation.id),
          eq(nearReadyEvents.action, "final_decision"),
        ),
      )
      .limit(1);
    if (!final)
      await nearReadyEvent(
        db,
        evaluation,
        "final_decision",
        now,
        actorId,
        {
          ready,
          reason: reason ?? null,
          durationMinutes: row.reviewStartedAt
            ? Math.max(0, (now.getTime() - Date.parse(row.reviewStartedAt)) / 60000)
            : null,
        },
        row.updatedAt,
      );
  }
  if (criticalError) {
    const historical = await db
      .select()
      .from(nearReadyEvaluations)
      .where(eq(nearReadyEvaluations.caseId, row.id));
    for (const evaluation of historical) {
      const [known] = await db
        .select({ id: nearReadyEvents.id })
        .from(nearReadyEvents)
        .where(
          and(
            eq(nearReadyEvents.evaluationId, evaluation.id),
            eq(nearReadyEvents.action, "critical_error"),
          ),
        )
        .limit(1);
      if (!known)
        await nearReadyEvent(
          db,
          evaluation,
          "critical_error",
          now,
          actorId,
          { reason: criticalError },
          row.updatedAt,
        );
    }
    await db
      .insert(settings)
      .values({
        organizationId: row.organizationId,
        nearReadySuspendedAt: now.toISOString(),
        nearReadyMode: "shadow",
      })
      .onConflictDoUpdate({
        target: settings.organizationId,
        set: { nearReadySuspendedAt: now.toISOString(), nearReadyMode: "shadow" },
      });
  }
}
export function mountNearReady(app: App, s: Services) {
  app.post("/cases/:id/near-ready/evaluate", async (c) => {
    const input = await body(c, NearReadyVersionRequest),
      actor = c.get("operator");
    const row = await s.db.transaction(async (tx) => {
      await lockOperatorAccess(tx, c, s);
      const current = await caseById(tx, parse(Id, c.req.param("id")), actor.organizationId, true);
      assertCaseVersion(current, input.expectedUpdatedAt);
      const existing = await latestNearReady(tx, current.id);
      if (!existing || iso(existing.caseVersion) !== iso(current.updatedAt)) return current;
      const [updated] = await tx
        .update(cases)
        .set({ updatedAt: nextCaseUpdate(current, s.clock()) })
        .where(eq(cases.id, current.id))
        .returning();
      await audit(tx, updated!, "operator", "near_ready.rechecked", s.clock(), actor.id);
      return updated!;
    });
    await evaluateCaseNearReady(s, row);
    const view = await nearReadyView(s.db, row, actor.id, nearReadyProfile(s.ai), s.clock());
    if (view?.evaluationId && !view.blindReviewRequired) {
      const evaluation = await latestNearReady(s.db, row.id);
      if (evaluation) await nearReadyEvent(s.db, evaluation, "viewed", s.clock(), actor.id);
    }
    return c.json(view);
  });
  app.post("/cases/:id/near-ready/blind-review", async (c) => {
    const input = await body(c, NearReadyBlindRequest),
      actor = c.get("operator");
    const row = await s.db.transaction(async (tx) => {
      await lockOperatorAccess(tx, c, s);
      const row = await caseById(tx, parse(Id, c.req.param("id")), actor.organizationId, true);
      assertCaseVersion(row, input.expectedUpdatedAt);
      const evaluation = await latestNearReady(tx, row.id);
      if (!evaluation || iso(evaluation.caseVersion) !== iso(row.updatedAt)) throw conflict();
      const [exposed] = await tx
        .select({ id: nearReadyEvents.id })
        .from(nearReadyEvents)
        .where(
          and(
            eq(nearReadyEvents.evaluationId, evaluation.id),
            eq(nearReadyEvents.action, "viewed"),
            eq(nearReadyEvents.actorId, actor.id),
          ),
        )
        .limit(1);
      if (exposed) throw conflict();
      const inserted = await tx
        .insert(nearReadyBlindReviews)
        .values({
          caseId: row.id,
          caseVersion: row.updatedAt,
          operatorId: actor.id,
          ready: input.ready,
          reason: input.reason,
          at: s.clock().toISOString(),
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted.length) throw conflict();
      await nearReadyEvent(tx, evaluation, "blind_review", s.clock(), actor.id, {
        ready: input.ready,
        reason: input.reason,
      });
      await nearReadyEvent(tx, evaluation, "viewed", s.clock(), actor.id);
      return row;
    });
    return c.json(await nearReadyView(s.db, row, actor.id, nearReadyProfile(s.ai), s.clock()));
  });
  app.post("/cases/:id/near-ready/decision", async (c) => {
    const input = await body(c, NearReadyDecisionRequest),
      actor = c.get("operator");
    const row = await s.db.transaction(async (tx) => {
      await lockOperatorAccess(tx, c, s);
      const row = await caseById(tx, parse(Id, c.req.param("id")), actor.organizationId, true);
      assertCaseVersion(row, input.expectedUpdatedAt);
      const evaluation = await latestNearReady(tx, row.id),
        policy = await nearReadyPolicy(tx, actor.organizationId);
      if (
        !evaluation ||
        evaluation.id !== input.evaluationId ||
        iso(evaluation.caseVersion) !== iso(row.updatedAt) ||
        !currentNearReadyProfile(evaluation.snapshot, nearReadyProfile(s.ai), s.clock()) ||
        !s.ai.configured ||
        !evaluation.eligible ||
        !["suggested", "shadow"].includes(evaluation.state) ||
        policy.mode !== "visible" ||
        policy.suspendedAt
      )
        throw conflict();
      const state = input.decision === "accept" ? "accepted" : "dismissed";
      await tx
        .update(nearReadyEvaluations)
        .set({ state, dismissalNote: input.note ?? null })
        .where(eq(nearReadyEvaluations.id, evaluation.id));
      await nearReadyEvent(tx, evaluation, state, s.clock(), actor.id, {
        reason: input.reason ?? null,
      });
      await audit(tx, row, "operator", `near_ready.${state}`, s.clock(), actor.id);
      return row;
    });
    return c.json(await nearReadyView(s.db, row, actor.id, nearReadyProfile(s.ai), s.clock()));
  });
  app.post("/cases/:id/near-ready/final-decision", async (c) => {
    const input = await body(c, NearReadyFinalRequest),
      actor = c.get("operator");
    const action = async (tx: Database) => {
      await lockOperatorAccess(tx, c, s);
      const row = await caseById(tx, parse(Id, c.req.param("id")), actor.organizationId, true);
      assertCaseVersion(row, input.expectedUpdatedAt);
      if (!(await latestNearReady(tx, row.id))) throw conflict();
      if (input.ready && row.status !== "ready")
        throw new ApiFailure(
          "conflict",
          409,
          "Segna prima il fascicolo pronto con il comando di revisione.",
        );
      await recordNearReadyFinal(
        tx,
        row,
        s.clock(),
        actor.id,
        input.ready,
        input.reason,
        input.criticalError,
      );
    };
    // A confirmed critical error changes tenant policy; take the admin lock before any case lock.
    if (input.criticalError) await administer(s, c, action);
    else await s.db.transaction(action);
    const row = await caseById(s.db, c.req.param("id"), actor.organizationId);
    return c.json(await nearReadyView(s.db, row, actor.id, nearReadyProfile(s.ai), s.clock()));
  });
  app.get("/reports/near-ready", async (c) => {
    const actor = c.get("operator");
    if (actor.role !== "admin")
      throw new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
    return c.json(await nearReadyPilot(s.db, actor.organizationId, nearReadyProfile(s.ai)));
  });
}
