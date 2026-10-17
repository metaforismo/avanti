import { and, eq, inArray, sql } from "drizzle-orm";
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
    Pick<typeof nearReadyEvents.$inferInsert, "reason" | "ready" | "durationMinutes" | "actor">
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
  if (previous && iso(previous.caseVersion) === iso(current.contentVersion)) return previous;
  // Share the durable copilot lease across HTTP reads and background workers. Only the
  // evaluation id is cached; document readings and values never enter this payload.
  // New AI inconsistencies advance the content without a new updated_at: key by both.
  const id = await cached(
    s,
    current,
    `near-ready:${iso(current.contentVersion)}`,
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
  const version = iso(row.updatedAt),
    contentVersion = iso(row.contentVersion);
  const previous = await latestNearReady(s.db, row.id);
  // A version is screened once; retrying unavailable AI requires a fresh version/recheck.
  if (previous && iso(previous.caseVersion) === contentVersion) return previous;
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
    // Operator work during the AI calls leaves the judged content intact; new answers,
    // documents or AI inconsistencies (ai_attention) advance it and discard this result.
    if (iso(current.contentVersion) !== contentVersion) throw conflict();
    const existing = await latestNearReady(tx, row.id);
    if (existing && iso(existing.caseVersion) === contentVersion) return existing;
    const currentPolicy = await nearReadyPolicy(tx, row.organizationId);
    if (JSON.stringify(currentPolicy) !== JSON.stringify(policy)) throw conflict();
    const state = policy.mode === "shadow" ? "shadow" : eligible ? "suggested" : "not_eligible";
    const [evaluation] = await tx
      .insert(nearReadyEvaluations)
      .values({
        id: crypto.randomUUID(),
        caseId: row.id,
        caseVersion: contentVersion,
        currentVersion: contentVersion,
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
/** The evaluation of the content the operator is judging, if that content was screened. */
async function nearReadyAtContent(db: Database, row: CaseRow) {
  const [evaluation] = await db
    .select()
    .from(nearReadyEvaluations)
    .where(
      and(
        eq(nearReadyEvaluations.caseId, row.id),
        eq(nearReadyEvaluations.caseVersion, row.contentVersion),
      ),
    );
  return evaluation;
}
/** Returns false when there was nothing left to record for the current content version. */
export async function recordNearReadyFinal(
  db: Database,
  row: CaseRow,
  now: Date,
  actorId: string,
  ready: boolean,
  reason?: (typeof nearReadyEvents.$inferInsert)["reason"],
  criticalError?: (typeof nearReadyEvents.$inferInsert)["reason"],
): Promise<boolean> {
  const evaluation = await nearReadyAtContent(db, row);
  if (!evaluation) return false;
  let recorded = false;
  const known = await db
    .select({
      id: nearReadyEvents.id,
      action: nearReadyEvents.action,
      reason: nearReadyEvents.reason,
    })
    .from(nearReadyEvents)
    .where(
      and(
        eq(nearReadyEvents.evaluationId, evaluation.id),
        inArray(nearReadyEvents.action, ["final_decision", "critical_error"]),
      ),
    );
  const final = known.find((event) => event.action === "final_decision");
  const detail = {
    // The automatic label keeps the operator whose request triggered it, but it is not their
    // judgement: reports can tell it apart from an outcome the operator chose.
    actor: reason === INTEGRATION_REQUESTED ? ("system" as const) : ("operator" as const),
    ready,
    reason: reason ?? null,
    durationMinutes: row.reviewStartedAt
      ? Math.max(0, (now.getTime() - Date.parse(row.reviewStartedAt)) / 60000)
      : null,
  };
  if (!final) {
    await nearReadyEvent(
      db,
      evaluation,
      "final_decision",
      now,
      actorId,
      detail,
      row.contentVersion,
    );
    recorded = true;
  } else if (final.reason === INTEGRATION_REQUESTED && reason !== INTEGRATION_REQUESTED) {
    // The automatic label is provisional: the operator's own outcome on the same content (a
    // withdrawn request, then «pronta»; or a precise reason) replaces it.
    await db
      .update(nearReadyEvents)
      .set({ ...detail, actorId, at: now.toISOString() })
      .where(eq(nearReadyEvents.id, final.id));
    recorded = true;
  }
  // A critical error is a failure of the suggestion: an evaluation that suggested nothing
  // cannot fail that way, and other versions judged different content.
  if (criticalError && evaluation.eligible) {
    if (!known.some((event) => event.action === "critical_error"))
      await nearReadyEvent(
        db,
        evaluation,
        "critical_error",
        now,
        actorId,
        { reason: criticalError },
        row.contentVersion,
      );
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
    recorded = true;
  }
  return recorded;
}
const INTEGRATION_REQUESTED = "integration_requested";
/**
 * Asking the citizen for a required document says the dossier, as delivered, was not ready.
 * Labels only a suggestion of the current content (suggested, accepted, dismissed or shadow):
 * an evaluation that suggested nothing has no precision to lose. Never a critical error.
 */
export async function recordIntegrationRequested(
  db: Database,
  row: CaseRow,
  now: Date,
  actorId: string,
) {
  const evaluation = await nearReadyAtContent(db, row);
  if (
    evaluation?.eligible &&
    ["suggested", "accepted", "dismissed", "shadow"].includes(evaluation.state)
  )
    await recordNearReadyFinal(db, row, now, actorId, false, INTEGRATION_REQUESTED);
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
      // A content change already makes room for a new evaluation; only an evaluated
      // version needs a new one (this write is not operator work, so it advances the content).
      if (!existing || iso(existing.caseVersion) !== iso(current.contentVersion)) return current;
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
      if (!evaluation || iso(evaluation.caseVersion) !== iso(row.contentVersion)) throw conflict();
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
          caseVersion: row.contentVersion,
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
        iso(evaluation.caseVersion) !== iso(row.contentVersion) ||
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
      const evaluation = await nearReadyAtContent(tx, row);
      if (!evaluation)
        throw new ApiFailure(
          "conflict",
          409,
          "Il fascicolo è cambiato dopo il controllo «quasi pronta»: l'esito non si può attribuire a quel controllo. Ricontrolla la pratica.",
        );
      if (input.criticalError && !evaluation.eligible)
        throw new ApiFailure(
          "conflict",
          409,
          "Per questa versione del fascicolo non c'era un suggerimento di revisione rapida: l'errore grave non gli si può attribuire.",
        );
      if (input.ready && row.status !== "ready")
        throw new ApiFailure(
          "conflict",
          409,
          "Segna prima il fascicolo pronto con il comando di revisione.",
        );
      const recorded = await recordNearReadyFinal(
        tx,
        row,
        s.clock(),
        actor.id,
        input.ready,
        input.reason,
        input.criticalError,
      );
      if (!recorded)
        throw new ApiFailure(
          "conflict",
          409,
          "L'esito di questo controllo «quasi pronta» è già registrato.",
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
