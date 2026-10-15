import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/console/login-form";

export const metadata: Metadata = { title: "Accesso operatori", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,32rem)]">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Link href="/" className="w-fit rounded-sm [&_span]:text-white">
          <Logo />
        </Link>
        <blockquote className="max-w-md">
          <p className="font-display text-4xl leading-[1.05] font-semibold tracking-[-0.02em] [font-stretch:92%]">
            Prima i problemi bloccanti, poi gli avvisi, poi tutto il resto.
          </p>
          <footer className="mt-4 text-white/60">Come è ordinato ogni fascicolo</footer>
        </blockquote>
        <p className="text-sm text-white/50">
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
          <Suspense>
            <LoginForm />
          </Suspense>
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
