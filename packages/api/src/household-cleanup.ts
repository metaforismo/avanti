import { and, eq } from "drizzle-orm";
import { documents, checklistReviews, type Database } from "@avanti/db";
import { buildHousehold, buildChecklist } from "@avanti/core";
import type { CaseRow } from "./dossier";

export async function detachRemovedMembers(db: Database, before: CaseRow, after: CaseRow) {
  const household = buildHousehold(after.answers);
  const ids = new Set(household.map((member) => member.id));
  const removed = new Set(
    buildHousehold(before.answers)
      .filter((member) => !ids.has(member.id))
      .map((member) => member.id),
  );
  const checklist = after.practiceId
    ? buildChecklist(after.practiceId, after.answers, household, "it")
    : [];
  const items = new Set(checklist.map((item) => item.id));
  const storedDocs = await db.select().from(documents).where(eq(documents.caseId, after.id));
  for (const document of storedDocs) {
    if (
      (document.memberId && removed.has(document.memberId)) ||
      (document.checklistItemId && !items.has(document.checklistItemId))
    ) {
      await db
        .update(documents)
        .set({ memberId: null, checklistItemId: null })
        .where(and(eq(documents.caseId, after.id), eq(documents.id, document.id)));
    }
  }
  const reviews = await db
    .select()
    .from(checklistReviews)
    .where(eq(checklistReviews.caseId, after.id));
  for (const review of reviews) {
    if (!items.has(review.itemId))
      await db
        .delete(checklistReviews)
        .where(
          and(eq(checklistReviews.caseId, after.id), eq(checklistReviews.itemId, review.itemId)),
        );
  }
}
