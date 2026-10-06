import type { MiddlewareHandler } from "hono";
import { UPLOAD_LIMITS } from "@avanti/contracts";
import type { ApiEnv } from "../context";
import { ApiFailure } from "../security";

export function boundedBody(): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const request = context.req.raw;
    if (request.body) {
      let size = 0;
      const stream = request.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            size += chunk.byteLength;
            if (size > UPLOAD_LIMITS.maxBytes + 128 * 1024) {
              context.set("bodyTooLarge", true);
              throw new ApiFailure(
                "file_too_large",
                413,
                "Il file è troppo grande. Il limite è 4 MB.",
              );
            }
            controller.enqueue(chunk);
          },
        }),
      );
      // Check bytes as consumed, including chunked requests and inaccurate Content-Length.
      context.req.raw = new Request(request, { body: stream, duplex: "half" } as RequestInit);
    }
    await next();
  };
}
const UPLOAD_PATH = /^\/api\/c\/([^/]+)\/documents$/;
const MAX_UPLOADS_PER_CASE = 4;

/**
 * Bounds simultaneous uploads per case, not per process: anyone can open a case from a public
 * QR, and a global counter let four deliberately slow uploads block every citizen.
 */
export function uploadCapacity(): MiddlewareHandler<ApiEnv> {
  const active = new Map<string, number>();
  return async (context, next) => {
    const token =
      context.req.method === "POST" ? UPLOAD_PATH.exec(context.req.path)?.[1] : undefined;
    if (!token) return next();
    const running = active.get(token) ?? 0;
    if (running >= MAX_UPLOADS_PER_CASE)
      throw new ApiFailure(
        "rate_limited",
        429,
        "Stai caricando troppi file insieme. Attendi che finiscano e riprova.",
      );
    active.set(token, running + 1);
    try {
      await next();
    } finally {
      const left = (active.get(token) ?? 1) - 1;
      if (left > 0) active.set(token, left);
      else active.delete(token);
    }
  };
}
