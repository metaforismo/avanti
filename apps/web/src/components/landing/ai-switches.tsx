"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/*
 * The two switches a CAF really has in its settings (components/console/admin/settings-section:
 * «AI per i cittadini», «Copilota per gli operatori»), with what each does on and what is left
 * off, in the words of their hints there. Flipping one here changes nothing anywhere: it shows
 * the consequence.
 */
const SWITCHES = [
  {
    setting: "AI per i cittadini",
    sentence: "Il cittadino racconta, l’AI capisce.",
    on: "Capisce il racconto, guida l’intervista e trascrive la voce.",
    off: "Domande una alla volta, e nulla va a un fornitore di AI.",
    field: "bg-stamp-wash",
  },
  {
    setting: "Copilota per gli operatori",
    sentence: "L’operatore riceve proposte, non decisioni.",
    on: "Riepilogo, controlli incrociati, importi dai documenti e bozze, ognuno etichettato.",
    off: "Restano i controlli con le regole, scritte con le fonti ufficiali.",
    field: "bg-marker-soft",
  },
] as const;

export function AiSwitches() {
  const [on, setOn] = useState<boolean[]>(() => SWITCHES.map(() => true));
  const baseId = useId();

  return (
    <ul>
      {SWITCHES.map((s, i) => {
        const checked = on[i] ?? true;
        const labelId = `${baseId}-${i}-label`;
        const noteId = `${baseId}-${i}-note`;
        return (
          <li
            key={s.setting}
            className={cn(
              "transition-colors duration-300 ease-(--ease-out)",
              checked ? s.field : "bg-paper",
            )}
          >
            <div className="frame grid min-h-[20vh] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 py-8 sm:py-10">
              <div className="min-w-0">
                <p
                  id={labelId}
                  className={cn(
                    "t-sub transition-colors duration-300",
                    checked ? "text-ink" : "text-ink-3",
                  )}
                >
                  {s.sentence}
                </p>
                <p id={noteId} className="t-body mt-2 max-w-[56ch] text-ink-2">
                  <span className="font-semibold text-ink">
                    {s.setting}, {checked ? "accesa" : "spenta"}:
                  </span>{" "}
                  {checked ? s.on : s.off}
                </p>
              </div>
              {/* The console's own switch, at the size of the sentence. */}
              <span data-ui className="inline-flex">
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={s.setting}
                  aria-describedby={noteId}
                  onClick={() => setOn((prev) => prev.map((v, k) => (k === i ? !v : v)))}
                  className={cn(
                    "relative inline-flex h-11 w-[4.5rem] shrink-0 items-center rounded-full p-1 transition-colors duration-200 ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stamp",
                    checked ? "bg-stamp" : "bg-line-field",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-9 rounded-full bg-surface transition-transform duration-200 ease-(--ease-out)",
                      checked ? "translate-x-7 rtl:-translate-x-7" : "translate-x-0",
                    )}
                  />
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
