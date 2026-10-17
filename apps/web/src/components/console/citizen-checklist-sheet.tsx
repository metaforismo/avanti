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
  | { state: "error"; message: string; status: number }
  | { state: "ready"; handoff: CitizenHandoff };

/** People in the order the checklist names them; household-wide documents last. */
function byPerson(items: CitizenHandoffItem[]) {
  const groups = new Map<string | null, CitizenHandoffItem[]>();
  for (const item of items)
    groups.set(item.memberName, [...(groups.get(item.memberName) ?? []), item]);
  return [...groups].sort(([a], [b]) => Number(a === null) - Number(b === null));
}

/**
 * The request writes its message as the note of every item it names: printed once at the top,
 * with any note shared by several items. A note only one item carries stays under it.
 */
function sheetNotes(handoff: CitizenHandoff) {
  const counts = new Map<string, number>();
  for (const item of handoff.items)
    if (item.note) counts.set(item.note, (counts.get(item.note) ?? 0) + 1);
  const shared = [...counts].filter(([, n]) => n > 1).map(([note]) => note);
  const top = new Set([...(handoff.request ? [handoff.request.textIt] : []), ...shared]);
  return {
    shared: shared.filter((note) => note !== handoff.request?.textIt),
    under: (item: CitizenHandoffItem) => (item.note && !top.has(item.note) ? item.note : null),
  };
}

/**
 * A4 list for a citizen without a smartphone, or who prefers paper: what to bring, in their
 * language with the Italian under each line so any colleague at the desk can read it too.
 */
export function CitizenChecklistSheet({ caseId }: { caseId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
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
            status: err instanceof ApiRequestError ? err.status : 0,
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
      void recordHandoff(caseId, "print").then(setRecordError);
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
  if (load.state === "error") {
    const next = encodeURIComponent(`/console/stampa/${caseId}`);
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <Notice
          tone="danger"
          size="page"
          role="alert"
          className="max-w-md"
          title={load.status === 401 ? "La sessione è scaduta." : load.message}
          action={
            <div className="flex flex-wrap gap-2">
              {load.status === 401 ? (
                <Button asChild>
                  <Link href={`/console/accedi?motivo=sessione&next=${next}` as Route}>
                    Accedi di nuovo
                  </Link>
                </Button>
              ) : load.status !== 403 ? (
                <Button onClick={() => setAttempt((n) => n + 1)}>Riprova</Button>
              ) : null}
              <Button asChild variant="secondary">
                {load.status === 403 ? (
                  <Link href="/console">Torna alla console</Link>
                ) : (
                  <Link href={dossierHref}>Torna al fascicolo</Link>
                )}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const { handoff } = load;
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
          <Button onClick={() => window.print()}>
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
        {recordError && (
          <Notice tone="warn" role="alert">
            {recordError}
          </Notice>
        )}
        {handoff.language !== "it" && (
          <p className="text-sm text-ink-3">
            In {LANGUAGE_IT[handoff.language].toLowerCase()}, con l&apos;italiano sotto ogni voce.
          </p>
        )}
      </div>
      <Sheet handoff={handoff} />
    </>
  );
}

/** Italian under a line of the citizen's language: same alignment, its own direction. */
function Italian({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span lang="it" className={`block text-ink-2 ${className}`}>
      <bdi>{children}</bdi>
    </span>
  );
}

function Sheet({ handoff }: { handoff: CitizenHandoff }) {
  const lang = handoff.language;
  const m = messagesFor(lang);
  const it = messagesFor("it");
  const h = HANDOFF_MESSAGES[lang];
  const bilingual = lang !== "it";
  // The same locale the citizen app formats its numbers with, so digits match what they see.
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "Europe/Rome" });
  const office = handoff.office;
  const required = handoff.items.filter((item) => item.required);
  const optional = handoff.items.filter((item) => !item.required);
  const notes = sheetNotes(handoff);
  const request = handoff.request;
  const translated = request && request.text !== request.textIt;

  return (
    <article
      lang={lang}
      dir={directionOf(lang)}
      className="mx-auto my-4 w-full max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[11pt] text-ink shadow-float print:my-0 print:max-w-none print:p-0 print:shadow-none"
    >
      <header className="flex items-start justify-between gap-6 border-b border-line pb-[4mm]">
        <div lang="it">
          <p className="font-display text-[16pt] leading-tight font-bold">
            <bdi>{handoff.organization.name}</bdi>
          </p>
          {office && (
            <p className="text-[10pt] text-ink-2">
              <bdi>
                {office.name} · {[office.address, office.city].filter(Boolean).join(", ")}
              </bdi>
            </p>
          )}
        </div>
        <div className="text-end">
          <p className="text-[9pt] text-ink-3">{m.done.reference}</p>
          <p className="font-mono text-[14pt] font-semibold tracking-wide" translate="no">
            <bdi>{handoff.reference}</bdi>
          </p>
        </div>
      </header>

      <h1 className="mt-[6mm] font-display text-[22pt] leading-tight font-bold">{h.sheetTitle}</h1>
      {bilingual && <Italian className="text-[11pt]">{HANDOFF_MESSAGES.it.sheetTitle}</Italian>}
      {handoff.practice && (
        <p className="mt-[2mm] font-semibold">
          {handoff.practice.name}
          {bilingual && handoff.practice.name !== handoff.practice.nameIt && (
            <Italian className="font-normal">{handoff.practice.nameIt}</Italian>
          )}
        </p>
      )}
      <p className="mt-[2mm] text-ink-2">{h.sheetLead}</p>

      {(request || notes.shared.length > 0) && (
        <div className="mt-[4mm] grid break-inside-avoid gap-[1.5mm] rounded-[1.5mm] border-[0.3mm] border-line px-[4mm] py-[3mm] text-[10pt]">
          <p className="font-semibold">{m.docs.operatorNote}</p>
          {request && (
            <p className="whitespace-pre-line" lang={translated ? lang : "it"}>
              <bdi>{translated ? request.text : request.textIt}</bdi>
            </p>
          )}
          {translated && bilingual && (
            <Italian className="whitespace-pre-line">{request.textIt}</Italian>
          )}
          {notes.shared.map((note) => (
            <p key={note} lang="it" className="whitespace-pre-line">
              <bdi>{note}</bdi>
            </p>
          ))}
        </div>
      )}

      {handoff.items.length === 0 ? (
        <p className="mt-[6mm] font-semibold">{h.sheetEmpty}</p>
      ) : (
        <>
          {byPerson(required).map(([person, items]) => (
            <ItemGroup
              key={person ?? "household"}
              title={person ?? m.docs.household}
              titleIt={person || !bilingual ? null : it.docs.household}
              items={items}
              language={lang}
              noteUnder={notes.under}
            />
          ))}
          {optional.length > 0 && (
            <ItemGroup
              title={m.docs.optional}
              titleIt={bilingual ? it.docs.optional : null}
              items={optional}
              language={lang}
              noteUnder={notes.under}
            />
          )}
        </>
      )}

      <footer className="mt-[6mm] grid break-inside-avoid gap-[1.5mm] border-t border-line pt-[4mm] text-[10pt]">
        <p className="font-semibold">
          {m.done.bring}
          {bilingual && <Italian className="font-normal">{it.done.bring}</Italian>}
        </p>
        {office?.bookingUrl && (
          <p>
            {h.book} <bdi className="font-mono text-[9pt] break-all">{office.bookingUrl}</bdi>
          </p>
        )}
        {(office?.openingHours || office?.phone) && (
          <Italian>{[office.openingHours, office.phone].filter(Boolean).join(" · ")}</Italian>
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
  noteUnder,
}: {
  title: string;
  titleIt: string | null;
  items: CitizenHandoffItem[];
  language: Language;
  noteUnder: (item: CitizenHandoffItem) => string | null;
}) {
  const m = messagesFor(language);
  const bilingual = language !== "it";
  return (
    <section className="mt-[5mm]">
      <h2 className="break-after-avoid border-b border-line pb-[1mm] text-[12pt] font-bold">
        <bdi>{title}</bdi>
        {titleIt && <Italian className="text-[10pt] font-normal">{titleIt}</Italian>}
      </h2>
      <ul className="mt-[2mm] grid gap-[2.5mm]">
        {items.map((item) => {
          const note = noteUnder(item);
          return (
            <li key={item.id} className="flex break-inside-avoid gap-[3mm]">
              <span
                aria-hidden
                className="mt-[0.5mm] size-[4.5mm] shrink-0 rounded-[1mm] border-[0.4mm] border-ink"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <bdi>{item.title}</bdi>
                  {item.status !== "missing" && (
                    <span className="ms-2 rounded-sm bg-warn-wash px-1.5 text-[9pt] font-semibold text-warn print:border print:border-ink print:bg-transparent print:text-ink">
                      {m.docs.status[item.status]}
                    </span>
                  )}
                </p>
                {bilingual && item.titleIt !== item.title && (
                  <Italian className="text-[10pt]">{item.titleIt}</Italian>
                )}
                {item.howToGet && (
                  <p className="mt-[0.5mm] text-[9.5pt] text-ink-2">
                    <span className="font-semibold">{m.docs.howToGet}:</span> {item.howToGet}
                  </p>
                )}
                {note && (
                  <p className="mt-[0.5mm] text-[9.5pt]">
                    <span className="font-semibold">{m.docs.operatorNote}:</span> <bdi>{note}</bdi>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
