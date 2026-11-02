import Link from "next/link";
import { QueueTicket } from "@/components/brand/desk-objects";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

// Root level: shared by every area, so no display face is imported here (see lib/fonts.ts).
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <Link href="/" className="inline-block rounded-sm" aria-label="Avanti, pagina iniziale">
          <Logo />
        </Link>
        <div className="mt-12 flex justify-center">
          <QueueTicket number="404" label="Numero" className="rotate-[-4deg] animate-pop" />
        </div>
        <h1 className="mt-8 animate-rise font-display text-4xl font-bold tracking-[-0.01em]">
          Questa pagina non esiste
        </h1>
        <p className="mt-3 animate-rise text-lg text-ink-2 [animation-delay:60ms]">
          Se stavi aprendo il link della tua pratica, controlla di averlo copiato per intero oppure
          chiedi allo sportello di inviarlo di nuovo.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-8">
          <Link href="/">Vai alla pagina iniziale</Link>
        </Button>
      </div>
    </main>
  );
}
