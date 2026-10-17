import { and, asc, eq, inArray } from "drizzle-orm";
import { AssignCasesRequest, type AssignCasesResponse } from "@avanti/contracts";
import { cases, operators } from "@avanti/db";
import { body, type App, type Services } from "./context";
import { audit, iso } from "./dossier";
import { markOperatorWork, nextCaseUpdate } from "./case-version";
import { lockOperatorAccess } from "./operator-access";
import { ApiFailure, notFound } from "./security";

const adminOnly = () =>
  new ApiFailure("forbidden", 403, "Solo un amministratore può assegnare le pratiche ai colleghi.");

/**
 * One transaction, one outcome per case. At the January peak the queue changes every few
 * seconds: an all-or-nothing batch of 100 would keep failing for a single case touched by a
 * citizen or a colleague. Changed cases are reported and left alone, never overwritten.
 */
export function mountCaseAssignment(app: App, s: Services) {
  app.post("/cases/assign", async (c) => {
    if (c.get("operator").role !== "admin") throw adminOnly();
    const input = await body(c, AssignCasesRequest);
    const result = await s.db.transaction(async (tx): Promise<AssignCasesResponse> => {
      const actor = await lockOperatorAccess(tx, c, s);
      if (actor.role !== "admin") throw adminOnly();
      // Assigning is operator work: it must not withdraw a «quasi pronta» suggestion.
      await markOperatorWork(tx);
      let assignee: AssignCasesResponse["assignee"] = null;
      if (input.assigneeId) {
        // Shared lock: a deactivation cannot commit between this check and the assignment.
        const [target] = await tx
          .select({ id: operators.id, name: operators.name, active: operators.active })
          .from(operators)
          .where(
            and(
              eq(operators.id, input.assigneeId),
              eq(operators.organizationId, actor.organizationId),
            ),
          )
          .for("share");
        if (!target) throw notFound();
        if (!target.active)
          throw new ApiFailure(
            "conflict",
            409,
            "Questo operatore non è più attivo. Scegli un altro collega.",
          );
        assignee = { id: target.id, name: target.name };
      }
      // Ordered locks: two overlapping batches wait for each other instead of deadlocking.
      const rows = await tx
        .select()
        .from(cases)
        .where(
          and(
            inArray(
              cases.id,
              input.cases.map((item) => item.id),
            ),
            eq(cases.organizationId, actor.organizationId),
          ),
        )
        .orderBy(asc(cases.id))
        .for("update");
      const byId = new Map(rows.map((row) => [row.id, row]));
      const now = s.clock();
      const results: AssignCasesResponse["results"] = [];
      for (const item of input.cases) {
        const row = byId.get(item.id);
        if (!row) {
          results.push({ id: item.id, outcome: "not_found", updatedAt: null });
          continue;
        }
        const target = assignee?.id ?? null;
        if (row.assigneeId === target) {
          results.push({ id: row.id, outcome: "unchanged", updatedAt: iso(row.updatedAt) });
          continue;
        }
        if (Date.parse(item.expectedUpdatedAt) !== Date.parse(row.updatedAt)) {
          results.push({ id: row.id, outcome: "conflict", updatedAt: iso(row.updatedAt) });
          continue;
        }
        const updatedAt = nextCaseUpdate(row, now);
        await tx
          .update(cases)
          .set({ assigneeId: target, updatedAt })
          .where(and(eq(cases.id, row.id), eq(cases.organizationId, actor.organizationId)));
        await audit(tx, row, "operator", "case.assigned", now, actor.id, { bulk: true });
        results.push({ id: row.id, outcome: "assigned", updatedAt: iso(updatedAt) });
      }
      return { assignee, results };
    });
    c.header("Cache-Control", "private, no-store");
    return c.json(result);
  });
}
