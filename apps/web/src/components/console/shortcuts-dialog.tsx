"use client";

import { Dialog } from "@/components/ui/dialog";

const GROUPS = [
  {
    title: "Ovunque",
    keys: [
      [["⌘", "K"], "Cerca pratiche, pagine e azioni (Ctrl+K su Windows)"],
      [["?"], "Mostra queste scorciatoie"],
      [["Esc"], "Chiude finestre e menu"],
    ],
  },
  {
    title: "Coda delle pratiche",
    keys: [[["/"], "Va alla ricerca nella coda; Esc la svuota"]],
  },
  {
    title: "Fascicolo",
    keys: [
      [["V"], "Controlla i documenti uno per uno"],
      [["I"], "Chiedi un'integrazione"],
      [["P"], "Segna come pronta"],
      [["N"], "Prossima pratica della coda, con gli stessi filtri"],
    ],
  },
  {
    title: "Visore dei documenti",
    keys: [
      [["V"], "Verifica la voce e passa al documento successivo"],
      [["R"], "Rifiuta la voce, con il motivo"],
      [["←", "→"], "Documento precedente e successivo"],
      [["Invio"], "Torna al fascicolo, finito il controllo"],
    ],
  },
] as const;

/** Every keyboard shortcut of the console in one place, so nobody has to discover them by chance. */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Scorciatoie da tastiera">
      <div className="grid gap-5">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-xs font-semibold text-ink-3">{group.title}</h3>
            <dl className="mt-1 divide-y divide-line">
              {group.keys.map(([keys, label]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-body-sm">{label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {keys.map((key) => (
                      <kbd
                        key={key}
                        className="grid h-6 min-w-6 place-items-center rounded-xs bg-surface px-1.5 font-sans text-xs font-semibold text-ink-2 shadow-[inset_0_-1px_0_var(--line-strong)] ring-1 ring-line"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/** True when a key press belongs to a field the operator is typing in. */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
