"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";
import type { Proposal } from "@/lib/citizen/conversation";

/**
 * What the assistant understood, waiting for the citizen. Nothing here is an answer yet: each line
 * shows the citizen's own words it came from, and they confirm or drop it. To correct, they just
 * write it again ("no, siamo in cinque"): the conversation handles corrections.
 */
export function ProposalsCard({
  proposals,
  m,
  busy,
  onConfirm,
}: {
  proposals: Proposal[];
  m: Widen<CitizenMessages>;
  busy: boolean;
  onConfirm: (accept: string[], reject: string[]) => void;
}) {
  const [dropped, setDropped] = useState<string[]>([]);
  const kept = proposals.filter((p) => !dropped.includes(p.id));
  if (proposals.length === 0) return null;
  // A quote helps only when it points at a few words. The first story is quoted whole for every
  // fact drawn from it, and it is already on screen just above.
  const quoted = new Map<string, number>();
  for (const p of proposals) quoted.set(p.evidence, (quoted.get(p.evidence) ?? 0) + 1);
  const showEvidence = (p: Proposal) =>
    p.evidence.length > 0 && p.evidence.length <= 140 && quoted.get(p.evidence) === 1;

  return (
    <section
      aria-labelledby="proposals-title"
      className="animate-rise rounded-lg bg-surface p-4 shadow-raised ring-1 ring-stamp/30"
    >
      <h2 id="proposals-title" className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-stamp" aria-hidden />
        {m.conversation.understoodTitle}
      </h2>
      <p className="mt-0.5 text-sm text-ink-3">{m.conversation.understoodHint}</p>
      <ul className="mt-3 divide-y divide-line">
        {proposals.map((proposal) => {
          const isDropped = dropped.includes(proposal.id);
          return (
            <li key={proposal.id} className="flex items-start gap-3 py-2.5">
              <div className={isDropped ? "min-w-0 flex-1 opacity-50" : "min-w-0 flex-1"}>
                <p className="text-sm text-ink-3">{proposal.questionText}</p>
                {/* bdi, not dir=auto on the line: a bare number would align it to the left in RTL. */}
                <p className="font-semibold break-words">
                  <bdi>{isDropped ? <s>{proposal.display}</s> : proposal.display}</bdi>
                </p>
                {showEvidence(proposal) && (
                  <p className="mt-0.5 text-sm text-ink-2">
                    {m.conversation.because}{" "}
                    <q dir="auto" className="italic">
                      {proposal.evidence}
                    </q>
                  </p>
                )}
              </div>
              <div className="-me-2 -mt-1.5 flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-pressed={isDropped}
                  onClick={() =>
                    setDropped((current) =>
                      isDropped
                        ? current.filter((id) => id !== proposal.id)
                        : [...current, proposal.id],
                    )
                  }
                  disabled={busy}
                  aria-label={`${m.conversation.drop}: ${proposal.questionText}`}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        className="mt-3 w-full"
        loading={busy}
        onClick={() =>
          onConfirm(
            kept.map((p) => p.id),
            dropped,
          )
        }
      >
        <Check className="size-4" aria-hidden />
        {kept.length === 0 ? m.common.continue : m.conversation.confirmAll}
      </Button>
    </section>
  );
}
