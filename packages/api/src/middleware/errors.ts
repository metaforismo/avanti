import { DomainValidationError } from "@avanti/core";
import { safeError } from "../logging";
import type { App, ApiOptions, Services } from "../context";
import { recordOperationalCounters } from "../operational-telemetry";
import { ApiFailure } from "../security";

export function registerErrors(app: App, logger: ApiOptions["errorLogger"], s?: Services) {
  app.onError(async (error, context) => {
    let failure: ApiFailure;
    if (context.get("bodyTooLarge"))
      failure = new ApiFailure("file_too_large", 413, "Il file è troppo grande. Il limite è 4 MB.");
    else if (error instanceof ApiFailure) failure = error;
    else if (error instanceof DomainValidationError) {
      failure = new ApiFailure("bad_request", 400, error.message);
    } else {
      failure = new ApiFailure(
        "internal",
        500,
        "Servizio momentaneamente non disponibile. Riprova.",
      );
    }
    if (failure.status === 500)
      (logger ?? console.error)({ requestId: context.get("requestId"), ...safeError(error) });
    const organizationId =
      context.get("operator")?.organizationId ?? context.get("citizen")?.organizationId;
    if (failure.status >= 500 && organizationId && s)
      await recordOperationalCounters(s, organizationId, ["api_error"]);
    return context.json(
      {
        error: {
          code: failure.code,
          message: failure.message,
          requestId: context.get("requestId"),
        },
      },
      failure.status,
    );
  });
  app.notFound((context) =>
    context.json(
      {
        error: {
          code: "not_found",
          message: "Elemento non trovato.",
          requestId: context.get("requestId"),
        },
      },
      404,
    ),
  );
}
