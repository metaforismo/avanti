import { and, eq } from "drizzle-orm";
import { offices, operators, organizations, sessions } from "@avanti/db";
import { LoginRequest, type Operator } from "@avanti/contracts";
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
    organization: organizationView(organization),
    offices: rows.map(officeView),
  };
}

export function mountAuthRoutes(app: App, services: Services) {
  app.post("/auth/login", async (context) => {
    const input = await body(context, LoginRequest);
    const [operator] = await services.db
      .select()
      .from(operators)
      .where(eq(operators.email, input.email))
      .limit(1);
    const valid = await verifyPassword(
      input.password,
      operator?.passwordHash ?? (await dummyPassword),
    );
    if (!operator || !valid)
      throw new ApiFailure("unauthorized", 401, "Email o password non corrette.");
    const token = newToken();
    await services.db.insert(sessions).values({
      id: crypto.randomUUID(),
      operatorId: operator.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(services.clock().getTime() + SESSION_SECONDS * 1000).toISOString(),
    });
    setSessionCookie(context, token, services.production);
    return context.json(await operatorView(services, operator));
  });
  app.get("/auth/me", async (context) =>
    context.json(await operatorView(services, context.get("operator"))),
  );
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
