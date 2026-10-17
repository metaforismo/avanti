import { mountDossierAsk } from "./dossier-ask";
import { mountConversationRoutes } from "./conversation-routes";
import { mfaCipher } from "./mfa";
import { mountMfaRoutes } from "./routes/mfa";
import { mountQuickReplyRoutes } from "./routes/quick-replies";
import { Hono } from "hono";
import { defaultNotifications } from "./notification-config";
import { boundedBody, uploadCapacity } from "./middleware/body";
import { GatewayIntelligence } from "./ai";
import type { ApiEnv, ApiOptions, Services } from "./context";
import { ApiFailure } from "./security";
import {
  authenticateCitizen,
  authenticateOperator,
  restrictTemporaryPassword,
} from "./middleware/auth";
import { registerErrors } from "./middleware/errors";
import { requireOrigin } from "./middleware/origin";
import { rateLimit } from "./middleware/rate-limit";
import { mountMaintenance } from "./middleware/maintenance";
import { requestMetadata } from "./middleware/request";
import { mountAuthRoutes } from "./routes/auth";
import { mountPublicRoutes } from "./routes/public";
import { mountCitizenAssistant } from "./citizen-assistant";
import { mountCitizenRoutes } from "./citizen";
import { mountAdministrationRoutes } from "./routes/administration";
import { mountOperatorRoutes } from "./operator";
import { mountCaseAssignment } from "./case-assignment";
import { mountPilotReportRoutes } from "./routes/pilot-report";
import { mountAuditRoutes } from "./audit-log";
import { mountNearReady } from "./near-ready";
import { mountCopilot } from "./copilot";
import { mountRenewalRoutes } from "./renewals";
import { mountFamilyReuseRoutes } from "./family-reuse";
import { mountSystemStatus } from "./system-status";

export function createApp(options: ApiOptions) {
  if (options.production && !options.publicUrl)
    throw new Error("PUBLIC_APP_URL required in production");
  if (options.production && !options.rateLimitSecret)
    throw new Error("RATE_LIMIT_SECRET required in production");
  if (
    options.production &&
    !options.trustProxy &&
    !options.clientAddress &&
    options.transport !== "node"
  )
    throw new Error(
      "Client address unavailable: configure TRUST_PROXY or a socket clientAddress adapter before startup",
    );
  const services: Services = {
    ...options,
    mfa: mfaCipher({
      key: options.mfaEncryptionKey,
      production: options.production,
      localKeyPath: options.mfaLocalKeyPath,
    }),
    notifications: options.notifications ?? defaultNotifications(),
    clock: options.clock ?? (() => new Date()),
    ai: options.ai ?? new GatewayIntelligence(),
    publicUrl: options.publicUrl ?? "http://localhost:3400",
    production: options.production ?? false,
  };
  const app = new Hono<ApiEnv>().basePath("/api");
  app.use("*", requestMetadata(options.logger));
  app.use("*", requireOrigin(services));
  app.use("*", uploadCapacity(services));
  app.use("*", boundedBody());
  registerErrors(app, options.errorLogger, services);
  mountMaintenance(app, services);
  app.use("*", restrictTemporaryPassword(services));
  const limited = rateLimit(services);
  app.use("*", limited);
  const authenticated = authenticateOperator(services);
  for (const path of [
    "/auth/me",
    "/auth/logout",
    "/auth/password",
    "/auth/mfa/*",
    "/cases/*",
    "/renewals/*",
    "/metrics",
    "/reports/*",
    "/status",
    "/ai/*",
    "/settings",
    "/quick-replies/*",
    "/operators/*",
    "/audit/*",
  ]) {
    app.use(path, authenticated);
    if (!path.startsWith("/auth/")) app.use(path, limited);
  }
  app.use("/auth/password", limited);
  app.use("/auth/mfa/*", limited);
  // The slug lookup stays public; only office mutations use operator authentication.
  app.use("/offices/*", async (context, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) return next();
    return requireOrigin(services)(context, async () => {
      await authenticated(context, next);
    });
  });
  const citizen = authenticateCitizen(services);
  app.use("/c/:token/*", (c, next) => {
    // Withdrawal authenticates its own restricted capability, also after retention.
    if (c.req.method === "PUT" && c.req.path.endsWith("/renewal-consent")) return next();
    return citizen(c, next);
  });
  mountPublicRoutes(app, services);
  mountAuthRoutes(app, services);
  mountMfaRoutes(app, services);
  mountCitizenRoutes(app, services);
  // Assistant and voice quotas are per case, so they run again once the capability is resolved.
  // Hono's "/assistant/*" also matches "/assistant".
  for (const path of ["/c/:token/assistant/*", "/c/:token/transcribe"]) app.use(path, limited);
  mountCitizenAssistant(app, services);
  mountConversationRoutes(app, services);
  mountCaseAssignment(app, services);
  mountOperatorRoutes(app, services);
  mountFamilyReuseRoutes(app, services);
  mountRenewalRoutes(app, services);
  mountAdministrationRoutes(app, services);
  mountQuickReplyRoutes(app, services);
  mountAuditRoutes(app, services);
  mountPilotReportRoutes(app, services);
  mountSystemStatus(app, services);
  mountCopilot(app, services);
  mountNearReady(app, services);
  mountDossierAsk(app, services);
  return app;
}
