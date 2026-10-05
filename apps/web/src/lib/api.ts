import { ApiError, type ErrorCode } from "@avanti/contracts";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const NETWORK_MESSAGE = "Connessione non riuscita. Controlla la rete e riprova.";
const UNKNOWN_MESSAGE = "Qualcosa non ha funzionato. Riprova tra poco.";

type Options = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * JSON fetch against our own API. Throws ApiRequestError with a user-safe Italian message
 * for every failure, including network errors and non-JSON responses.
 */
export async function apiFetch<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const isForm = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiRequestError(0, "internal", NETWORK_MESSAGE);
  }

  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiError.safeParse(payload);
    if (parsed.success) {
      const { code, message, fields, requestId } = parsed.data.error;
      throw new ApiRequestError(response.status, code, message, fields, requestId);
    }
    throw new ApiRequestError(response.status, "internal", UNKNOWN_MESSAGE);
  }
  return payload as T;
}
