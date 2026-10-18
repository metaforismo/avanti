"use client";

import {
  BookOpen,
  Check,
  MapPin,
  Printer,
  ShieldCheck,
  Smartphone,
  Timer,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Route } from "next";
import type { CaseStatus, OperatorSummary, OrganizationSettings } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import {
  firstSteps,
  markFirstStep,
  showFirstSteps,
  useMarkedFirstSteps,
  type FirstStepKey,
} from "@/lib/console/first-steps";
import { useOperator } from "@/lib/console/operator-context";
import { useResource, type Resource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";

type Action = { label: string; href: Route } | { label: string; onClick: () => void };

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
  doneBody?: string;
  action: Action;
  /** Once done: a way back to change it, or nothing to do. */
  doneAction?: Action;
};

/** Loading is `undefined`, a failed load `null`: the step then shows as still to do. */
const loaded = <T, R>(resource: Resource<T>, pick: (data: T) => R) =>
  resource.data !== null ? pick(resource.data) : resource.status === "error" ? null : undefined;

/**
 * A CAF's first day: nothing is waiting in the queue yet, so it shows how to set up the office
 * and get the first dossier, with what is already done ticked off and the next step in front.
 * When the first day is over it shows `fallback`, the queue's ordinary empty state.
 */
export function FirstSteps({
  counts,
  onNewCase,
  fallback,
}: {
  counts: Partial<Record<CaseStatus, number>>;
  onNewCase: () => void;
  fallback: ReactNode;
}) {
  const operator = useOperator();
  const admin = operator.role === "admin";
  const marked = useMarkedFirstSteps(operator.id);
  const operators = useResource<OperatorSummary[]>(admin ? "/api/operators" : null);
  const settings = useResource<OrganizationSettings>(admin ? "/api/settings" : null);

  const progress = firstSteps({
    admin,
    offices: operator.offices,
    mfaEnabled: operator.mfaEnabled,
    counts,
    operators: loaded(operators, (list) => list),
    baselineSet: loaded(settings, (data) => data.baselineMinutesPerCase !== null),
    marked,
  });
  if (!showFirstSteps(counts, progress)) return fallback;

  const STEPS: Record<FirstStepKey, Step> = {
    office: {
      icon: MapPin,
      title: "Completa i dati dello sportello",
      body: "Orari, telefono e link per prenotare: il cittadino li vede all'inizio e dopo l'invio.",
      action: { label: "Completa lo sportello", href: "/console/impostazioni#sportelli" },
      doneAction: { label: "Modifica", href: "/console/impostazioni#sportelli" },
    },
    poster: {
      icon: Printer,
      title: "Appendi il cartello in sala d'attesa",
      body: "Un A4 con il QR dello sportello e il titolo in otto lingue.",
      action: { label: "Vai al cartello", href: "/console/sportelli" },
      doneAction: { label: "Ristampa", href: "/console/sportelli" },
    },
    trial: {
      icon: Smartphone,
      title: "Prova il percorso del cittadino",
      body: "Crea una pratica di prova e aprila dal tuo telefono: in dieci minuti vedi quello che vedranno i cittadini.",
      doneBody:
        "La pratica di prova è in «In compilazione»: inviala dal telefono per vedere come arriva il fascicolo.",
      action: { label: "Crea una pratica di prova", onClick: onNewCase },
      doneAction: { label: "Apri «In compilazione»", href: "/console?stato=intake" },
    },
    colleagues: {
      icon: UserPlus,
      title: "Aggiungi i colleghi",
      body: "Ognuno con il suo accesso: la cronologia dice chi ha fatto cosa.",
      action: { label: "Aggiungi un collega", href: "/console/impostazioni#nuovo-operatore" },
      doneAction: { label: "Gestisci operatori", href: "/console/impostazioni#operatori" },
    },
    baseline: {
      icon: Timer,
      title: "Misura i tempi di oggi",
      body: "Quanti minuti richiede una pratica senza Avanti? Serve alle metriche per confrontare.",
      action: { label: "Scrivi i minuti per pratica", href: "/console/impostazioni#baseline" },
      doneAction: { label: "Modifica", href: "/console/impostazioni#baseline" },
    },
    mfa: {
      icon: ShieldCheck,
      title: "Proteggi il tuo accesso",
      body: "Con la verifica in due passaggi, oltre alla password serve un codice dall'app sul telefono.",
      action: { label: "Attiva la verifica", href: "/console/account#verifica" },
    },
    guide: {
      icon: BookOpen,
      title: "Leggi la guida",
      body: "Dieci minuti: la coda, il fascicolo, le integrazioni, le metriche.",
      action: { label: "Apri la guida", href: "/console/aiuto" },
      doneAction: { label: "Riapri", href: "/console/aiuto" },
    },
  };
  // Reading leaves no trace Avanti could check. The sign is ticked by the print link itself.
  const onFollow: Partial<Record<FirstStepKey, () => void>> = {
    guide: () => markFirstStep(operator.id, "guide"),
  };

  const { next, total } = progress;
  const lead = !progress.known
    ? "I fascicoli inviati dai cittadini arriveranno qui."
    : !next
      ? "Tutto pronto. I fascicoli arriveranno qui appena un cittadino li invia."
      : admin
        ? "I fascicoli inviati dai cittadini arriveranno qui. Intanto prepara lo sportello, un passo alla volta."
        : "I fascicoli inviati dai cittadini arriveranno qui. Intanto, quattro passi per partire.";

  return (
    <section aria-labelledby="first-steps" className="rounded-lg bg-surface p-6 ring-1 ring-line">
      <SectionHeader id="first-steps" title="Per iniziare" lead={lead} />
      {/* Hidden while a fact is loading: a count that jumps reads as an error. */}
      <div className={cn("mt-4 flex items-center gap-3", !progress.known && "invisible")}>
        <ProgressBar
          value={(progress.done / total) * 100}
          label="Passi fatti"
          tone={next ? "stamp" : "ok"}
          className="max-w-48 flex-1"
        />
        <p className="tabular text-sm text-ink-2">
          {progress.done} di {total} fatti
        </p>
      </div>
      <ol className="mt-5 grid gap-3">
        {progress.steps.map(({ key, done }, index) => {
          const step = STEPS[key];
          const action = done ? step.doneAction : step.action;
          const Icon = done ? Check : step.icon;
          return (
            <li
              key={key}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md p-4 ring-1",
                key === next ? "bg-surface ring-stamp/40" : "bg-paper ring-line",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  done ? "bg-ok-wash text-ok" : "bg-stamp-wash text-stamp",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 basis-60">
                <p className="font-semibold">
                  <span className="sr-only">
                    Passo {index + 1}
                    {done ? ", fatto" : ""}:{" "}
                  </span>
                  {step.title}
                  {done && (
                    <span aria-hidden className="ms-2 text-sm font-normal text-ok">
                      Fatto
                    </span>
                  )}
                </p>
                <p className="text-sm text-ink-2">{(done && step.doneBody) || step.body}</p>
              </div>
              {action && (
                <StepAction
                  action={action}
                  variant={key === next ? "primary" : done ? "ghost" : "secondary"}
                  onFollow={done ? undefined : onFollow[key]}
                />
              )}
            </li>
          );
        })}
      </ol>
      {admin && (
        <p className="mt-5 text-sm text-ink-2">
          Hai un dubbio?{" "}
          <Link
            href="/console/aiuto"
            className="font-semibold text-stamp underline underline-offset-2"
          >
            Apri la guida
          </Link>{" "}
          oppure premi <kbd className="font-sans font-semibold">?</kbd> per le scorciatoie.
        </p>
      )}
    </section>
  );
}

function StepAction({
  action,
  variant,
  onFollow,
}: {
  action: Action;
  variant: "primary" | "secondary" | "ghost";
  onFollow?: () => void;
}) {
  if ("href" in action)
    return (
      <Button asChild variant={variant} size="sm">
        <Link href={action.href} onClick={onFollow}>
          {action.label}
        </Link>
      </Button>
    );
  return (
    <Button variant={variant} size="sm" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
