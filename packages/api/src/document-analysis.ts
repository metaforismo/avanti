import { and, eq, lt } from "drizzle-orm";
import { cases, documents } from "@avanti/db";
import { DocumentAnalysis } from "@avanti/contracts";
import { heuristicAnalysis } from "./ai";
import { citizenView } from "./dossier";
import type { Services } from "./context";

// The persisted processing row is the retry queue; Next after() is only the fast path.
export async function analyzePendingDocument(s: Services, id: string) {
  const [document] = await s.db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.status, "processing")));
  if (!document) return;
  const [row] = await s.db.select().from(cases).where(eq(cases.id, document.caseId));
  if (!row) return;
  if (row.status === "closed" || Date.parse(row.expiresAt) <= s.clock().getTime()) {
    await s.db
      .update(documents)
      .set({ status: "failed" })
      .where(and(eq(documents.id, id), eq(documents.status, "processing")));
    return;
  }
  const view = await citizenView(s.db, row, s.clock());
  const requirements = [...new Set(view.checklist.map((i) => i.requirementId))];
  const bytes = await s.storage.get(document.storageKey);
  let analysis: DocumentAnalysis;
  try {
    analysis = DocumentAnalysis.parse(
      await s.ai.analyze(bytes, document.mimeType, document.fileName, requirements),
    );
  } catch {
    analysis = heuristicAnalysis(document.fileName, requirements);
  }
  await s.db.transaction(async (tx) => {
    // Case lock shares the erasure/review boundary; late workers cannot recreate deleted data.
    const [current] = await tx.select().from(cases).where(eq(cases.id, row.id)).for("update");
    if (!current) return;
    await tx
      .update(documents)
      .set({ status: current.status === "closed" ? "failed" : "analyzed", analysis })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.caseId, current.id),
          eq(documents.status, "processing"),
        ),
      );
  });
}
export async function recoverDocumentAnalysis(s: Services) {
  const pending = await s.db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.status, "processing"),
        lt(documents.uploadedAt, new Date(s.clock().getTime() - 120000).toISOString()),
      ),
    )
    .orderBy(documents.uploadedAt, documents.id)
    .limit(4);
  const started = performance.now();
  for (const document of pending) {
    if (performance.now() - started >= 45000) break;
    try {
      await analyzePendingDocument(s, document.id);
    } catch {
      /* Storage failures keep the persisted job for the next maintenance run. */
    }
  }
}
