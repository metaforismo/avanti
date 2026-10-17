"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { createRetryKeys, withRetryKey } from "@/lib/idempotency";

import type { AssistantReply, AssistantTurn } from "@avanti/contracts";

export type { AssistantAction, AssistantIntent, AssistantTurn } from "@avanti/contracts";

export type AssistantFocus = { questionId?: string; checklistItemId?: string };

type History = { messages: AssistantTurn[]; remainingToday: number };

/** What the rest of the citizen app can do with the assistant: open it, about something. */
export const AssistantContext = createContext<{ open: (focus?: AssistantFocus) => void } | null>(
  null,
);

export function useOpenAssistant() {
  return useContext(AssistantContext)?.open ?? null;
}

export function useAssistant(token: string) {
  const base = `/api/c/${encodeURIComponent(token)}/assistant`;
  const [history, setHistory] = useState<History | null>(null);
  const [pending, setPending] = useState<"load" | "ask" | "desk" | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const keys = useRef(createRetryKeys());

  const fail = (err: unknown) =>
    setError(err instanceof ApiRequestError ? err : new ApiRequestError(0, "internal", ""));

  const load = useCallback(async () => {
    setPending("load");
    setError(null);
    try {
      setHistory(await apiFetch<History>(base));
    } catch (err) {
      fail(err);
    } finally {
      setPending(null);
    }
  }, [base]);

  const ask = useCallback(
    async (message: string, focus?: AssistantFocus) => {
      setPending("ask");
      setError(null);
      // The question appears at once; the server's copy replaces it with the reply.
      const optimistic: AssistantTurn = {
        id: `local-${Date.now()}`,
        role: "citizen",
        text: message,
        createdAt: new Date().toISOString(),
      };
      setHistory((h) => ({
        messages: [...(h?.messages ?? []), optimistic],
        remainingToday: h?.remainingToday ?? 0,
      }));
      try {
        const reply = await withRetryKey(keys.current, "ask", { message, focus }, (headers) =>
          apiFetch<AssistantReply>(base, { method: "POST", body: { message, focus }, headers }),
        );
        const turn: AssistantTurn = {
          id: reply.id,
          role: "assistant",
          text: reply.reply,
          intent: reply.intent,
          action: reply.action,
          sources: reply.sources,
          createdAt: reply.createdAt,
        };
        setHistory((h) => ({
          messages: [...(h?.messages ?? []), turn],
          remainingToday: Math.max(0, (h?.remainingToday ?? 1) - 1),
        }));
        return true;
      } catch (err) {
        setHistory((h) =>
          h ? { ...h, messages: h.messages.filter((t) => t.id !== optimistic.id) } : h,
        );
        fail(err);
        return false;
      } finally {
        setPending(null);
      }
    },
    [base],
  );

  const askDesk = useCallback(
    async (message: string) => {
      setPending("desk");
      setError(null);
      try {
        await withRetryKey(keys.current, "desk", { message }, (headers) =>
          apiFetch(`${base}/ask-desk`, { method: "POST", body: { message }, headers }),
        );
        return true;
      } catch (err) {
        fail(err);
        return false;
      } finally {
        setPending(null);
      }
    },
    [base],
  );

  return { history, pending, error, load, ask, askDesk };
}
