"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

/** Recovery codes leave the server once: the operator must keep them before moving on. */
export function RecoveryCodes({
  codes,
  doneLabel,
  onDone,
}: {
  codes: string[];
  doneLabel: string;
  onDone: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const text = `Avanti — codici di recupero\nOgni codice funziona una sola volta.\n\n${codes.join("\n")}\n`;

  // The form that produced them is gone: bring focus (and screen readers) to the codes.
  useEffect(() => heading.current?.focus(), []);

  // The new codes are already the only valid ones: leaving now would lose them for good.
  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "avanti-codici-di-recupero.txt";
    document.body.append(link);
    link.click();
    link.remove();
    // Revoking in the same tick can cancel the download in Safari and Firefox.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="grid max-w-xl gap-5">
      <div className="rounded-md bg-ok-wash px-4 py-3 text-ok">
        Verifica in due passaggi attiva.
      </div>
      <div>
        <h3 ref={heading} tabIndex={-1} className="font-display text-lg font-semibold outline-none">
          Salva i codici di recupero
        </h3>
        <p className="mt-1 text-ink-2">
          Servono se perdi il telefono. Ognuno funziona una volta sola e non li mostreremo più:
          stampali o conservali in un posto sicuro, non sul telefono stesso.
        </p>
      </div>
      <ol
        translate="no"
        aria-label="Codici di recupero"
        className="font-code grid gap-x-6 gap-y-1.5 rounded-md bg-sunk p-4 text-sm sm:grid-cols-2"
      >
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-start gap-2">
        <CopyButton
          value={text}
          showValueOnFailure={false}
          labels={{
            copy: "Copia",
            copied: "Copiati",
            failed: "Copia non riuscita: selezionali dall'elenco o scarica il file.",
          }}
        />
        <Button type="button" variant="secondary" onClick={download}>
          <Download className="size-4" aria-hidden />
          Scarica .txt
        </Button>
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-1 size-4.5 shrink-0 accent-stamp"
        />
        <span>Ho salvato i codici in un posto sicuro</span>
      </label>
      <Button type="button" disabled={!saved} onClick={onDone} className="w-fit">
        {doneLabel}
      </Button>
    </div>
  );
}
