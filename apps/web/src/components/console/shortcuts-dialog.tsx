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
    title: "Visore dei documenti",
    keys: [
      [["V"], "Verifica la voce"],
      [["R"], "Rifiuta la voce, con il motivo"],
      [["←", "→"], "Documento precedente e successivo"],
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
      <div className="grid gap-6">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-sm font-semibold text-ink-2">{group.title}</h3>
            <dl className="mt-2 divide-y divide-line">
              {group.keys.map(([keys, label]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-body-sm">{label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {keys.map((key) => (
                      <kbd
                        key={key}
                        className="grid h-7 min-w-7 place-items-center rounded-md bg-sunk px-2 font-sans text-sm font-semibold text-ink-2 ring-1 ring-line"
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
