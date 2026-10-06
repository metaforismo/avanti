"use client";

import { BookOpen, Printer, Smartphone, Timer, UserPlus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { useOperator } from "@/lib/console/operator-context";
import { NewCaseDialog } from "./new-case-dialog";

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
  action: { label: string; href: Route } | { label: string; onClick: () => void };
};

/** A CAF's first day: the queue is empty, so it shows how to get the first dossier. */
export function FirstSteps() {
  const operator = useOperator();
  const [creating, setCreating] = useState(false);
  const admin = operator.role === "admin";

  const steps: Step[] = [
    {
      icon: Printer,
      title: "Appendi il cartello in sala d'attesa",
      body: "Un A4 con il QR dello sportello e il titolo in otto lingue.",
      action: { label: "Stampa il cartello", href: "/console/sportelli" },
    },
    {
      icon: Smartphone,
      title: "Prova il percorso del cittadino",
      body: "Crea una pratica di prova e aprila dal tuo telefono: in dieci minuti vedi quello che vedranno i cittadini.",
      action: { label: "Crea una pratica di prova", onClick: () => setCreating(true) },
    },
    ...(admin
      ? ([
          {
            icon: UserPlus,
            title: "Aggiungi i colleghi",
            body: "Ognuno con il suo accesso: la cronologia dice chi ha fatto cosa.",
            action: { label: "Gestisci operatori", href: "/console/impostazioni" },
          },
          {
            icon: Timer,
            title: "Misura i tempi di oggi",
            body: "Quanti minuti richiede una pratica senza Avanti? Serve alle metriche per confrontare.",
            action: { label: "Imposta la baseline", href: "/console/impostazioni" },
          },
        ] satisfies Step[])
      : []),
    {
      icon: BookOpen,
      title: "Leggi la guida",
      body: "Dieci minuti: la coda, il fascicolo, le integrazioni, le metriche.",
      action: { label: "Apri la guida", href: "/console/aiuto" },
    },
  ];

  return (
    <section aria-labelledby="first-steps" className="rounded-lg bg-surface p-6 ring-1 ring-line">
      <h2 id="first-steps" className="font-display text-xl font-semibold">
        Per iniziare
      </h2>
      <p className="mt-1 text-ink-2">
        I fascicoli inviati dai cittadini arriveranno qui. Intanto, {steps.length} passi per
        partire.
      </p>
      <ol className="mt-5 grid gap-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md bg-paper p-4 ring-1 ring-line"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stamp-wash text-stamp">
              <step.icon className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 basis-60">
              <p className="font-semibold">
                <span className="sr-only">Passo {index + 1}: </span>
                {step.title}
              </p>
              <p className="text-sm text-ink-2">{step.body}</p>
            </div>
            {"href" in step.action ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={step.action.href}>{step.action.label}</Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={step.action.onClick}>
                {step.action.label}
              </Button>
            )}
          </li>
        ))}
      </ol>
      <NewCaseDialog open={creating} onOpenChange={setCreating} />
    </section>
  );
}
