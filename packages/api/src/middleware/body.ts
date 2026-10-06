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
export function uploadCapacity(): MiddlewareHandler<ApiEnv> {
  let active = 0;
  return async (context, next) => {
    if (context.req.method !== "POST" || !/^\/api\/c\/[^/]+\/documents$/.test(context.req.path))
      return next();
    if (active >= 4)
      throw new ApiFailure(
        "internal",
        503,
        "Caricamento momentaneamente non disponibile. Riprova tra poco.",
      );
    active++;
    try {
      await next();
    } finally {
      active--;
    }
  };
}
