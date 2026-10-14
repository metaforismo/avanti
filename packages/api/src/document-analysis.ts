import { and, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import { cases, documents } from "@avanti/db";
import { DocumentAnalysis } from "@avanti/contracts";
import { heuristicAnalysis } from "./ai";
import { observeAi, recordOperationalCounters } from "./operational-telemetry";
import { citizenView } from "./dossier";
import { deadline } from "./deadline";
import { nextCaseUpdate } from "./case-version";
import type { Services } from "./context";

export const ANALYSIS_LEASE_MS = 120_000;

function expiredLease(now: Date) {
  return or(
    isNull(documents.analysisLeaseUntil),
    lte(documents.analysisLeaseUntil, now.toISOString()),
  );
}
function recoverable(now: Date) {
  return and(
    eq(documents.status, "processing"),
    expiredLease(now),
    lt(documents.uploadedAt, new Date(now.getTime() - ANALYSIS_LEASE_MS).toISOString()),
  );
}

// The row is the durable queue. Every worker, including upload after(), must own a lease.
export async function analyzePendingDocument(s: Services, id: string, recovery = false) {
  const now = s.clock();
  const token = crypto.randomUUID();
  const [document] = await s.db
    .update(documents)
    .set({
      analysisLeaseToken: token,
      analysisLeaseUntil: new Date(now.getTime() + ANALYSIS_LEASE_MS).toISOString(),
    })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.status, "processing"),
        expiredLease(now),
        recovery ? recoverable(now) : undefined,
      ),
    )
    .returning();
  if (!document) return;
  const ownsLease = and(
    eq(documents.id, id),
    eq(documents.status, "processing"),
    eq(documents.analysisLeaseToken, token),
  );
  const [row] = await s.db.select().from(cases).where(eq(cases.id, document.caseId));
  if (!row) return;
  if (row.status === "closed" || Date.parse(row.expiresAt) <= now.getTime()) {
    await s.db.transaction(async (tx) => {
      const [current] = await tx.select().from(cases).where(eq(cases.id, row.id)).for("update");
      if (!current) return;
      const changed = await tx
        .update(documents)
        .set({ status: "failed", analysisLeaseToken: null, analysisLeaseUntil: null })
        .where(ownsLease)
        .returning({ id: documents.id });
      if (changed.length)
        await tx
          .update(cases)
          .set({ updatedAt: nextCaseUpdate(current, s.clock()) })
          .where(eq(cases.id, current.id));
    });
    return;
  }
  const view = await citizenView(s.db, row, s.clock());
  const requirements = [...new Set(view.checklist.map((i) => i.requirementId))];
  const bytes = await deadline(s.storage.get(document.storageKey), 10_000);
  let analysis: DocumentAnalysis;
  try {
    analysis = await observeAi(s, row.organizationId, async () =>
      DocumentAnalysis.parse(
        await deadline(
          s.ai.analyze(bytes, document.mimeType, document.fileName, requirements),
          25_000,
        ),
      ),
    );
  } catch {
    analysis = heuristicAnalysis(document.fileName, requirements);
    await recordOperationalCounters(s, row.organizationId, ["ai_fallback"]);
  }
  await s.db.transaction(async (tx) => {
    // Share the erasure/review boundary; a stale or late worker cannot restore deleted data.
    const [current] = await tx.select().from(cases).where(eq(cases.id, row.id)).for("update");
    if (!current) return;
    const finished = s.clock();
    const changed = await tx
      .update(documents)
      .set({
        status:
          current.status === "closed" || Date.parse(current.expiresAt) <= finished.getTime()
            ? "failed"
            : "analyzed",
        analysis,
        analysisLeaseToken: null,
        analysisLeaseUntil: null,
      })
      .where(
        and(
          ownsLease,
          eq(documents.caseId, current.id),
          gt(documents.analysisLeaseUntil, finished.toISOString()),
        ),
      )
      .returning({ id: documents.id });
    if (changed.length)
      await tx
        .update(cases)
        .set({ updatedAt: nextCaseUpdate(current, finished) })
        .where(eq(cases.id, current.id));
  });
}

export async function recoverDocumentAnalysis(s: Services, caseId?: string) {
  const pending = await s.db
    .select({ id: documents.id })
    .from(documents)
    .where(and(recoverable(s.clock()), caseId ? eq(documents.caseId, caseId) : undefined))
    .orderBy(documents.uploadedAt, documents.id)
    .limit(4);
  const started = performance.now();
  for (const document of pending) {
    if (performance.now() - started >= 45_000) break;
    try {
      await analyzePendingDocument(s, document.id, true);
    } catch {
      // Keep the lease until expiry: storage outages must not turn polling into a retry storm.
    }
  }
}

export function scheduleDocumentRecovery(s: Services, caseId: string) {
  try {
    s.background?.(async () => {
      try {
        await recoverDocumentAnalysis(s, caseId);
      } catch {
        /* Retry via a later read or cron without logging database details. */
      }
    });
  } catch {
    // A host shutting down may reject scheduling; the daily job still sees the persisted row.
  }
}
