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
      <section className="panel-night relative hidden flex-col justify-between overflow-hidden p-12 text-on-contrast lg:flex">
        {/* Ruled lines of a register, fading out downwards: paper, not a gradient. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_39px,rgb(255_255_255/0.045)_39px,rgb(255_255_255/0.045)_40px)] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <Link href="/" className="relative w-fit rounded-sm [&_span]:text-on-contrast">
          <Logo />
        </Link>
        <div className="relative max-w-xl">
          <p className="font-display text-[2.5rem] leading-[1.06] font-semibold tracking-[-0.022em] text-balance [font-stretch:92%]">
            Prima i <span className="marker whitespace-nowrap">problemi bloccanti</span>, poi gli
            avvisi, poi tutto il resto.
          </p>
          {/* The same order drawn as the top of a dossier, with invented content. */}
          <div
            aria-hidden
            className="mt-10 -rotate-1 rounded-lg bg-white p-4 text-[#141b2d] shadow-[0_28px_60px_-24px_rgb(0_0_0/0.6)]"
          >
            <div className="flex items-center justify-between border-b border-[#dde1e3] pb-3 text-xs font-semibold tracking-[0.06em] text-[#5d6477] uppercase">
              <span>Fascicolo ISEE</span>
              <span className="font-normal tracking-normal normal-case">Dati inventati</span>
            </div>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {(
                [
                  [AlertOctagon, "bg-[#b8322a]", "Mancano 2 documenti obbligatori"],
                  [AlertTriangle, "bg-[#9a5500]", "Carta d'identità in scadenza a gennaio"],
                  [CheckCircle2, "bg-[#1d7448]", "9 documenti verificati"],
                ] as const
              ).map(([Icon, tone, text]) => (
                <li key={text} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full ${tone}`}>
                    <Icon className="size-3.5 text-white" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="relative text-sm text-on-contrast/55">
          Accesso riservato agli operatori di CAF e patronati.
        </p>
      </section>
      <section className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-block rounded-sm lg:hidden">
            <Logo />
          </Link>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-[-0.025em]">
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
