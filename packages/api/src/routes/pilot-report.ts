import { and, eq, gte, lt, sql, inArray } from "drizzle-orm";
import { cases, events, offices, operators, settings } from "@avanti/db";
import { PilotReportQuery } from "@avanti/contracts";
import { parse, type App, type Services } from "../context";
import { ApiFailure, notFound } from "../security";
import { recordActivity } from "../audit-log";
import { calculatePilotReport, pilotReportRange } from "../pilot-report";
import { pilotReportCsv, pilotReportPdf } from "../pilot-report-export";

export function mountPilotReportRoutes(app: App, s: Services) {
  app.get("/reports/pilot", async (c) => {
    const actor = c.get("operator");
    const forbidden = () =>
      new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
    if (actor.role !== "admin") throw forbidden();
    const q = parse(PilotReportQuery, c.req.query());
    const now = s.clock();
    const { start, end } = pilotReportRange(q);
    const observedEnd = new Date(Math.min(end.getTime(), now.getTime())).toISOString();
    const result = await s.db.transaction(async (tx) => {
      await tx.execute(sql`set transaction isolation level repeatable read`);
      const [current] = await tx
        .select()
        .from(operators)
        .where(and(eq(operators.id, actor.id), eq(operators.organizationId, actor.organizationId)))
        .for("share");
      if (!current?.active || current.mustChangePassword || current.role !== "admin")
        throw forbidden();
      const officeRows = await tx
        .select({ id: offices.id, name: offices.name })
        .from(offices)
        .where(
          and(
            eq(offices.organizationId, actor.organizationId),
            q.office ? eq(offices.id, q.office) : undefined,
          ),
        )
        .orderBy(offices.id);
      if (q.office && !officeRows.length) throw notFound();
      const cohortFilter = and(
        eq(cases.organizationId, actor.organizationId),
        gte(cases.createdAt, start.toISOString()),
        lt(cases.createdAt, observedEnd),
        q.office ? eq(cases.officeId, q.office) : undefined,
      );
      // Select only measurement columns; no contacts, answers, notes, documents or access tokens.
      const rows = await tx
        .select({
          id: cases.id,
          officeId: cases.officeId,
          createdAt: cases.createdAt,
          submittedAt: cases.submittedAt,
          firstSubmissionComplete: cases.firstSubmissionComplete,
          reviewStartedAt: cases.reviewStartedAt,
          practiceId: cases.practiceId,
          language: cases.language,
        })
        .from(cases)
        .where(cohortFilter);
      const eventRows = await tx
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
            cohortFilter,
            eq(events.organizationId, actor.organizationId),
            gte(events.at, start.toISOString()),
            lt(events.at, observedEnd),
            inArray(events.type, ["case.requested", "citizen.requested", "review.completed"]),
          ),
        );
      const [config] = await tx
        .select({ baseline: settings.baselineMinutesPerCase })
        .from(settings)
        .where(eq(settings.organizationId, actor.organizationId));
      const report = calculatePilotReport(
        q,
        rows,
        eventRows,
        officeRows,
        config?.baseline ?? null,
        now,
      );
      const content =
        q.format === "pdf"
          ? Buffer.from(await pilotReportPdf(report))
          : q.format === "csv"
            ? pilotReportCsv(report)
            : JSON.stringify(report);
      await recordActivity(tx, actor.organizationId, actor.id, "pilot_report.exported", now, null, {
        reportJson: q.format === "json",
        reportCsv: q.format === "csv",
        reportPdf: q.format === "pdf",
      });
      return content;
    });
    c.header("Cache-Control", "private, no-store");
    c.header(
      "Content-Type",
      q.format === "pdf"
        ? "application/pdf"
        : q.format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/json; charset=utf-8",
    );
    c.header(
      "Content-Disposition",
      `attachment; filename="rapporto-pilota-${q.from}-${q.to}.${q.format}"`,
    );
    return c.body(result);
  });
}
