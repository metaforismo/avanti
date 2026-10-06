import { and, eq } from "drizzle-orm";
import { offices, operators, organizations, sessions } from "@avanti/db";
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

const dummyPassword = hashPassword(newToken());

async function operatorView(
  services: Services,
  operator: typeof operators.$inferSelect,
): Promise<Operator> {
  const [[organization], rows] = await Promise.all([
    services.db.select().from(organizations).where(eq(organizations.id, operator.organizationId)),
    services.db.select().from(offices).where(eq(offices.organizationId, operator.organizationId)),
  ]);
  if (!organization) throw notFound();
  return {
    id: operator.id,
    name: operator.name,
    email: operator.email,
    role: operator.role,
    mustChangePassword: operator.mustChangePassword,
    organization: organizationView(organization),
    offices: rows.map(officeView),
  };
}

export function mountAuthRoutes(app: App, services: Services) {
  app.post("/auth/login", async (context) => {
    const input = await body(context, LoginRequest);
    const token = newToken();
    const operator = await services.db.transaction(async (tx) => {
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
      if (!current || !valid || !current.active)
        throw new ApiFailure("unauthorized", 401, "Email o password non corrette.");
      const now = services.clock();
      const [updated] = await tx
        .update(operators)
        .set({ lastLoginAt: now.toISOString() })
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
        expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
      });
      return updated;
    });
    setSessionCookie(context, token, services.production);
    return context.json(await operatorView(services, operator));
  });
  app.get("/auth/me", async (context) =>
    context.json(await operatorView(services, context.get("operator"))),
  );
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
      if (!current?.active || !session)
        throw new ApiFailure("unauthorized", 401, "Accedi per continuare.");
      if (!(await verifyPassword(input.currentPassword, current.passwordHash)))
        throw new ApiFailure("unauthorized", 401, "Password attuale non corretta.");
      if (input.newPassword === input.currentPassword)
        throw new ApiFailure("bad_request", 400, "Scegli una password diversa da quella attuale.");
      const [updated] = await tx
        .update(operators)
        .set({ passwordHash: await hashPassword(input.newPassword), mustChangePassword: false })
        .where(eq(operators.id, current.id))
        .returning();
      if (!updated) throw notFound();
      await tx.delete(sessions).where(eq(sessions.operatorId, current.id));
      const now = services.clock();
      await tx.insert(sessions).values({
        id: crypto.randomUUID(),
        operatorId: current.id,
        tokenHash: hashToken(replacementToken),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
      });
      return updated;
    });
    setSessionCookie(context, replacementToken, services.production);
    return context.json(await operatorView(services, operator));
  });
  app.post("/auth/logout", async (context) => {
    const token = getCookie(context, SESSION_COOKIE) ?? "";
    await services.db
      .delete(sessions)
      .where(
        and(
          eq(sessions.operatorId, context.get("operator").id),
          eq(sessions.tokenHash, hashToken(token)),
        ),
      );
    deleteCookie(context, SESSION_COOKIE, { path: "/api", secure: services.production });
    return context.json({ ok: true });
  });
}
