"use client";

import { useCallback, useRef, useState } from "react";
import type { AnswerValue, ConversationState } from "@avanti/contracts";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { createRetryKeys, withRetryKey } from "@/lib/idempotency";

export type { ConversationTurn, Proposal, ConversationState } from "@avanti/contracts";

export type ConversationAction = "load" | "send" | "confirm" | null;

/** The guided conversation: one request per citizen message or confirmation. */
export function useConversation(
  token: string,
  initial: ConversationState | null,
  /** The case changed elsewhere: the caller refreshes what it shows from the case. */
  onConflict?: () => void,
) {
  const base = `/api/c/${encodeURIComponent(token)}/conversation`;
  const [state, setState] = useState<ConversationState | null>(initial);
  const [pending, setPending] = useState<ConversationAction>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  // Sending the same words again after a lost reply must not add them twice.
  const keys = useRef(createRetryKeys());

  const run = useCallback(
    async (
      action: Exclude<ConversationAction, null>,
      request: () => Promise<ConversationState>,
    ) => {
      setPending(action);
      setError(null);
      try {
        const next = await request();
        setState(next);
        return next;
      } catch (err) {
        const failure =
          err instanceof ApiRequestError ? err : new ApiRequestError(0, "internal", "");
        setError(failure);
        // Cards already confirmed (the reply was lost) or answers changed on another phone: the
        // same request would be refused forever, so show what the server has now.
        if (failure.code === "conflict") {
          onConflict?.();
          await apiFetch<ConversationState>(base).then(
            (next) => {
              keys.current.clear();
              setState(next);
            },
            () => {},
          );
        }
        return null;
      } finally {
        setPending(null);
      }
    },
    [base, onConflict],
  );

  const load = useCallback(() => run("load", () => apiFetch<ConversationState>(base)), [base, run]);

  const send = useCallback(
    (text: string) =>
      run("send", () =>
        withRetryKey(keys.current, "send", { text }, (headers) =>
          apiFetch<ConversationState>(base, { method: "POST", body: { text }, headers }),
        ),
      ),
    [base, run],
  );

  const confirm = useCallback(
    (accept: { proposalId: string; value?: AnswerValue }[], reject: string[]) =>
      run("confirm", () =>
        withRetryKey(keys.current, "confirm", { accept, reject }, (headers) =>
          apiFetch<ConversationState>(`${base}/confirm`, {
            method: "POST",
            body: { accept, reject },
            headers,
          }),
        ),
      ),
    [base, run],
  );

  return { state, setState, pending, error, clearError: () => setError(null), load, send, confirm };
}
