import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/console/login-form";

export const metadata: Metadata = { title: "Accesso operatori", robots: { index: false } };

// Light paper on the night panel in both themes: the light palette, fixed, not tokens that flip.
const CARD_COLORS = {
  "--card-ink": "#141b2d",
  "--card-ink-3": "#5d6477",
  "--card-line": "#dde1e3",
  "--card-danger": "#b8322a",
  "--card-warn": "#9a5500",
  "--card-ok": "#1d7448",
} as CSSProperties;

export default async function LoginPage({ searchParams }: PageProps<"/console/accedi">) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,32rem)]">
      <section className="panel-night relative hidden flex-col justify-between overflow-hidden p-12 text-on-contrast lg:flex">
        <Link href="/" className="relative w-fit rounded-sm [&_span]:text-on-contrast">
          <Logo />
        </Link>
        <div className="relative max-w-xl">
          <p className="font-display text-[2.5rem] leading-[1.06] font-semibold tracking-[-0.022em] text-balance [font-stretch:92%]">
            Prima i{" "}
            {/* The stroke ends on the letters: the shared marker softens its ends and runs past the last «i». */}
            <span
              className="marker whitespace-nowrap"
              style={{
                backgroundImage: "linear-gradient(var(--marker), var(--marker))",
                backgroundSize: "100% 0.88em",
                paddingInline: "0.05em",
                marginInline: "-0.05em",
              }}
            >
              problemi bloccanti
            </span>
            , poi gli avvisi, poi tutto il resto.
          </p>
          {/* The same order drawn as the top of a dossier, as the console shows it: the colour
              is on the 16 px icon, never a disc. Invented content, and it says so. */}
          <div
            aria-hidden
            data-ui
            style={CARD_COLORS}
            className="mt-10 -rotate-1 rounded-md bg-white p-4 text-(--card-ink) will-change-transform [backface-visibility:hidden]"
          >
            <div className="flex items-center justify-between border-b border-(--card-line) pb-3 text-[0.8125rem]">
              <span className="font-semibold">Fascicolo ISEE</span>
              <span className="text-(--card-ink-3)">Dati inventati</span>
            </div>
            <ul className="mt-2 grid text-sm">
              {(
                [
                  [AlertOctagon, "text-(--card-danger)", "Mancano 2 documenti obbligatori"],
                  [AlertTriangle, "text-(--card-warn)", "Carta d'identità in scadenza a gennaio"],
                  [CheckCircle2, "text-(--card-ok)", "9 documenti verificati"],
                ] as const
              ).map(([Icon, tone, text]) => (
                <li key={text} className="flex items-center gap-2.5 py-1.5">
                  <Icon className={`size-4 shrink-0 ${tone}`} />
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
          <h1 className="font-display text-2xl leading-tight font-bold tracking-[-0.02em] sm:text-[1.75rem]">
            Accedi alla console
          </h1>
          <p className="mt-2 text-sm text-ink-2">
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
