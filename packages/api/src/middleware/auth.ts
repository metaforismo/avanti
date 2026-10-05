import { eq } from "drizzle-orm";
import { cases, operators, sessions } from "@avanti/db";
import { getCookie, setCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { ApiContext, ApiEnv, Services } from "../context";
import { ApiFailure, hashToken, notFound } from "../security";

export const ABSOLUTE_SESSION_SECONDS = 12 * 60 * 60;
export const SESSION_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE = "avanti_session";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function setSessionCookie(context: ApiContext, token: string, production: boolean) {
  setCookie(context, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: production,
    sameSite: "Lax",
    path: "/api",
    maxAge: SESSION_SECONDS,
  });
}

export function authenticateOperator(services: Services): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const token = getCookie(context, SESSION_COOKIE);
    if (!token || !tokenPattern.test(token)) {
      throw new ApiFailure("unauthorized", 401, "Accedi per continuare.");
    }
    const [session] = await services.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
      .limit(1);
    const now = services.clock();
    const readOnly = ["GET", "HEAD", "OPTIONS"].includes(context.req.method);
    if (
      !session ||
      Date.parse(session.expiresAt) <= now.getTime() ||
      Date.parse(session.createdAt) + ABSOLUTE_SESSION_SECONDS * 1000 <= now.getTime()
    ) {
      if (session && !readOnly)
        await services.db.delete(sessions).where(eq(sessions.id, session.id));
      throw new ApiFailure("unauthorized", 401, "Sessione scaduta. Accedi di nuovo.");
    }
    const [operator] = await services.db
      .select()
      .from(operators)
      .where(eq(operators.id, session.operatorId))
      .limit(1);
    if (!operator) throw new ApiFailure("unauthorized", 401, "Accedi per continuare.");
    if (!readOnly) {
      await services.db
        .update(sessions)
        .set({
          expiresAt: new Date(
            Math.min(
              now.getTime() + SESSION_SECONDS * 1000,
              Date.parse(session.createdAt) + ABSOLUTE_SESSION_SECONDS * 1000,
            ),
          ).toISOString(),
        })
        .where(eq(sessions.id, session.id));
      setSessionCookie(context, token, services.production);
    }
    context.set("operator", operator);
    await next();
  };
}

export function authenticateCitizen(services: Services): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const token = context.req.param("token");
    if (!token || !tokenPattern.test(token)) throw notFound();
    const [row] = await services.db
      .select()
      .from(cases)
      .where(eq(cases.tokenHash, hashToken(token)))
      .limit(1);
    if (!row) throw notFound();
    if (Date.parse(row.expiresAt) <= services.clock().getTime()) {
      throw new ApiFailure(
        "link_expired",
        410,
        "Il link è scaduto. Contatta lo sportello per un nuovo link.",
      );
    }
    context.set("citizen", row);
    await next();
  };
}
