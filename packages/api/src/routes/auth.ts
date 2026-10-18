import { and, eq } from "drizzle-orm";
import { offices, operators, organizations, sessions, settings } from "@avanti/db";
import { ChangePasswordRequest, LoginRequest, type Operator } from "@avanti/contracts";
import { deleteCookie, getCookie } from "hono/cookie";
import { body, type App, type Services } from "../context";
import {
  ApiFailure,
  hashPassword,
  hashToken,
  newToken,
  notFound,
  verifyPassword,
} from "../security";
import { SESSION_COOKIE, SESSION_SECONDS, setSessionCookie } from "../middleware/auth";
import { officeView, organizationView } from "../views";
import { MFA_PENDING_SECONDS } from "../mfa";
import { recordActivity } from "../audit-log";

const dummyPassword = hashPassword(newToken());

export async function operatorView(
  services: Services,
  operator: typeof operators.$inferSelect,
  setupPending = false,
): Promise<Operator> {
  const [[organization], rows, [policy]] = await Promise.all([
    services.db.select().from(organizations).where(eq(organizations.id, operator.organizationId)),
    services.db.select().from(offices).where(eq(offices.organizationId, operator.organizationId)),
    services.db.select().from(settings).where(eq(settings.organizationId, operator.organizationId)),
  ]);
  if (!organization) throw notFound();
  return {
    id: operator.id,
    name: operator.name,
    email: operator.email,
    role: operator.role,
    mustChangePassword: operator.mustChangePassword,
    mfaEnabled: operator.mfaEnabledAt !== null,
    mustSetupMfa: setupPending || ((policy?.mfaRequired ?? false) && !operator.mfaEnabledAt),
    organization: organizationView(organization),
    offices: rows.map(officeView),
  };
}

export function mountAuthRoutes(app: App, services: Services) {
  app.post("/auth/login", async (context) => {
    const input = await body(context, LoginRequest);
    const token = newToken();
    const result = await services.db.transaction(async (tx) => {
      // Reset, deactivation and login share this lock: an old password cannot create a new session.
      const [current] = await tx
        .select()
        .from(operators)
        .where(eq(operators.email, input.email))
        .for("update");
      const valid = await verifyPassword(
        input.password,
        current?.passwordHash ?? (await dummyPassword),
      );
      const now = services.clock();
      if (!current || !valid || !current.active) {
        // Return the rejection after commit: throwing here would roll back the failed-login event.
        // Unknown accounts have no tenant; never guess an organization from client input.
        await recordActivity(
          tx,
          current?.organizationId ?? null,
          null,
          "auth.login_failed",
          now,
          current?.id ?? null,
        );
        return null;
      }
      // Checked only after the right password: the message reveals nothing to a stranger.
      if (
        current.mustChangePassword &&
        current.temporaryPasswordExpiresAt &&
        Date.parse(current.temporaryPasswordExpiresAt) <= now.getTime()
      ) {
        await recordActivity(
          tx,
          current.organizationId,
          null,
          "auth.login_failed",
          now,
          current.id,
        );
        return "expired" as const;
      }
      const [policy] = await tx
        .select()
        .from(settings)
        .where(eq(settings.organizationId, current.organizationId));
      const state = current.mfaEnabledAt
        ? "mfa_pending"
        : policy?.mfaRequired
          ? "mfa_setup"
          : "authenticated";
      const seconds = state === "authenticated" ? SESSION_SECONDS : MFA_PENDING_SECONDS;
      const expiresAt = new Date(now.getTime() + seconds * 1000).toISOString();
      const [updated] = await tx
        .update(operators)
        .set({ lastLoginAt: state === "authenticated" ? now.toISOString() : current.lastLoginAt })
        .where(eq(operators.id, current.id))
        .returning();
      if (!updated) throw notFound();
      const previous = getCookie(context, SESSION_COOKIE);
      if (previous)
        await tx
          .delete(sessions)
          .where(
            and(eq(sessions.operatorId, current.id), eq(sessions.tokenHash, hashToken(previous))),
          );
      await tx.insert(sessions).values({
        id: crypto.randomUUID(),
        operatorId: current.id,
        createdAt: now.toISOString(),
        tokenHash: hashToken(token),
        expiresAt,
        state,
      });
      if (state === "authenticated")
        await recordActivity(tx, current.organizationId, current.id, "auth.login_succeeded", now);
      return { operator: updated, state, expiresAt, seconds };
    });
    if (!result) throw new ApiFailure("unauthorized", 401, "Email o password non corrette.");
    if (result === "expired")
      throw new ApiFailure(
        "unauthorized",
        401,
        "La password temporanea è scaduta: chiedi al responsabile del CAF di generarne una nuova.",
      );
    setSessionCookie(context, token, services.production, result.seconds);
    return context.json(
      result.state === "mfa_pending"
        ? { mfaRequired: true as const, expiresAt: result.expiresAt }
        : await operatorView(services, result.operator, result.state === "mfa_setup"),
    );
  });
  app.get("/auth/me", async (context) => {
    const session = context.get("session");
    return context.json(
      session.state === "mfa_pending"
        ? { mfaRequired: true as const, expiresAt: new Date(session.expiresAt).toISOString() }
        : await operatorView(services, context.get("operator"), session.state === "mfa_setup"),
    );
  });
  app.post("/auth/password", async (context) => {
    const input = await body(context, ChangePasswordRequest);
    const replacementToken = newToken();
    const tokenHash = hashToken(getCookie(context, SESSION_COOKIE) ?? "");
    const operator = await services.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(operators)
        .where(eq(operators.id, context.get("operator").id))
        .for("update");
      const [session] = await tx
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.operatorId, context.get("operator").id),
            eq(sessions.tokenHash, tokenHash),
          ),
        );
      if (
        !current?.active ||
        !session ||
        session.state === "mfa_pending" ||
        Date.parse(session.expiresAt) <= services.clock().getTime()
      )
        throw new ApiFailure("unauthorized", 401, "Accedi per continuare.");
      if (!(await verifyPassword(input.currentPassword, current.passwordHash)))
        throw new ApiFailure("unauthorized", 401, "La password non è corretta.");
      if (input.newPassword === input.currentPassword)
        throw new ApiFailure("bad_request", 400, "Scegli una password diversa da quella attuale.");
      const [updated] = await tx
        .update(operators)
        .set({
          passwordHash: await hashPassword(input.newPassword),
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
        })
        .where(eq(operators.id, current.id))
        .returning();
      if (!updated) throw notFound();
      await tx.delete(sessions).where(eq(sessions.operatorId, current.id));
      const now = services.clock();
      await tx.insert(sessions).values({
        id: crypto.randomUUID(),
        operatorId: current.id,
        state: session.state,
        tokenHash: hashToken(replacementToken),
        createdAt: now.toISOString(),
        expiresAt:
          session.state === "authenticated"
            ? new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString()
            : session.expiresAt,
      });
      await recordActivity(tx, current.organizationId, current.id, "auth.password_changed", now);
      return updated;
    });
    setSessionCookie(
      context,
      replacementToken,
      services.production,
      context.get("session").state === "authenticated"
        ? SESSION_SECONDS
        : Math.max(
            1,
            Math.ceil(
              (Date.parse(context.get("session").expiresAt) - services.clock().getTime()) / 1000,
            ),
          ),
    );
    return context.json(
      await operatorView(services, operator, context.get("session").state === "mfa_setup"),
    );
  });
  app.post("/auth/logout", async (context) => {
    const token = getCookie(context, SESSION_COOKIE) ?? "";
    await services.db.transaction(async (tx) => {
      await tx
        .delete(sessions)
        .where(
          and(
            eq(sessions.operatorId, context.get("operator").id),
            eq(sessions.tokenHash, hashToken(token)),
          ),
        );
      const actor = context.get("operator");
      await recordActivity(tx, actor.organizationId, actor.id, "auth.logged_out", services.clock());
    });
    deleteCookie(context, SESSION_COOKIE, { path: "/api", secure: services.production });
    return context.json({ ok: true });
  });
}
