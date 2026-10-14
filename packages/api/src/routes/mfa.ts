import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { operators, sessions, settings, type Database } from "@avanti/db";
import {
  MfaSetupStartRequest,
  MfaSetupConfirmRequest,
  MfaSensitiveRequest,
  MfaVerifyRequest,
} from "@avanti/contracts";
import { body, type App, type ApiContext, type Services } from "../context";
import { ApiFailure, hashToken, newToken, verifyPassword } from "../security";
import {
  base32,
  consumeMfaCode,
  MFA_PENDING_SECONDS,
  recordMfaFailure,
  recoveryCodes,
  verifyTotp,
} from "../mfa";
import { setSessionCookie, SESSION_SECONDS, ABSOLUTE_SESSION_SECONDS } from "../middleware/auth";
import { recordActivity } from "../audit-log";
import { operatorView } from "./auth";

const invalid = () =>
  new ApiFailure("unauthorized", 401, "Verifica non riuscita. Controlla le credenziali e riprova.");
async function lockedSession(tx: Database, c: ApiContext, now: Date) {
  const [operator] = await tx
    .select()
    .from(operators)
    .where(eq(operators.id, c.get("operator").id))
    .for("update");
  const [session] = await tx
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, c.get("session").id),
        eq(sessions.operatorId, c.get("operator").id),
        eq(sessions.tokenHash, c.get("session").tokenHash),
      ),
    );
  if (
    !operator?.active ||
    !session ||
    Date.parse(session.expiresAt) <= now.getTime() ||
    Date.parse(session.createdAt) + ABSOLUTE_SESSION_SECONDS * 1000 <= now.getTime()
  )
    throw invalid();
  return { operator, session };
}
async function issueSession(tx: Database, operatorId: string, now: Date, revokeAll: boolean) {
  if (revokeAll) await tx.delete(sessions).where(eq(sessions.operatorId, operatorId));
  const token = newToken();
  await tx.insert(sessions).values({
    id: crypto.randomUUID(),
    operatorId,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
  });
  return token;
}
export function mountMfaRoutes(app: App, s: Services) {
  app.get("/auth/mfa/status", async (c) => {
    const operator = c.get("operator");
    const [policy] = await s.db
      .select()
      .from(settings)
      .where(eq(settings.organizationId, operator.organizationId));
    const session = c.get("session");
    return c.json({
      enabled: !!operator.mfaEnabledAt,
      required: policy?.mfaRequired ?? false,
      recoveryCodesRemaining: operator.mfaRecoveryHashes.length,
      setupPending:
        !!session.mfaSetupSecret &&
        !!session.mfaSetupExpiresAt &&
        Date.parse(session.mfaSetupExpiresAt) > s.clock().getTime(),
    });
  });
  app.post("/auth/mfa/setup/start", async (c) => {
    const input = await body(c, MfaSetupStartRequest);
    const result = await s.db.transaction(async (tx) => {
      const now = s.clock();
      const { operator, session } = await lockedSession(tx, c, now);
      if (session.state === "mfa_pending" || operator.mustChangePassword) throw invalid();
      if (!(await verifyPassword(input.currentPassword, operator.passwordHash))) {
        await recordMfaFailure(tx, operator, now);
        return null;
      }
      if (operator.mfaEnabledAt)
        throw new ApiFailure("conflict", 409, "La verifica in due passaggi è già attiva.");
      const secret = base32(randomBytes(20));
      const expiresAt = new Date(
        Math.min(now.getTime() + MFA_PENDING_SECONDS * 1000, Date.parse(session.expiresAt)),
      ).toISOString();
      await tx
        .update(sessions)
        .set({
          mfaSetupSecret: await s.mfa.encrypt(secret, operator.id),
          mfaSetupExpiresAt: expiresAt,
        })
        .where(eq(sessions.id, session.id));
      const query = new URLSearchParams({
        secret,
        issuer: "Avanti",
        algorithm: "SHA1",
        digits: "6",
        period: "30",
      });
      return {
        secret,
        otpauthUri: `otpauth://totp/${encodeURIComponent(`Avanti:${operator.email}`)}?${query}`,
        expiresAt,
      };
    });
    if (!result) throw invalid();
    return c.json(result);
  });
  app.post("/auth/mfa/setup/confirm", async (c) => {
    const input = await body(c, MfaSetupConfirmRequest);
    const result = await s.db.transaction(async (tx) => {
      const now = s.clock();
      const { operator, session } = await lockedSession(tx, c, now);
      if (session.state === "mfa_pending" || operator.mustChangePassword) throw invalid();
      if (operator.mfaEnabledAt)
        throw new ApiFailure("conflict", 409, "La verifica in due passaggi è già attiva.");
      const step =
        session.mfaSetupSecret &&
        session.mfaSetupExpiresAt &&
        Date.parse(session.mfaSetupExpiresAt) > now.getTime()
          ? verifyTotp(
              await s.mfa.decrypt(session.mfaSetupSecret, operator.id),
              input.code,
              now,
              null,
            )
          : null;
      if (step === null) {
        await recordMfaFailure(tx, operator, now);
        return null;
      }
      const recovery = recoveryCodes();
      await tx
        .update(operators)
        .set({
          mfaSecret: session.mfaSetupSecret,
          mfaEnabledAt: now.toISOString(),
          mfaLastUsedStep: step,
          mfaRecoveryHashes: recovery.hashes,
          lastLoginAt: session.state === "mfa_setup" ? now.toISOString() : operator.lastLoginAt,
        })
        .where(eq(operators.id, operator.id));
      const token = await issueSession(tx, operator.id, now, true);
      await recordActivity(tx, operator.organizationId, operator.id, "auth.mfa_enabled", now);
      if (session.state === "mfa_setup")
        await recordActivity(tx, operator.organizationId, operator.id, "auth.login_succeeded", now);
      return { token, recoveryCodes: recovery.codes };
    });
    if (!result) throw invalid();
    setSessionCookie(c, result.token, s.production);
    return c.json({ recoveryCodes: result.recoveryCodes });
  });
  app.post("/auth/mfa/verify", async (c) => {
    const input = await body(c, MfaVerifyRequest);
    const result = await s.db.transaction(async (tx) => {
      const now = s.clock();
      const { operator, session } = await lockedSession(tx, c, now);
      if (session.state !== "mfa_pending") throw invalid();
      const patch = await consumeMfaCode(operator, input.code, now, s.mfa);
      if (!patch) {
        await recordMfaFailure(tx, operator, now);
        return null;
      }
      const [updated] = await tx
        .update(operators)
        .set({ ...patch, lastLoginAt: now.toISOString() })
        .where(eq(operators.id, operator.id))
        .returning();
      await tx.delete(sessions).where(eq(sessions.id, session.id));
      const token = await issueSession(tx, operator.id, now, false);
      if ("mfaRecoveryHashes" in patch)
        await recordActivity(
          tx,
          operator.organizationId,
          operator.id,
          "auth.mfa_recovery_used",
          now,
        );
      await recordActivity(tx, operator.organizationId, operator.id, "auth.login_succeeded", now);
      return { token, operator: updated! };
    });
    if (!result) throw invalid();
    setSessionCookie(c, result.token, s.production);
    return c.json(await operatorView(s, result.operator));
  });
  for (const operation of ["disable", "recovery-codes/regenerate"] as const) {
    app.post(`/auth/mfa/${operation}`, async (c) => {
      const input = await body(c, MfaSensitiveRequest);
      const result = await s.db.transaction(async (tx) => {
        const now = s.clock();
        const { operator, session } = await lockedSession(tx, c, now);
        if (session.state !== "authenticated" || operator.mustChangePassword) throw invalid();
        const [policy] = await tx
          .select()
          .from(settings)
          .where(eq(settings.organizationId, operator.organizationId));
        if (operation === "disable" && policy?.mfaRequired)
          throw new ApiFailure(
            "conflict",
            409,
            "La tua organizzazione richiede la verifica in due passaggi.",
          );
        const validPassword = await verifyPassword(input.currentPassword, operator.passwordHash);
        const patch = validPassword ? await consumeMfaCode(operator, input.code, now, s.mfa) : null;
        if (!patch) {
          await recordMfaFailure(tx, operator, now);
          return null;
        }
        if ("mfaRecoveryHashes" in patch)
          await recordActivity(
            tx,
            operator.organizationId,
            operator.id,
            "auth.mfa_recovery_used",
            now,
          );
        if (operation === "disable") {
          await tx
            .update(operators)
            .set({
              mfaSecret: null,
              mfaEnabledAt: null,
              mfaLastUsedStep: null,
              mfaRecoveryHashes: [],
            })
            .where(eq(operators.id, operator.id));
          const token = await issueSession(tx, operator.id, now, true);
          await recordActivity(tx, operator.organizationId, operator.id, "auth.mfa_disabled", now);
          return { token, recoveryCodes: undefined };
        }
        const recovery = recoveryCodes();
        await tx
          .update(operators)
          .set({ ...patch, mfaRecoveryHashes: recovery.hashes })
          .where(eq(operators.id, operator.id));
        await recordActivity(
          tx,
          operator.organizationId,
          operator.id,
          "auth.mfa_recovery_regenerated",
          now,
        );
        return { token: undefined, recoveryCodes: recovery.codes };
      });
      if (!result) throw invalid();
      if (result.token) setSessionCookie(c, result.token, s.production);
      return c.json(result.recoveryCodes ? { recoveryCodes: result.recoveryCodes } : { ok: true });
    });
  }
}
