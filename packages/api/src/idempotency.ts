import { createHash } from "node:crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import { idempotencyKeys, type Database } from "@avanti/db";
import { IDEMPOTENCY_HEADER, IdempotencyKey } from "@avanti/contracts";
import type { ApiContext } from "./context";
import { ApiFailure } from "./security";

/** Long enough for any retry of a lost response; short enough not to become a second history. */
export const IDEMPOTENCY_RETENTION_MS = 24 * 3600 * 1000;

export type Idempotent = {
  caseId: string;
  actor: string;
  key: string;
  route: string;
  fingerprint: string;
};
export type IdempotentResult = Record<string, string | null>;

/** Null without the header: older clients keep today's behaviour. */
export function idempotent(
  c: ApiContext,
  scope: { caseId: string; actor: string; route: string },
  input: unknown,
): Idempotent | null {
  const key = c.req.header(IDEMPOTENCY_HEADER);
  if (key === undefined) return null;
  if (!IdempotencyKey.safeParse(key).success)
    throw new ApiFailure("bad_request", 400, "Richiesta non valida. Ricarica la pagina.");
  return { ...scope, key, fingerprint: fingerprint(scope.route, input) };
}

export function fingerprint(route: string, input: unknown) {
  return createHash("sha256")
    .update(route)
    .update("\0")
    .update(JSON.stringify(input ?? null))
    .digest("base64url");
}

/**
 * The result of an earlier attempt with the same key, or null. Inside the write transaction the
 * caller already holds the case lock, so a concurrent attempt either sees the row or waits.
 * `matchInput: false` only compares the route, for checks made before the body is read.
 */
export async function replayOf(
  db: Database,
  action: Idempotent | null,
  now: Date,
  matchInput = true,
): Promise<IdempotentResult | null> {
  if (!action) return null;
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.caseId, action.caseId),
        eq(idempotencyKeys.actor, action.actor),
        eq(idempotencyKeys.key, action.key),
        gt(idempotencyKeys.createdAt, cutoff(now)),
      ),
    );
  if (!row) return null;
  if (row.route !== action.route || (matchInput && row.fingerprint !== action.fingerprint))
    throw new ApiFailure(
      "conflict",
      409,
      "Questa richiesta è già stata usata per un'altra azione. Ricarica la pagina.",
    );
  return row.result;
}

/** Same transaction as the effect: either both are stored or neither is. */
export async function remember(
  tx: Database,
  action: Idempotent | null,
  now: Date,
  result: IdempotentResult = {},
) {
  if (!action) return;
  const values = { ...action, result, createdAt: now.toISOString() };
  await tx
    .insert(idempotencyKeys)
    .values(values)
    .onConflictDoUpdate({
      target: [idempotencyKeys.caseId, idempotencyKeys.actor, idempotencyKeys.key],
      set: {
        route: values.route,
        fingerprint: values.fingerprint,
        result,
        createdAt: values.createdAt,
      },
      setWhere: sql`${idempotencyKeys.createdAt} <= ${cutoff(now)}::timestamptz`,
    });
}

export function purgeIdempotencyKeys(db: Database, now: Date) {
  return db.delete(idempotencyKeys).where(lte(idempotencyKeys.createdAt, cutoff(now)));
}

const cutoff = (now: Date) => new Date(now.getTime() - IDEMPOTENCY_RETENTION_MS).toISOString();
