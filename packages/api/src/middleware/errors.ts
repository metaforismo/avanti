import { DomainValidationError } from "@avanti/core";
import { safeError } from "../logging";
import type { App, ApiOptions } from "../context";
import { ApiFailure } from "../security";

export function registerErrors(app: App, logger: ApiOptions["errorLogger"]) {
  app.onError((error, context) => {
    let failure: ApiFailure;
    if (error instanceof ApiFailure) failure = error;
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
