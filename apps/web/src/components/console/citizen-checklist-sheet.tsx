"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import type { CitizenHandoff, CitizenHandoffItem, Language } from "@avanti/contracts";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { directionOf } from "@/lib/citizen/document-language";
import { HANDOFF_MESSAGES } from "@/lib/citizen/handoff-messages";
import { format, messagesFor } from "@/lib/citizen/messages";
import { LANGUAGE_IT } from "@/lib/console/labels";
import { recordHandoff } from "./citizen-notice";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string; signedOut: boolean }
  | { state: "ready"; handoff: CitizenHandoff };

/**
 * Italian under each line, laid out left to right but aligned with the line above it: on an
 * Arabic sheet that is the right edge.
 */
const italianUnder = (language: Language) =>
  directionOf(language) === "rtl" ? "text-right" : "text-left";

/** People in the order the checklist names them; household-wide documents last. */
function byPerson(items: CitizenHandoffItem[]) {
  const groups = new Map<string | null, CitizenHandoffItem[]>();
  for (const item of items)
    groups.set(item.memberName, [...(groups.get(item.memberName) ?? []), item]);
  return [...groups].sort(([a], [b]) => Number(a === null) - Number(b === null));
}

/**
 * A4 list for a citizen without a smartphone, or who prefers paper: what to bring, in their
 * language with the Italian under each line so any colleague at the desk can read it too.
 */
export function CitizenChecklistSheet({ caseId }: { caseId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    let live = true;
    apiFetch<CitizenHandoff>(`/api/cases/${encodeURIComponent(caseId)}/citizen-handoff`)
      .then((handoff) => live && setLoad({ state: "ready", handoff }))
      .catch(
        (err: unknown) =>
          live &&
          setLoad({
            state: "error",
            signedOut: err instanceof ApiRequestError && err.status === 401,
            message:
              err instanceof ApiRequestError && err.status === 404
                ? "Pratica non trovata: forse è stata cancellata."
                : err instanceof ApiRequestError
                  ? err.message
                  : "Elenco non disponibile. Riprova tra poco.",
          }),
      );
    return () => {
      live = false;
    };
  }, [caseId, attempt]);

  // Ctrl+P prints as well as the button: both are recorded, once per page view.
  useEffect(() => {
    if (load.state !== "ready") return;
    const onPrint = () => {
      if (recorded.current) return;
      recorded.current = true;
      void recordHandoff(caseId, "print");
    };
    window.addEventListener("beforeprint", onPrint);
    return () => window.removeEventListener("beforeprint", onPrint);
  }, [caseId, load.state]);

  const dossierHref = `/console/pratiche/${encodeURIComponent(caseId)}` as Route;

  if (load.state === "loading")
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        <Spinner label="Preparazione dell'elenco" />
      </div>
    );
  if (load.state === "error")
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <Notice
          tone="danger"
          size="page"
          role="alert"
          className="max-w-md"
          title={load.signedOut ? "La sessione è scaduta." : load.message}
          action={
            <div className="flex flex-wrap gap-2">
              {load.signedOut ? (
                <Button asChild>
                  <Link
                    href={
                      `/console/accedi?next=${encodeURIComponent(`/console/stampa/${caseId}`)}` as Route
                    }
                  >
                    Accedi di nuovo
                  </Link>
                </Button>
              ) : (
                <Button onClick={() => setAttempt((n) => n + 1)}>Riprova</Button>
              )}
              <Button asChild variant="secondary">
                <Link href={dossierHref}>Torna al fascicolo</Link>
              </Button>
            </div>
          }
        />
      </div>
    );

  const { handoff } = load;
  const required = handoff.items.filter((item) => item.required);
  const optional = handoff.items.filter((item) => !item.required);

  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 14mm } @media print { body { background: #fff } }`}</style>
      <div className="mx-auto grid max-w-[210mm] gap-3 px-4 pt-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link href={dossierHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Fascicolo {handoff.reference}
            </Link>
          </Button>
          <Button onClick={() => window.print()} disabled={handoff.items.length === 0}>
            <Printer className="size-4" aria-hidden />
            Stampa
          </Button>
        </div>
        {!handoff.interviewComplete && (
          <Notice tone="warn" title="Le domande non sono finite: l'elenco può ancora cambiare.">
            Completa l&apos;intervista con il cittadino prima di stampare, così l&apos;elenco è
            quello definitivo.
          </Notice>
        )}
        {handoff.language !== "it" && (
          <p className="text-sm text-ink-3">
            In {LANGUAGE_IT[handoff.language].toLowerCase()}, con l&apos;italiano sotto ogni voce.
          </p>
        )}
      </div>
      <Sheet handoff={handoff} required={required} optional={optional} />
    </>
  );
}

function Sheet({
  handoff,
  required,
  optional,
}: {
  handoff: CitizenHandoff;
  required: CitizenHandoffItem[];
  optional: CitizenHandoffItem[];
}) {
  const lang = handoff.language;
  const m = messagesFor(lang);
  const h = HANDOFF_MESSAGES[lang];
  const bilingual = lang !== "it";
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "Europe/Rome" });
  const office = handoff.office;

  return (
    <article
      lang={lang}
      dir={directionOf(lang)}
      className="mx-auto my-4 w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[11pt] text-ink shadow-float print:my-0 print:max-w-none print:p-0 print:shadow-none"
    >
      <header className="flex items-start justify-between gap-6 border-b border-line pb-[4mm]">
        <div lang="it" dir="ltr" className="text-start">
          <p className="font-display text-[16pt] leading-tight font-bold">
            {handoff.organization.name}
          </p>
          {office && (
            <p className="text-[10pt] text-ink-2">
              {office.name} · {[office.address, office.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <div className="text-end">
          <p className="text-[9pt] text-ink-3">{m.done.reference}</p>
          <p className="font-mono text-[14pt] font-semibold tracking-wide" dir="ltr" translate="no">
            {handoff.reference}
          </p>
        </div>
      </header>

      <h1 className="mt-[6mm] font-display text-[22pt] leading-tight font-bold">{h.sheetTitle}</h1>
      {bilingual && (
        <p lang="it" dir="ltr" className={`text-[11pt] text-ink-2 ${italianUnder(lang)}`}>
          {HANDOFF_MESSAGES.it.sheetTitle}
        </p>
      )}
      {handoff.practice && (
        <p className="mt-[2mm] font-semibold">
          {handoff.practice.name}
          {bilingual && handoff.practice.name !== handoff.practice.nameIt && (
            <span lang="it" className="font-normal text-ink-2">
              {" "}
              · {handoff.practice.nameIt}
            </span>
          )}
        </p>
      )}
      <p className="mt-[2mm] text-ink-2">{h.sheetLead}</p>

      {handoff.items.length === 0 ? (
        <p className="mt-[6mm] font-semibold">{h.sheetEmpty}</p>
      ) : (
        <>
          {byPerson(required).map(([person, items]) => (
            <ItemGroup
              key={person ?? "household"}
              title={person ?? m.docs.household}
              titleIt={person ? null : bilingual ? messagesFor("it").docs.household : null}
              items={items}
              language={lang}
            />
          ))}
          {optional.length > 0 && (
            <ItemGroup
              title={m.docs.optional}
              titleIt={bilingual ? messagesFor("it").docs.optional : null}
              items={optional}
              language={lang}
            />
          )}
        </>
      )}

      <footer className="mt-[6mm] grid break-inside-avoid gap-[1.5mm] border-t border-line pt-[4mm] text-[10pt]">
        <p className="font-semibold">
          {m.done.bring}
          {bilingual && (
            <span
              lang="it"
              dir="ltr"
              className={`block font-normal text-ink-2 ${italianUnder(lang)}`}
            >
              {messagesFor("it").done.bring}
            </span>
          )}
        </p>
        {office?.bookingUrl && (
          <p>
            {h.book}{" "}
            <span dir="ltr" className="font-mono text-[9pt] break-all">
              {office.bookingUrl}
            </span>
          </p>
        )}
        {(office?.openingHours || office?.phone) && (
          <p lang="it" dir="ltr" className={`text-ink-2 ${italianUnder(lang)}`}>
            {[office.openingHours, office.phone].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="flex items-center justify-between gap-4 text-[9pt] text-ink-3">
          <span>{format(h.sheetDate, { date: date.format(new Date()) })}</span>
          <span className="flex items-center gap-1.5" dir="ltr">
            <LogoMark className="size-4" />
            Avanti
          </span>
        </p>
      </footer>
    </article>
  );
}

function ItemGroup({
  title,
  titleIt,
  items,
  language,
}: {
  title: string;
  titleIt: string | null;
  items: CitizenHandoffItem[];
  language: Language;
}) {
  const m = messagesFor(language);
  const bilingual = language !== "it";
  return (
    <section className="mt-[5mm]">
      <h2
        className="break-after-avoid border-b border-line pb-[1mm] text-[12pt] font-bold"
        dir="auto"
      >
        {title}
        {titleIt && (
          <span lang="it" className="font-normal text-ink-2">
            {" "}
            · {titleIt}
          </span>
        )}
      </h2>
      <ul className="mt-[2mm] grid gap-[2.5mm]">
        {items.map((item) => (
          <li key={item.id} className="flex break-inside-avoid gap-[3mm]">
            <span
              aria-hidden
              className="mt-[0.5mm] size-[4.5mm] shrink-0 rounded-[1mm] border-[0.4mm] border-ink"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold" dir="auto">
                {item.title}
                {item.status !== "missing" && (
                  <span className="ms-2 rounded-sm bg-warn-wash px-1.5 text-[9pt] font-semibold text-warn print:border print:border-ink print:bg-transparent print:text-ink">
                    {m.docs.status[item.status]}
                  </span>
                )}
              </p>
              {bilingual && item.titleIt !== item.title && (
                <p
                  lang="it"
                  dir="ltr"
                  className={`text-[10pt] text-ink-2 ${italianUnder(language)}`}
                >
                  {item.titleIt}
                </p>
              )}
              {item.howToGet && (
                <p className="mt-[0.5mm] text-[9.5pt] text-ink-2">
                  <span className="font-semibold">{m.docs.howToGet}:</span> {item.howToGet}
                </p>
              )}
              {item.note && (
                <p className="mt-[0.5mm] text-[9.5pt]">
                  <span className="font-semibold">{m.docs.operatorNote}:</span>{" "}
                  <span dir="auto">{item.note}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
