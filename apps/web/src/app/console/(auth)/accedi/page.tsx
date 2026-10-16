import type { Metadata } from "next";
import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/console/login-form";

export const metadata: Metadata = { title: "Accesso operatori", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/console/accedi">) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,32rem)]">
      <section className="panel-night hidden flex-col justify-between p-12 text-on-contrast lg:flex">
        <Link href="/" className="w-fit rounded-sm [&_span]:text-on-contrast">
          <Logo />
        </Link>
        <blockquote className="max-w-md">
          <p className="font-display text-4xl leading-[1.05] font-semibold tracking-[-0.02em] [font-stretch:92%]">
            Prima i problemi bloccanti, poi gli avvisi, poi tutto il resto.
          </p>
          <footer className="mt-4 text-on-contrast/60">Come è ordinato ogni fascicolo</footer>
          {/* The same order drawn as the top of a dossier, with invented content. */}
          <ul aria-hidden className="mt-10 grid gap-2 text-sm">
            {(
              [
                [AlertOctagon, "bg-danger", "Mancano 2 documenti obbligatori"],
                [AlertTriangle, "bg-warn", "Carta d'identità in scadenza a gennaio"],
                [CheckCircle2, "bg-ok", "9 documenti verificati"],
              ] as const
            ).map(([Icon, tone, text]) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-lg bg-on-contrast/5 px-3 py-2.5 ring-1 ring-on-contrast/10"
              >
                <span className={`grid size-6 shrink-0 place-items-center rounded-full ${tone}`}>
                  <Icon className="size-3.5 text-white" />
                </span>
                <span className="text-on-contrast/85">{text}</span>
              </li>
            ))}
          </ul>
        </blockquote>
        <p className="text-sm text-on-contrast/50">
          Accesso riservato agli operatori di CAF e patronati.
        </p>
      </section>
      <section className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block rounded-sm lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">
            Accedi alla console
          </h1>
          <p className="mt-2 text-ink-2">
            Usa le credenziali che ti ha dato il responsabile del tuo CAF.
          </p>
          <LoginForm nextPath={one(params.next)} expired={one(params.motivo) === "sessione"} />
          {/* Citizens sometimes land here from a search: they never need an account. */}
          <p className="mt-10 border-t border-line pt-5 text-sm text-ink-2">
            Devi preparare una pratica? Non serve accedere: apri il link o inquadra il QR che ti ha
            dato lo sportello del tuo CAF.
          </p>
        </div>
      </section>
    </main>
  );
}
