"use client";

import { useEffect, useState } from "react";
import { apiDownload, ApiRequestError } from "@/lib/api";

type State =
  { kind: "loading" } | { kind: "ready"; src: string } | { kind: "error"; message: string | null };

/**
 * Files are always served as attachments (a citizen's upload must never render as a page of
 * this origin), so the PDF is fetched and shown from a local blob URL instead.
 */
export function PdfPreview({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let src: string | null = null;
    let cancelled = false;
    apiDownload(url)
      .then(({ blob }) => {
        if (cancelled) return;
        src = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setState({ kind: "ready", src });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // A file that is fine but not previewable keeps the generic hint; a session that ended
        // or a lost connection says so.
        const known = error instanceof ApiRequestError && [0, 401, 429].includes(error.status);
        setState({ kind: "error", message: known ? (error as ApiRequestError).message : null });
      });
    return () => {
      cancelled = true;
      if (src) URL.revokeObjectURL(src);
    };
  }, [url]);

  if (state.kind === "loading") {
    return (
      // The page about to appear, at A4 proportions: the panel keeps its shape while it loads.
      <div role="status" className="grid min-h-[70dvh] place-items-center p-6">
        <span className="sr-only">Caricamento del documento</span>
        <div
          aria-hidden
          className="aspect-[1/1.414] h-[min(70dvh,calc(100dvh-9rem))] max-w-full animate-pulse rounded-xs bg-surface shadow-raised ring-1 ring-line"
        />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <p role="alert" className="mx-auto max-w-sm p-8 text-center text-body-sm text-ink-2">
        Anteprima non disponibile.{" "}
        {state.message ?? "Usa il pulsante di download per aprire il file."}
      </p>
    );
  }
  return <iframe src={state.src} title={title} className="size-full min-h-[70dvh]" />;
}
