import type { ApiError, ErrorCode } from "@avanti/contracts";

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

export type AuthFailure = { status: 401 | 403; path: string };
let authListener: ((failure: AuthFailure) => void) | null = null;

/**
 * Lets the console hear that its session ended (401) or lost a permission (403) during any
 * request, including writes whose caller only shows the message. Returns the unsubscribe.
 */
export function onAuthFailure(listener: (failure: AuthFailure) => void) {
  authListener = listener;
  return () => {
    if (authListener === listener) authListener = null;
  };
}

/** True once a console is on screen and handles an ended session itself (notice, way back). */
export const authFailureHandled = () => authListener !== null;

// On these endpoints 401 means wrong credentials or code, not a session that ended.
function isCredentialCheck(path: string) {
  return path.startsWith("/api/auth/") && path !== "/api/auth/me";
}

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
  if (!response.ok) throw failure(path, response.status, payload);
  return payload as T;
}

/**
 * A file from our own API (export, report, upload), fetched so that a refusal (session ended,
 * limit reached) reaches the page as a message instead of a failed browser download.
 */
export async function apiDownload(path: string): Promise<{ blob: Blob; fileName: string | null }> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin" });
  } catch {
    throw new ApiRequestError(0, "internal", NETWORK_MESSAGE);
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw failure(path, response.status, payload);
  }
  try {
    return {
      blob: await response.blob(),
      fileName: fileNameFrom(response.headers.get("Content-Disposition")),
    };
  } catch {
    throw new ApiRequestError(0, "internal", NETWORK_MESSAGE);
  }
}

/** `filename*=UTF-8''…` (any script) wins over the plain `filename="…"`. */
export function fileNameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {
      // Malformed escape: fall back to the plain name.
    }
  }
  return /filename="([^"]*)"/i.exec(disposition)?.[1] || null;
}

function failure(path: string, status: number, payload: unknown) {
  if ((status === 401 || status === 403) && !isCredentialCheck(path))
    authListener?.({ status, path });
  if (isApiError(payload)) {
    const { code, message, fields, requestId } = payload.error;
    return new ApiRequestError(status, code, message, fields, requestId);
  }
  return new ApiRequestError(status, "internal", UNKNOWN_MESSAGE);
}

function isApiError(payload: unknown): payload is ApiError {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return false;
  const error = (payload as { error: unknown }).error;
  return (
    !!error &&
    typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}
