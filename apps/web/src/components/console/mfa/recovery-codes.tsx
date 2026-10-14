"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
  const [copied, setCopied] = useState(false);
  const text = `Avanti — codici di recupero\nOgni codice funziona una sola volta.\n\n${codes.join("\n")}\n`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "avanti-codici-di-recupero.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid max-w-xl gap-5">
      <div role="status" className="rounded-md bg-ok-wash px-4 py-3 text-ok">
        Verifica in due passaggi attiva.
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold">Salva i codici di recupero</h3>
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
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? "Copiati" : "Copia"}
        </Button>
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
