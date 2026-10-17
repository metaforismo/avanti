import { IDEMPOTENCY_HEADER } from "@avanti/contracts/constants";

export { IDEMPOTENCY_HEADER };

/** randomUUID is missing on older phones (Safari before 15.4); getRandomValues is not. */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Keys for actions the person may retry after a lost response. The same action with the same
 * payload reuses its key, so the server answers the retry with the first result instead of
 * doing it twice. Any confirmed success forgets every pending key, so the same words sent later
 * (another «sì») are a new action. A background refresh does not: it can be answered before the
 * lost request commits, and forgetting the key then would store the retry twice.
 */
export function createRetryKeys() {
  const pending = new Map<string, string>();
  return {
    key(action: string, payload?: unknown): string {
      const id = `${action}\u0000${JSON.stringify(payload ?? null)}`;
      let key = pending.get(id);
      if (!key) {
        key = newIdempotencyKey();
        pending.set(id, key);
      }
      return key;
    },
    clear() {
      pending.clear();
    },
  };
}

export type RetryKeys = ReturnType<typeof createRetryKeys>;

/** Runs a request with the action's key; a confirmed result clears the pending keys. */
export async function withRetryKey<T>(
  keys: RetryKeys,
  action: string,
  payload: unknown,
  request: (headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  const result = await request({ [IDEMPOTENCY_HEADER]: keys.key(action, payload) });
  keys.clear();
  return result;
}
