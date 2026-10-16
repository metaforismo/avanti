import { createHash } from "node:crypto";
import { and, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import { cases, copilotCache, documents, prefillDecisions, settings } from "@avanti/db";
import {
  DossierBrief,
  DossierConsistency,
  DsuPrefill,
  Id,
  OperatorAskRequest,
  OperatorAskResponse,
  RequestDraftRequest,
  RequestDraftResponse,
  ReplyDraftRequest,
  ReplyDraftResponse,
  PrefillDecisionResponse,
  SafeText,
  type DsuPrefillField,
  type Evidence,
} from "@avanti/contracts";
import {
  deterministicConsistency,
  repeatsRuleFinding,
  heuristicBrief,
  evidenceFor,
  dsuPrefillSlots,
  prefillMatchesSlot,
  normativeRetriever,
  citationFor,
  type CopilotDossier,
} from "@avanti/core";
import type { z } from "zod";
import type { Task, TaskResult } from "@avanti/ai";
import { body, parse, type App, type Services } from "./context";
import { caseById, dossierView, audit, iso, type CaseRow } from "./dossier";
import { ApiFailure, notFound } from "./security";
import { aiBudget } from "./ai-usage";
import { observeAi } from "./operational-telemetry";
import { lockOperatorAccess } from "./operator-access";
import { nextCaseUpdate } from "./case-version";

import { copilotDossier, redactContact, stripInternalIds } from "./copilot-context";
export { copilotDossier, redactContact } from "./copilot-context";
async function enabled(s: Services, org: string) {
  const [policy] = await s.db.select().from(settings).where(eq(settings.organizationId, org));
  return policy?.aiCopilot !== false && !(await aiBudget(s, org)).exhausted;
}
async function run<I, O>(
  s: Services,
  row: Pick<CaseRow, "organizationId">,
  task: Task<I, O>,
  input: I,
  allow: boolean,
): Promise<TaskResult<O>> {
  if (!allow || !s.ai.runTask)
    return {
      output: task.heuristic(input),
      engine: "heuristic",
      model: null,
      attempts: 0,
      latencyMs: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      costEstimate: 0,
      fallbackReason: "not_configured",
      retryReasons: [],
    };
  return observeAi(s, row.organizationId, () => s.ai.runTask!(task, input));
}
const conflict = () =>
  new ApiFailure("conflict", 409, "Il fascicolo è cambiato. Ricaricalo prima di continuare.");
const busy = () => new ApiFailure("conflict", 409, "Analisi già in corso. Riprova tra poco.");

// One durable lease per case version and task. Network work runs outside DB transactions.
export async function cached<T>(
  s: Services,
  row: CaseRow,
  task: string,
  schema: z.ZodType<T>,
  force: boolean,
  compute: () => Promise<T>,
): Promise<T> {
  const version = iso(row.updatedAt);
  const key = and(
    eq(copilotCache.caseId, row.id),
    eq(copilotCache.caseVersion, version),
    eq(copilotCache.task, task),
  );
  const token = crypto.randomUUID();
  let acquired = false;
  const until = performance.now() + 55_000;
  do {
    acquired = await s.db.transaction(async (tx) => {
      const current = await caseById(tx, row.id, row.organizationId, true);
      if (iso(current.updatedAt) !== version) throw conflict();
      const [entry] = await tx.select().from(copilotCache).where(key);
      if (entry?.payload !== null && entry?.payload !== undefined && !force) return false;
      const claim = await tx
        .insert(copilotCache)
        .values({
          caseId: row.id,
          caseVersion: version,
          task,
          payload: null,
          leaseToken: token,
          leaseUntil: new Date(s.clock().getTime() + 300_000).toISOString(),
        })
        .onConflictDoUpdate({
          target: [copilotCache.caseId, copilotCache.caseVersion, copilotCache.task],
          set: {
            payload: null,
            leaseToken: token,
            leaseUntil: new Date(s.clock().getTime() + 300_000).toISOString(),
          },
          setWhere: or(
            lte(copilotCache.leaseUntil, s.clock().toISOString()),
            force ? isNotNull(copilotCache.payload) : undefined,
          ),
        })
        .returning({ token: copilotCache.leaseToken });
      return claim[0]?.token === token;
    });
    if (acquired) break;
    const [entry] = await s.db.select().from(copilotCache).where(key);
    if (entry?.payload !== null && entry?.payload !== undefined) return schema.parse(entry.payload);
    if (performance.now() >= until) throw busy();
    await new Promise((resolve) => setTimeout(resolve, 80));
  } while (!acquired);
  try {
    const value = schema.parse(await compute());
    await s.db.transaction(async (tx) => {
      const current = await caseById(tx, row.id, row.organizationId, true);
      if (iso(current.updatedAt) !== version) throw conflict();
      const changed = await tx
        .update(copilotCache)
        .set({ payload: value })
        .where(and(key, eq(copilotCache.leaseToken, token)))
        .returning({ id: copilotCache.caseId });
      if (!changed.length) throw busy();
      if (task.startsWith("consistency")) {
        const analysis = DossierConsistency.parse(value);
        await tx
          .update(cases)
          .set({
            // "Check by eye" sits on every document read without AI: counting it would put
            // every case in the attention lane.
            aiAttention: analysis.issues.filter(
              (i) => i.severity !== "info" && !i.id.startsWith("document.unchecked"),
            ).length,
          })
          .where(eq(cases.id, row.id));
      }
    });
    return value;
  } catch (error) {
    await s.db.delete(copilotCache).where(and(key, eq(copilotCache.leaseToken, token)));
    throw error;
  }
}
function resolveEvidence(ids: string[], d: CopilotDossier): Evidence[] {
  const all = evidenceFor(d);
  return ids.flatMap((id) => {
    const found = all.find((e) => e.id === id);
    return found ? [found] : [];
  });
}
export async function analyzeConsistency(s: Services, row: CaseRow, force = false) {
  const allow = await enabled(s, row.organizationId);
  const compute = async () => {
    const { dossierConsistencyTask } = await import("@avanti/ai/operator-tasks");
    const d = copilotDossier(await dossierView(s.db, row, s.clock()));
    const result = await run(s, row, dossierConsistencyTask, d, allow);
    const deterministic = deterministicConsistency(d);
    const added = result.output.issues.map((issue) => ({
      ...issue,
      text: stripInternalIds(issue.text),
      id: `ai:${createHash("sha256").update(JSON.stringify(issue)).digest("hex").slice(0, 20)}`,
      evidence: resolveEvidence(issue.evidence, d),
    }));
    const issues = [
      ...deterministic,
      // The rules already cover each checklist item they flag; a model restating them is noise.
      ...added.filter((a) => !repeatsRuleFinding(a, deterministic)),
    ];
    return DossierConsistency.parse({
      issues,
      engine: result.engine,
      generatedAt: s.clock().toISOString(),
      caseVersion: iso(row.updatedAt),
    });
  };
  // An explicit off switch also applies to previously generated AI output.
  return cached(
    s,
    row,
    allow ? "consistency" : "consistency:heuristic",
    DossierConsistency,
    force,
    compute,
  );
}
export async function refreshConsistency(s: Services, row: CaseRow) {
  try {
    await analyzeConsistency(s, row);
    const { evaluateCaseNearReady } = await import("./near-ready");
    await evaluateCaseNearReady(s, row);
  } catch {
    /* The case version is durable; a later read or maintenance retries it. */
  }
}
export function scheduleCopilot(s: Services, row: CaseRow) {
  try {
    s.background?.(async () => {
      try {
        const current = await caseById(s.db, row.id, row.organizationId);
        if (current.status !== "closed") {
          await analyzeConsistency(s, current);
          const { evaluateCaseNearReady } = await import("./near-ready");
          await evaluateCaseNearReady(s, current);
        }
      } catch {
        /* A later read or maintenance run recovers the version. */
      }
    });
  } catch {
    /* Host shutdown: keep the persisted case available for recovery. */
  }
}
async function prefill(s: Services, row: CaseRow) {
  const allow = await enabled(s, row.organizationId);
  const compute = async () => {
    const { dsuReadTask, dsuPrefillTask, DsuReadInput } = await import("@avanti/ai/operator-tasks");
    const dossier = await dossierView(s.db, row, s.clock());
    const d = copilotDossier(dossier);
    const slots = dsuPrefillSlots(dossier.dsuSheet, d);
    const candidates: DsuPrefillField[] = [];
    let readWithAi = false;
    if (allow && s.ai.configured)
      for (const document of dossier.documents.filter((doc) =>
        slots.some((slot) => slot.documentIds.includes(doc.id)),
      )) {
        const docSlots = slots.filter((slot) => slot.documentIds.includes(document.id));
        const [stored] = await s.db
          .select()
          .from(documents)
          .where(and(eq(documents.id, document.id), eq(documents.caseId, row.id)));
        if (!stored) continue;
        const mime = DsuReadInput.shape.mime.safeParse(stored.mimeType);
        if (!mime.success) continue;
        try {
          const bytes = await s.storage.get(stored.storageKey);
          const read = await run(
            s,
            row,
            dsuReadTask,
            { bytes, mime: mime.data, documentId: stored.id, pages: stored.pages, slots: docSlots },
            allow,
          );
          readWithAi ||= read.engine === "ai";
          for (const field of read.output.fields) {
            const slot = docSlots.find((slot) => slot.fieldId === field.fieldId)!;
            candidates.push({
              sectionId: slot.sectionId,
              fieldId: `${slot.fieldId}~${createHash("sha256")
                .update(JSON.stringify([stored.id, stored.sha256, field.value, field.page]))
                .digest("hex")
                .slice(0, 16)}`,
              label: slot.label,
              value: field.value,
              documentId: stored.id,
              page: field.page,
              confidence: field.confidence,
              note: field.quote,
            });
          }
        } catch {
          /* An unavailable or unreadable file never produces invented values. */
        }
      }
    const result = await run(s, row, dsuPrefillTask, { candidates }, allow);
    const decisions = await s.db
      .select()
      .from(prefillDecisions)
      .where(eq(prefillDecisions.caseId, row.id));
    return DsuPrefill.parse({
      fields: result.output.fields.filter(
        (f) =>
          !decisions.some(
            (decision) =>
              decision.fieldId === f.fieldId &&
              decision.field.documentId === f.documentId &&
              decision.field.value === f.value &&
              decision.field.page === f.page,
          ),
      ),
      engine: readWithAi || result.engine === "ai" ? "ai" : "heuristic",
      generatedAt: s.clock().toISOString(),
      caseVersion: iso(row.updatedAt),
    });
  };
  return cached(
    s,
    row,
    allow ? "dsu-prefill" : "dsu-prefill:heuristic",
    DsuPrefill,
    false,
    compute,
  );
}
const chunksFor = (
  question: string,
  practiceId?: z.infer<typeof OperatorAskRequest>["practiceId"],
) =>
  normativeRetriever
    .search(question, practiceId)
    .map(({ chunk }) => ({ ...citationFor(chunk), text: chunk.text }));
export function mountCopilot(app: App, s: Services) {
  for (const method of ["get", "post"] as const)
    app[method]("/cases/:id/ai/brief", async (c) => {
      const row = await caseById(
        s.db,
        parse(Id, c.req.param("id")),
        c.get("operator").organizationId,
      );
      const allow = await enabled(s, row.organizationId);
      const compute = async () => {
        const { dossierBriefTask } = await import("@avanti/ai/operator-tasks");
        const d = copilotDossier(await dossierView(s.db, row, s.clock()));
        const result = await run(s, row, dossierBriefTask, d, allow);
        return DossierBrief.parse({
          ...result.output,
          situation: stripInternalIds(result.output.situation),
          nextStepReason: stripInternalIds(result.output.nextStepReason),
          missing: heuristicBrief(d).missing,
          attention: result.output.attention.map((a) => ({
            ...a,
            text: stripInternalIds(a.text),
            evidence: resolveEvidence(a.evidence, d),
          })),
          engine: result.engine,
          model: result.model,
          generatedAt: s.clock().toISOString(),
          caseVersion: iso(row.updatedAt),
        });
      };
      return c.json(
        await cached(
          s,
          row,
          allow ? "brief" : "brief:heuristic",
          DossierBrief,
          method === "post",
          compute,
        ),
      );
    });
  app.get("/cases/:id/ai/consistency", async (c) => {
    const row = await caseById(
      s.db,
      parse(Id, c.req.param("id")),
      c.get("operator").organizationId,
    );
    return c.json(await analyzeConsistency(s, row));
  });
  app.get("/cases/:id/ai/dsu-prefill", async (c) => {
    const row = await caseById(
      s.db,
      parse(Id, c.req.param("id")),
      c.get("operator").organizationId,
    );
    return c.json(await prefill(s, row));
  });
  for (const decision of ["accept", "reject"] as const)
    app.post(`/cases/:id/ai/dsu-prefill/:fieldId/${decision}`, async (c) => {
      const actor = c.get("operator");
      const fieldId = parse(SafeText.min(1).max(200), c.req.param("fieldId"));
      const result = await s.db.transaction(async (tx) => {
        await lockOperatorAccess(tx, c, s);
        const row = await caseById(tx, parse(Id, c.req.param("id")), actor.organizationId, true);
        if (!["in_review", "needs_citizen"].includes(row.status))
          throw new ApiFailure(
            "conflict",
            409,
            "Apri il fascicolo in revisione prima di confermare i valori.",
          );
        const [cache] = await tx
          .select()
          .from(copilotCache)
          .where(
            and(
              eq(copilotCache.caseId, row.id),
              eq(copilotCache.caseVersion, iso(row.updatedAt)),
              eq(copilotCache.task, "dsu-prefill"),
            ),
          );
        const proposals = DsuPrefill.safeParse(cache?.payload).data;
        const field = proposals?.fields.find((f) => f.fieldId === fieldId);
        if (!field || !proposals) throw conflict();
        const [doc] = await tx
          .select()
          .from(documents)
          .where(and(eq(documents.id, field.documentId), eq(documents.caseId, row.id)));
        const dossier = await dossierView(tx, row, s.clock());
        if (
          !doc ||
          !dsuPrefillSlots(dossier.dsuSheet, copilotDossier(dossier)).some(
            (slot) => prefillMatchesSlot(field, slot) && slot.documentIds.includes(doc.id),
          )
        )
          throw conflict();
        const value = {
          caseId: row.id,
          fieldId,
          field,
          documentHash: doc.sha256,
          decision: decision === "accept" ? ("accepted" as const) : ("rejected" as const),
          operatorId: actor.id,
          decidedAt: s.clock().toISOString(),
        };
        await tx
          .insert(prefillDecisions)
          .values(value)
          .onConflictDoUpdate({
            target: [prefillDecisions.caseId, prefillDecisions.fieldId],
            set: value,
          });
        const version = nextCaseUpdate(row, s.clock());
        await tx.update(cases).set({ updatedAt: version }).where(eq(cases.id, row.id));
        // Only a decision changed: carry remaining readings forward for batch confirmation.
        await tx.insert(copilotCache).values({
          caseId: row.id,
          caseVersion: version,
          task: "dsu-prefill",
          payload: {
            ...proposals,
            fields: proposals.fields.filter((f) => f.fieldId !== fieldId),
            caseVersion: version,
          },
          leaseToken: crypto.randomUUID(),
          leaseUntil: s.clock().toISOString(),
        });
        // Event identifiers contain only the field's stable identifier, never its value.
        await audit(
          tx,
          row,
          "operator",
          `dsu_prefill.${value.decision}:${fieldId}`,
          s.clock(),
          actor.id,
        );
        return PrefillDecisionResponse.parse({ fieldId, decision: value.decision });
      });
      return c.json(result);
    });
  app.post("/cases/:id/ai/request-draft", async (c) => {
    const input = await body(c, RequestDraftRequest);
    const row = await caseById(
      s.db,
      parse(Id, c.req.param("id")),
      c.get("operator").organizationId,
    );
    const { requestDraftTask } = await import("@avanti/ai/operator-tasks");
    const d = copilotDossier(await dossierView(s.db, row, s.clock()));
    if (input.checklistItemIds.some((id) => !d.checklist.some((i) => i.id === id)))
      throw notFound();
    const result = await run(
      s,
      row,
      requestDraftTask,
      { items: d.checklist.filter((i) => input.checklistItemIds.includes(i.id)) },
      await enabled(s, row.organizationId),
    );
    return c.json(RequestDraftResponse.parse({ ...result.output, engine: result.engine }));
  });
  app.post("/ai/ask", async (c) => {
    const input = await body(c, OperatorAskRequest);
    const question = redactContact(input.question);
    const chunks = chunksFor(question, input.practiceId);
    const { operatorAskTask } = await import("@avanti/ai/operator-tasks");
    const row = { organizationId: c.get("operator").organizationId };
    const result = await run(
      s,
      row,
      operatorAskTask,
      { ...input, question, chunks },
      await enabled(s, row.organizationId),
    );
    return c.json(
      OperatorAskResponse.parse({
        ...result.output,
        citations: chunks
          .filter((chunk) => result.output.citations.includes(chunk.id))
          .map(({ text: _text, ...citation }) => citation),
        engine: result.engine,
      }),
    );
  });
  app.post("/cases/:id/ai/reply-draft", async (c) => {
    const input = await body(c, ReplyDraftRequest);
    const row = await caseById(
      s.db,
      parse(Id, c.req.param("id")),
      c.get("operator").organizationId,
    );
    const dossier = await dossierView(s.db, row, s.clock());
    const message = dossier.messages.find((m) => m.id === input.messageId && m.role === "citizen");
    if (!message) throw notFound();
    const question = redactContact(message.originalText ?? message.text).slice(0, 3000);
    const chunks = chunksFor(question, row.practiceId ?? undefined);
    const { replyDraftTask } = await import("@avanti/ai/operator-tasks");
    const result = await run(
      s,
      row,
      replyDraftTask,
      { question, chunks, dossier: copilotDossier(dossier) },
      await enabled(s, row.organizationId),
    );
    return c.json(
      ReplyDraftResponse.parse({
        ...result.output,
        citations: chunks
          .filter((chunk) => result.output.citations.includes(chunk.id))
          .map(({ text: _text, ...citation }) => citation),
        engine: result.engine,
      }),
    );
  });
}

export async function recoverCopilot(s: Services, caseId?: string) {
  const rows = await s.db
    .select()
    .from(cases)
    .where(
      and(
        caseId ? eq(cases.id, caseId) : undefined,
        sql`${cases.status} in ('submitted','in_review','needs_citizen')`,
        sql`not exists (select 1 from ${copilotCache} where ${copilotCache.caseId}=${cases.id} and ${copilotCache.caseVersion}=${cases.updatedAt} and ${copilotCache.task} in ('consistency','consistency:heuristic') and ${copilotCache.payload} is not null)`,
      ),
    )
    .orderBy(cases.updatedAt, cases.id)
    .limit(2);
  for (const row of rows) {
    try {
      await analyzeConsistency(s, row);
    } catch {
      /* Lease and case version allow a later retry. */
    }
  }
}
