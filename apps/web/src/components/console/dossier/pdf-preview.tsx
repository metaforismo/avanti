"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

type State = { kind: "loading" } | { kind: "ready"; src: string } | { kind: "error" };

/**
 * Files are always served as attachments (a citizen's upload must never render as a page of
 * this origin), so the PDF is fetched and shown from a local blob URL instead.
 */
export function PdfPreview({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let src: string | null = null;
    let cancelled = false;
    fetch(url, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        src = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setState({ kind: "ready", src });
      })
      .catch(() => !cancelled && setState({ kind: "error" }));
    return () => {
      cancelled = true;
      if (src) URL.revokeObjectURL(src);
    };
  }, [url]);

  if (state.kind === "loading") {
    return (
      <div className="grid min-h-[70dvh] place-items-center text-ink-3">
        <Spinner label="Caricamento del documento" />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <p role="alert" className="p-8 text-center text-ink-2">
        Anteprima non disponibile. Usa il pulsante di download per aprire il file.
      </p>
    );
  }
  return <iframe src={state.src} title={title} className="size-full min-h-[70dvh]" />;
}
