import { createHmac } from "node:crypto";
import { and, eq, gt, lte, or, sql } from "drizzle-orm";
import { idempotencyKeys, type Database } from "@avanti/db";
import { IDEMPOTENCY_HEADER, IdempotencyKey } from "@avanti/contracts";
import type { ApiContext, Services } from "./context";
import { rateLimitSecret } from "./rate-limit-key";
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
  s: Pick<Services, "rateLimitSecret">,
  c: ApiContext,
  scope: { caseId: string; actor: string; route: string },
  input: unknown,
): Idempotent | null {
  const key = c.req.header(IDEMPOTENCY_HEADER);
  if (key === undefined) return null;
  if (!IdempotencyKey.safeParse(key).success)
    throw new ApiFailure("bad_request", 400, "Richiesta non valida. Ricarica la pagina.");
  return {
    ...scope,
    key,
    fingerprint: fingerprint(rateLimitSecret(s.rateLimitSecret), scope.route, input),
  };
}

/**
 * Keyed, so a copy of the table does not let anyone confirm a guess of what the citizen wrote
 * (short answers like «sì» or a phone number are easy to enumerate against a plain hash).
 */
export function fingerprint(secret: string, route: string, input: unknown) {
  return createHmac("sha256", secret)
    .update("idempotency\0")
    .update(route)
    .update("\0")
    .update(JSON.stringify(input ?? null))
    .digest("base64url");
}

export type ReplayOptions = {
  /** False only compares the route, for checks made before the body is read. */
  matchInput?: boolean;
  /**
   * Whether the effect the first attempt produced is still the latest one for this action. When
   * it is not (the citizen spoke again, the case came back for an integration), the stored key
   * is superseded: the same words now are a new action, not a retry, and must not be swallowed.
   */
  holds?: (result: IdempotentResult) => boolean | Promise<boolean>;
};

/**
 * The result of an earlier attempt with the same key, or null. Inside the write transaction the
 * caller already holds the case lock, so a concurrent attempt either sees the row or waits.
 */
export async function replayOf(
  db: Database,
  action: Idempotent | null,
  now: Date,
  { matchInput = true, holds }: ReplayOptions = {},
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
  if (holds && !(await holds(row.result))) return null;
  return row.result;
}

/**
 * Same transaction as the effect: either both are stored or neither is. A live row is replaced
 * only when it records this same action (route and fingerprint), which the caller reaches only
 * after `replayOf` found it superseded under the case lock.
 */
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
      setWhere: or(
        sql`${idempotencyKeys.createdAt} <= ${cutoff(now)}::timestamptz`,
        and(
          eq(idempotencyKeys.route, values.route),
          eq(idempotencyKeys.fingerprint, values.fingerprint),
        ),
      ),
    });
}

export function purgeIdempotencyKeys(db: Database, now: Date) {
  return db.delete(idempotencyKeys).where(lte(idempotencyKeys.createdAt, cutoff(now)));
}

const cutoff = (now: Date) => new Date(now.getTime() - IDEMPOTENCY_RETENTION_MS).toISOString();
