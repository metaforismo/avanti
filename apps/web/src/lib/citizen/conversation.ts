"use client";

import { useCallback, useState } from "react";
import type { AnswerValue, Question } from "@avanti/contracts";
import { apiFetch, ApiRequestError } from "@/lib/api";

// Mirrors the conversation contract agreed with the backend (docs/decisions/ai-platform.md);
// replaced by the @avanti/contracts types when they land.
export type ConversationTurn = {
  id: string;
  role: "citizen" | "assistant";
  text: string;
  kind: "message" | "question" | "confirmation" | "summary";
  questionId: string | null;
  createdAt: string;
};

export type Proposal = {
  id: string;
  questionId: string;
  questionText: string;
  value: AnswerValue;
  display: string;
  evidence: string;
  confidence: number;
};

export type ConversationState = {
  turns: ConversationTurn[];
  proposals: Proposal[];
  ask: Question[];
  complete: boolean;
  engine: "ai" | "heuristic";
};

export type ConversationAction = "load" | "send" | "confirm" | null;

/** The guided conversation: one request per citizen message or confirmation. */
export function useConversation(token: string, initial: ConversationState | null) {
  const base = `/api/c/${encodeURIComponent(token)}/conversation`;
  const [state, setState] = useState<ConversationState | null>(initial);
  const [pending, setPending] = useState<ConversationAction>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);

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
        setError(err instanceof ApiRequestError ? err : new ApiRequestError(0, "internal", ""));
        return null;
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const load = useCallback(() => run("load", () => apiFetch<ConversationState>(base)), [base, run]);

  const send = useCallback(
    (text: string) =>
      run("send", () => apiFetch<ConversationState>(base, { method: "POST", body: { text } })),
    [base, run],
  );

  const confirm = useCallback(
    (accept: { proposalId: string; value?: AnswerValue }[], reject: string[]) =>
      run("confirm", () =>
        apiFetch<ConversationState>(`${base}/confirm`, {
          method: "POST",
          body: { accept, reject },
        }),
      ),
    [base, run],
  );

  return { state, setState, pending, error, clearError: () => setError(null), load, send, confirm };
}
