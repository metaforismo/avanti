import { DomainValidationError } from "@avanti/core";
import type { App } from "../context";
import { ApiFailure } from "../security";

export function registerErrors(app: App) {
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
