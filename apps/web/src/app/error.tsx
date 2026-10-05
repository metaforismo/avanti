"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em]">
          Qualcosa non ha funzionato
        </h1>
        <p className="mt-3 text-lg text-ink-2">
          Non hai perso nulla: quello che avevi già inviato è salvato. Riprova tra un momento.
        </p>
        <Button size="lg" className="mt-8" onClick={reset}>
          Riprova
        </Button>
        {error.digest && (
          <p className="mt-6 font-mono text-xs text-ink-3">Codice: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
