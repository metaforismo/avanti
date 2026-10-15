"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";

// Mirrors the assistant contract agreed with the backend (docs/decisions/ai-platform.md);
// replaced by the @avanti/contracts types when they land.
export type AssistantIntent =
  "answer" | "needs_operator" | "off_topic" | "manipulation" | "emergency";
export type AssistantAction = "none" | "explain_question" | "open_documents" | "ask_desk";

export type AssistantTurn = {
  id: string;
  role: "citizen" | "assistant";
  text: string;
  intent?: AssistantIntent;
  action?: AssistantAction;
  sources?: { id: string; title: string }[];
  createdAt: string;
};

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
  const [deskSent, setDeskSent] = useState(false);

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
        const reply = await apiFetch<AssistantTurn & { remainingToday?: number }>(base, {
          method: "POST",
          body: { message, focus },
        });
        setHistory((h) => ({
          messages: [...(h?.messages ?? []), { ...reply, role: "assistant" }],
          remainingToday: reply.remainingToday ?? Math.max(0, (h?.remainingToday ?? 1) - 1),
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
        await apiFetch(`${base}/ask-desk`, { method: "POST", body: { message } });
        setDeskSent(true);
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

  return { history, pending, error, deskSent, load, ask, askDesk };
}
