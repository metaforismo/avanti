import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { UPLOAD_LIMITS } from "@avanti/contracts";
import { GatewayIntelligence } from "./ai";
import type { ApiEnv, ApiOptions, Services } from "./context";
import { ApiFailure } from "./security";
import { authenticateCitizen, authenticateOperator } from "./middleware/auth";
import { registerErrors } from "./middleware/errors";
import { requireOrigin } from "./middleware/origin";
import { rateLimit } from "./middleware/rate-limit";
import { mountMaintenance } from "./middleware/maintenance";
import { requestMetadata } from "./middleware/request";
import { mountAuthRoutes } from "./routes/auth";
import { mountPublicRoutes } from "./routes/public";
import { mountCitizenRoutes } from "./citizen";
import { mountOperatorRoutes } from "./operator";

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
    clock: options.clock ?? (() => new Date()),
    ai: options.ai ?? new GatewayIntelligence(),
    publicUrl: options.publicUrl ?? "http://localhost:3400",
    production: options.production ?? false,
  };
  const app = new Hono<ApiEnv>().basePath("/api");
  app.use("*", requestMetadata(options.logger));
  app.use(
    "*",
    bodyLimit({
      maxSize: UPLOAD_LIMITS.maxBytes + 128 * 1024,
      onError: () => {
        throw new ApiFailure("file_too_large", 413, "Il file è troppo grande. Il limite è 4 MB.");
      },
    }),
  );
  registerErrors(app, options.errorLogger);
  mountMaintenance(app, services);
  app.use("*", rateLimit(services));
  app.use("/auth/*", requireOrigin(services));
  const authenticated = authenticateOperator(services);
  for (const path of ["/auth/me", "/auth/logout", "/cases/*", "/metrics"]) {
    if (!path.startsWith("/auth/")) app.use(path, requireOrigin(services));
    app.use(path, authenticated);
  }
  const citizen = authenticateCitizen(services);
  app.use("/c/:token/*", citizen);
  mountPublicRoutes(app, services);
  mountAuthRoutes(app, services);
  mountCitizenRoutes(app, services);
  mountOperatorRoutes(app, services);
  return app;
}
