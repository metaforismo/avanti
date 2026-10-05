import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <Link href="/" className="inline-block rounded-sm">
          <Logo />
        </Link>
        <p className="mt-10 font-mono text-sm text-ink-3">404</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.03em]">
          Questa pagina non esiste
        </h1>
        <p className="mt-3 text-lg text-ink-2">
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
