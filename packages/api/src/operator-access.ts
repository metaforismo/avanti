import { and, eq } from "drizzle-orm";
import { operators, organizations, sessions, settings, type Database } from "@avanti/db";
import type { ApiContext, Services } from "./context";
import { ApiFailure } from "./security";
import { ABSOLUTE_SESSION_SECONDS } from "./middleware/auth";

// Call inside the mutation transaction, before locking cases. Revocation shares these
// locks, so authorization remains valid until commit even after slow request work.
export async function lockOperatorAccess(tx: Database, c: ApiContext, s: Services) {
  const actor = c.get("operator");
  const authorized = c.get("session");
  // Match administration's tenant -> operator -> session order, including FK locks
  // taken by case creation. This also serializes changes to the tenant MFA policy.
  await tx
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, actor.organizationId))
    .for("share");
  const [current] = await tx
    .select()
    .from(operators)
    .where(and(eq(operators.id, actor.id), eq(operators.organizationId, actor.organizationId)))
    .for("share");
  const [session] = await tx
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, authorized.id),
        eq(sessions.operatorId, actor.id),
        eq(sessions.tokenHash, authorized.tokenHash),
      ),
    )
    .for("share");
  const now = s.clock().getTime();
  if (
    !current?.active ||
    !session ||
    Date.parse(session.expiresAt) <= now ||
    Date.parse(session.createdAt) + ABSOLUTE_SESSION_SECONDS * 1000 <= now
  )
    throw new ApiFailure("unauthorized", 401, "Sessione scaduta. Accedi di nuovo.");
  const [policy] = await tx
    .select({ mfaRequired: settings.mfaRequired })
    .from(settings)
    .where(eq(settings.organizationId, actor.organizationId));
  if (
    current.mustChangePassword ||
    session.state !== "authenticated" ||
    (policy?.mfaRequired && !current.mfaEnabledAt)
  )
    throw new ApiFailure("forbidden", 403, "Completa l'accesso prima di continuare.");
  return current;
}
