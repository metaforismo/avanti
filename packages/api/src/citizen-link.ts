import { mutableCitizen } from "./context";
import { eq } from "drizzle-orm";
import { cases, type Database } from "@avanti/db";
import type { CaseRow } from "./dossier";
import { ApiFailure } from "./security";

export function assertCitizenLink(
  current: CaseRow | undefined,
  authorized: CaseRow,
  now: Date,
): asserts current is CaseRow {
  if (
    !current ||
    current.tokenHash !== authorized.tokenHash ||
    current.status === "closed" ||
    Date.parse(current.expiresAt) <= now.getTime()
  )
    throw new ApiFailure(
      "link_expired",
      410,
      "Il link è scaduto o è stato sostituito. Chiedi allo sportello il nuovo link.",
    );
}

export async function currentCitizenLink(
  db: Database,
  authorized: CaseRow,
  now: Date,
  lock = false,
): Promise<CaseRow> {
  const query = db.select().from(cases).where(eq(cases.id, authorized.id));
  const [current] = await (lock ? query.for("update") : query);
  assertCitizenLink(current, authorized, now);
  return current;
}

export async function lockCase(db: Database, row: CaseRow, now: Date) {
  const fresh = await currentCitizenLink(db, row, now, true);
  mutableCitizen(fresh);
  return fresh;
}
