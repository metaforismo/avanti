import { and, eq, desc, lt, or, ilike, sql, count, gte } from "drizzle-orm";
import {
  cases,
  offices,
  operators,
  checklistReviews,
  messages,
  events,
  settings,
} from "@avanti/db";
import {
  CaseListQuery,
  CreateCaseRequest,
  UpdateCaseRequest,
  ReviewChecklistItemRequest,
  RequestFromCitizenRequest,
  ExportFormat,
  MetricsQuery,
  CaseStatus,
} from "@avanti/contracts";
import { body, parse, type App, type Services } from "./context";
import {
  caseById,
  dossierView,
  citizenView,
  caseListViews,
  audit,
  iso,
  minutes,
  type CaseRow,
} from "./dossier";
import { createCase, download } from "./citizen";
import { ApiFailure, notFound } from "./security";
import { exportPdf } from "./export";
import { calculateMetrics, metricsRange } from "./operator-metrics";

const transitions: Record<CaseRow["status"], CaseRow["status"][]> = {
  intake: ["closed"],
  submitted: ["in_review", "closed"],
  in_review: ["needs_citizen", "ready", "closed"],
  needs_citizen: ["in_review", "closed"],
  ready: ["in_review", "closed"],
  closed: ["in_review"],
};
const emptyCounts = () =>
  Object.fromEntries(CaseStatus.options.map((status) => [status, 0])) as Record<
    CaseRow["status"],
    number
  >;
export function mountOperatorRoutes(app: App, s: Services) {
  app.get("/cases", async (c) => {
    const query = parse(CaseListQuery, c.req.query());
    const operator = c.get("operator");
    const filters = [eq(cases.organizationId, operator.organizationId)];
    if (query.practiceId) filters.push(eq(cases.practiceId, query.practiceId));
    if (query.officeId) filters.push(eq(cases.officeId, query.officeId));
    if (query.assignee === "none") filters.push(sql`${cases.assigneeId} is null`);
    else if (query.assignee)
      filters.push(eq(cases.assigneeId, query.assignee === "me" ? operator.id : query.assignee));
    if (query.q) {
      const term = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(
        or(
          ilike(cases.reference, term),
          sql`coalesce(${cases.contact}->>'firstName','') || ' ' || coalesce(${cases.contact}->>'lastName','') ilike ${term}`,
        )!,
      );
    }
    const totals = await s.db
      .select({ status: cases.status, total: count() })
      .from(cases)
      .where(and(...filters))
      .groupBy(cases.status);
    const counts = emptyCounts();
    for (const t of totals) counts[t.status] = t.total;
    if (query.status) filters.push(eq(cases.status, query.status));
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      filters.push(
        or(
          lt(cases.updatedAt, cursor.at),
          and(eq(cases.updatedAt, cursor.at), lt(cases.id, cursor.id)),
        )!,
      );
    }
    const rows = await s.db
      .select()
      .from(cases)
      .where(and(...filters))
      .orderBy(desc(cases.updatedAt), desc(cases.id))
      .limit(query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const items = await caseListViews(s.db, page, s.clock());
    return c.json({
      items,
      counts,
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(JSON.stringify({ at: iso(last.updatedAt), id: last.id })).toString(
              "base64url",
            )
          : null,
    });
  });
  app.post("/cases", async (c) => {
    const input = await body(c, CreateCaseRequest);
    const operator = c.get("operator");
    const [office] = await s.db
      .select()
      .from(offices)
      .where(
        and(eq(offices.id, input.officeId), eq(offices.organizationId, operator.organizationId)),
      )
      .limit(1);
    if (!office) throw notFound();
    const { row, token } = await s.db.transaction(async (tx) => {
      const created = await createCase(
        tx,
        office,
        { ...input, contact: input.citizen },
        s.clock(),
        "operator",
        operator.id,
      );
      await audit(tx, created.row, "operator", "case.link_created", s.clock(), operator.id);
      return created;
    });
    return c.json(
      {
        case: {
          ...(await dossierView(s.db, row, s.clock())),
          citizenLink: `${s.publicUrl.replace(/\/$/, "")}/pratica/${token}`,
        },
        citizenLink: `${s.publicUrl.replace(/\/$/, "")}/pratica/${token}`,
      },
      201,
    );
  });
  app.get("/cases/:id", async (c) => {
    const operator = c.get("operator");
    const row = await caseById(s.db, c.req.param("id"), operator.organizationId);
    return c.json(await dossierView(s.db, row, s.clock()));
  });
  app.patch("/cases/:id", async (c) => {
    const input = await body(c, UpdateCaseRequest);
    const operator = c.get("operator");
    const row = await s.db.transaction(async (tx) => {
      const current = await caseById(tx, c.req.param("id"), operator.organizationId, true);
      if (input.assigneeId) {
        const [assignee] = await tx
          .select()
          .from(operators)
          .where(
            and(
              eq(operators.id, input.assigneeId),
              eq(operators.organizationId, operator.organizationId),
            ),
          );
        if (!assignee) throw notFound();
      }
      if (
        input.status &&
        input.status !== current.status &&
        !transitions[current.status].includes(input.status)
      )
        throw new ApiFailure("conflict", 409, "Passaggio di stato non consentito.");
      if (input.status === "ready") {
        const view = await citizenView(tx, current, s.clock(), "it", true);
        if (
          !current.practiceId ||
          view.nextQuestion ||
          view.findings.some((f) => f.severity === "blocker") ||
          view.checklist.some((i) => i.required && i.status !== "verified" && i.status !== "waived")
        )
          throw new ApiFailure(
            "conflict",
            409,
            "Verifica tutte le voci obbligatorie prima di segnare il fascicolo pronto.",
          );
      }
      const now = s.clock();
      const [updated] = await tx
        .update(cases)
        .set({
          ...input,
          ...(input.status === "closed" ? { expiresAt: now.toISOString() } : {}),
          ...(input.status && input.status !== current.status
            ? { closedAt: input.status === "closed" ? now.toISOString() : null }
            : {}),
          ...(input.status === "in_review" && !current.reviewStartedAt
            ? { reviewStartedAt: now.toISOString() }
            : {}),
          ...(input.status === "ready" && current.status !== "ready"
            ? { reviewCompletedAt: now.toISOString() }
            : {}),
          updatedAt: now.toISOString(),
        })
        .where(and(eq(cases.id, current.id), eq(cases.organizationId, operator.organizationId)))
        .returning();
      if (!updated) throw notFound();
      if (input.status === "ready" && current.status !== "ready") {
        await audit(tx, updated, "operator", "review.completed", now, operator.id, {
          durationMinutes: minutes(updated.reviewStartedAt, updated.reviewCompletedAt),
        });
      }
      if (input.status === "in_review" && current.status !== "in_review")
        await audit(
          tx,
          updated,
          "operator",
          current.status === "closed" ? "case.reopened" : "review.started",
          now,
          operator.id,
        );
      if (input.status && input.status !== current.status && input.status !== "in_review") {
        const eventType = current.status === "closed" ? "case.reopened" : `case.${input.status}`;
        await audit(tx, updated, "operator", eventType, now, operator.id);
      }
      if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId)
        await audit(tx, updated, "operator", "case.assigned", now, operator.id);
      if (input.internalNotes !== undefined)
        await audit(tx, updated, "operator", "case.note_updated", now, operator.id);
      return updated;
    });
    return c.json(await dossierView(s.db, row, s.clock()));
  });
  app.post("/cases/:id/checklist/:itemId/review", async (c) => {
    const input = await body(c, ReviewChecklistItemRequest);
    const operator = c.get("operator");
    const row = await s.db.transaction(async (tx) => {
      const current = await caseById(tx, c.req.param("id"), operator.organizationId, true);
      if (!["in_review", "needs_citizen"].includes(current.status))
        throw new ApiFailure(
          "conflict",
          409,
          "Apri il fascicolo in revisione prima di verificare le voci.",
        );
      const view = await citizenView(tx, current, s.clock(), "it", true);
      const item = view.checklist.find((i) => i.id === c.req.param("itemId"));
      if (!item) throw notFound();
      if (input.decision === "verified" && !item.documentIds.length)
        throw new ApiFailure("conflict", 409, "Carica il documento prima della verifica.");
      if ((input.decision === "rejected" || input.decision === "waived") && !input.note)
        throw new ApiFailure("bad_request", 400, "Spiega il motivo della decisione.");
      const predicate = and(
        eq(checklistReviews.caseId, current.id),
        eq(checklistReviews.itemId, item.id),
      );
      if (input.decision === "reset") await tx.delete(checklistReviews).where(predicate);
      else
        await tx
          .insert(checklistReviews)
          .values({
            caseId: current.id,
            itemId: item.id,
            decision: input.decision,
            note: input.note ?? null,
            operatorId: operator.id,
            reviewedAt: s.clock().toISOString(),
          })
          .onConflictDoUpdate({
            target: [checklistReviews.caseId, checklistReviews.itemId],
            set: {
              decision: input.decision,
              note: input.note ?? null,
              operatorId: operator.id,
              reviewedAt: s.clock().toISOString(),
            },
          });
      const [updated] = await tx
        .update(cases)
        .set({ updatedAt: s.clock().toISOString() })
        .where(and(eq(cases.id, current.id), eq(cases.organizationId, operator.organizationId)))
        .returning();
      if (!updated) throw notFound();
      await audit(tx, updated, "operator", `checklist.${input.decision}`, s.clock(), operator.id);
      return updated;
    });
    return c.json(await dossierView(s.db, row, s.clock()));
  });
  app.post("/cases/:id/requests", async (c) => {
    const input = await body(c, RequestFromCitizenRequest);
    const operator = c.get("operator");
    const initial = await caseById(s.db, c.req.param("id"), operator.organizationId);
    const translated = await s.ai.translate(input.message, initial.language);
    const row = await s.db.transaction(async (tx) => {
      const current = await caseById(tx, initial.id, operator.organizationId, true);
      if (current.language !== initial.language) {
        throw new ApiFailure(
          "conflict",
          409,
          "La lingua del cittadino è cambiata. Riprova la richiesta.",
        );
      }
      if (!["in_review", "needs_citizen"].includes(current.status))
        throw new ApiFailure(
          "conflict",
          409,
          "Apri il fascicolo in revisione prima di chiedere un'integrazione.",
        );
      const view = await citizenView(tx, current, s.clock(), "it", true);
      if (input.checklistItemIds.some((id) => !view.checklist.some((i) => i.id === id)))
        throw notFound();
      const localized = await citizenView(tx, current, s.clock());
      const selected = localized.checklist.filter((item) =>
        input.checklistItemIds.includes(item.id),
      );
      if (selected.length)
        await tx
          .insert(checklistReviews)
          .values(
            selected.map((item) => ({
              caseId: current.id,
              itemId: item.id,
              decision: "rejected" as const,
              note: input.message,
              operatorId: operator.id,
              reviewedAt: s.clock().toISOString(),
            })),
          )
          .onConflictDoUpdate({
            target: [checklistReviews.caseId, checklistReviews.itemId],
            set: {
              decision: "rejected",
              note: input.message,
              operatorId: operator.id,
              reviewedAt: s.clock().toISOString(),
            },
          });
      const labels = selected
        .map((item) => `${item.title}${item.memberName ? ` · ${item.memberName}` : ""}`)
        .join("\n");
      const italianLabels = view.checklist
        .filter((item) => input.checklistItemIds.includes(item.id))
        .map((item) => `${item.title}${item.memberName ? ` · ${item.memberName}` : ""}`)
        .join("\n");
      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        caseId: current.id,
        role: "operator",
        text: [translated.text, labels].filter(Boolean).join("\n"),
        originalText: [input.message, italianLabels].filter(Boolean).join("\n"),
        createdAt: s.clock().toISOString(),
      });
      const [updated] = await tx
        .update(cases)
        .set({ status: "needs_citizen", updatedAt: s.clock().toISOString() })
        .where(and(eq(cases.id, current.id), eq(cases.organizationId, operator.organizationId)))
        .returning();
      if (!updated) throw notFound();
      await audit(tx, updated, "operator", "case.requested", s.clock(), operator.id, {
        itemsCount: input.checklistItemIds.length,
        heuristic: translated.engine === "heuristic",
      });
      return updated;
    });
    if (translated.engine) c.header("X-Avanti-Engine", translated.engine);
    return c.json(await dossierView(s.db, row, s.clock()));
  });
  app.get("/cases/:id/export", async (c) => {
    const format = parse(ExportFormat, c.req.query("format") ?? "json");
    const operator = c.get("operator");
    const row = await caseById(s.db, c.req.param("id"), operator.organizationId);
    const dossier = await dossierView(s.db, row, s.clock());
    c.header("Content-Disposition", `attachment; filename="${row.reference}.${format}"`);
    if (format === "json") {
      await audit(s.db, row, "operator", "case.exported", s.clock(), operator.id);
      return c.json(dossier);
    }
    const bytes = await exportPdf(dossier);
    await audit(s.db, row, "operator", "case.exported", s.clock(), operator.id);
    c.header("Content-Type", "application/pdf");
    return c.body(Buffer.from(bytes));
  });
  app.get("/cases/:id/documents/:docId/file", async (c) => {
    const operator = c.get("operator");
    const row = await caseById(s.db, c.req.param("id"), operator.organizationId);
    return download(c, s, row, c.req.param("docId"));
  });
  app.get("/metrics", async (c) => {
    const q = parse(MetricsQuery, c.req.query());
    const { start, end } = metricsRange(q.from, q.to);
    const org = c.get("operator").organizationId;
    const completedInRange = sql`exists (select 1 from ${events} where ${events.caseId} = ${cases.id} and ${events.organizationId} = ${org} and ${events.type} = 'review.completed' and ${events.at} >= ${start.toISOString()}::timestamptz and ${events.at} < ${end.toISOString()}::timestamptz)`;
    const submittedInRange = and(
      gte(cases.submittedAt, start.toISOString()),
      lt(cases.submittedAt, end.toISOString()),
    );
    const rows = await s.db
      .select({
        id: cases.id,
        createdAt: cases.createdAt,
        submittedAt: cases.submittedAt,
        practiceId: cases.practiceId,
        language: cases.language,
        firstSubmissionComplete: cases.firstSubmissionComplete,
        reviewStartedAt: cases.reviewStartedAt,
      })
      .from(cases)
      .where(
        and(
          eq(cases.organizationId, org),
          q.officeId ? eq(cases.officeId, q.officeId) : undefined,
          or(
            and(gte(cases.createdAt, start.toISOString()), lt(cases.createdAt, end.toISOString())),
            submittedInRange,
            completedInRange,
          ),
        ),
      );
    const ev = await s.db
      .select({
        caseId: events.caseId,
        type: events.type,
        at: events.at,
        metadata: events.metadata,
      })
      .from(events)
      .innerJoin(cases, eq(events.caseId, cases.id))
      .where(
        and(
          eq(events.organizationId, org),
          eq(cases.organizationId, org),
          q.officeId ? eq(cases.officeId, q.officeId) : undefined,
          lt(events.at, end.toISOString()),
          or(
            and(eq(events.type, "review.completed"), gte(events.at, start.toISOString())),
            and(sql`${events.type} in ('case.requested', 'citizen.requested')`, submittedInRange),
          ),
        ),
      );
    const [config] = await s.db.select().from(settings).where(eq(settings.organizationId, org));
    return c.json(calculateMetrics(q.from, q.to, rows, ev, config?.baselineMinutesPerCase ?? null));
  });
}

function decodeCursor(cursor: string) {
  try {
    if (cursor.length > 300) throw new Error("Invalid cursor");
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (
      typeof value !== "object" ||
      !value ||
      !("at" in value) ||
      !("id" in value) ||
      typeof value.at !== "string" ||
      typeof value.id !== "string" ||
      value.id.length > 64 ||
      !Number.isFinite(Date.parse(value.at))
    )
      throw new Error("Invalid cursor");
    return { at: new Date(value.at).toISOString(), id: value.id };
  } catch {
    throw new ApiFailure("bad_request", 400, "Pagina non valida.");
  }
}
