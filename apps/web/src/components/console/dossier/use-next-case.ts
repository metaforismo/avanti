"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";
import type { CaseListResponse } from "@avanti/contracts";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CASE_STATUS } from "@/lib/console/labels";
import { nextInQueue, queueApiPath, readQueueParams } from "@/lib/console/queue-params";
import { rememberedQueue } from "@/lib/console/recent-cases";

export type NextCase = {
  go: () => Promise<void>;
  pending: boolean;
  /** Why there is no next case (or it could not be found), to show by the button. */
  message: string | null;
  dismiss: () => void;
};

/**
 * «Prossima pratica»: the case after this one in the queue the operator came from, with the
 * same tab, filters and order, without going back to the list. The list is read fresh, so a
 * case a colleague has just taken or finished is not offered.
 */
export function useNextCase(caseId: string): NextCase {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function go() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    const queue = readQueueParams(rememberedQueue());
    const path = queueApiPath(queue);
    try {
      const page = await apiFetch<CaseListResponse>(path);
      let next = nextInQueue(page.items, caseId);
      // This case closed the first page: the next one opens the second.
      if (!next && page.nextCursor && page.items.some((item) => item.id === caseId)) {
        const more = await apiFetch<CaseListResponse>(
          `${path}&cursor=${encodeURIComponent(page.nextCursor)}`,
        );
        next = nextInQueue(more.items, caseId);
      }
      if (!next) {
        const tab = CASE_STATUS[queue.status].label.toLowerCase();
        const filtered = queue.practice || queue.assignee || queue.priority || queue.q.trim();
        setMessage(
          queue.erasure
            ? "Nessun'altra richiesta di cancellazione aperta."
            : `Nessun'altra pratica ${filtered ? "con questi filtri " : ""}in «${tab}».`,
        );
        setPending(false);
        return;
      }
      // Stays pending: the next case replaces this view.
      router.push(`/console/pratiche/${next.id}` as Route);
    } catch (err) {
      setPending(false);
      // A session that ended has its own notice from the console shell.
      if (err instanceof ApiRequestError && err.status === 401) return;
      setMessage(
        err instanceof ApiRequestError ? err.message : "Prossima pratica non disponibile. Riprova.",
      );
    }
  }

  return { go, pending, message, dismiss: () => setMessage(null) };
}
