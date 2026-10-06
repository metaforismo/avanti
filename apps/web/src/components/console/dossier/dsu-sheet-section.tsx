"use client";

import { Check, ChevronDown, Copy, ExternalLink, FileSearch } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CaseDossier, DsuRow, DsuSection } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { spreadsheetRows } from "@/lib/console/spreadsheet-safe";
import type { DossierActions } from "./dossier-view";

/**
 * The dossier laid out like the DSU form, so the operator can copy it into the CAF's software
 * field by field. Collapsed, except for cases ready to be filed: that's when it is needed.
 */
export function DsuSheetSection({
  dossier,
  actions,
}: {
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const [opened, setOpened] = useState(dossier.status === "ready");
  if (dossier.practice?.id !== "isee_ordinario") return null;

  return (
    <details
      open={opened}
      onToggle={(event) => setOpened(event.currentTarget.open)}
      className="group rounded-lg bg-surface ring-1 ring-line"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-semibold">Prospetto DSU</span>
          <span className="block text-sm text-ink-3">
            I dati nell&apos;ordine del modello, pronti da copiare nel gestionale.
          </span>
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      {opened && <SheetBody dossier={dossier} actions={actions} />}
    </details>
  );
}

const VIEWS = {
  all: { label: "Tutto", keep: () => true },
  copy: { label: "Da copiare", keep: (row: DsuRow) => row.value !== null },
  check: {
    label: "Da controllare",
    keep: (row: DsuRow) => row.source.kind === "document" || row.source.kind === "missing",
  },
} as const;
type View = keyof typeof VIEWS;

function SheetBody({ dossier, actions }: { dossier: CaseDossier; actions: DossierActions }) {
  // While typing into the software the operator wants either the values or what to look up.
  const [view, setView] = useState<View>("all");
  if (!dossier.dsuSheet) {
    return (
      <p className="border-t border-line px-5 py-4 text-ink-2">
        Il prospetto è disponibile per l&apos;ISEE ordinario quando la pratica è classificata.
      </p>
    );
  }

  const data = dossier.dsuSheet;
  const sections = data.sections
    .map((section) => ({ ...section, rows: section.rows.filter(VIEWS[view].keep) }))
    .filter((section) => section.rows.length > 0);
  return (
    <div className="grid gap-5 border-t border-line px-5 py-5">
      <div className="grid gap-2 text-sm text-ink-2">
        <p>
          Modello DSU {data.modelYear}, dichiarazione {data.declarationYear}, redditi e patrimoni{" "}
          {data.referenceYear}.{" "}
          <a
            href={data.modelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-stamp underline underline-offset-4"
          >
            Modello ufficiale
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>
        {data.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Legend tone="answer">risposta del cittadino</Legend>
          <Legend tone="document">da leggere nel documento</Legend>
          <Legend tone="missing">manca</Legend>
          <Legend tone="caf">a cura del CAF</Legend>
        </p>
      </div>
      <div role="group" aria-label="Mostra" className="flex w-fit rounded-sm bg-sunk p-0.5">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={cn(
              "rounded-xs px-3 py-1.5 text-sm",
              view === key ? "bg-surface font-semibold text-ink shadow-xs" : "text-ink-2",
            )}
          >
            {VIEWS[key].label}
          </button>
        ))}
      </div>
      {sections.length === 0 && <p className="text-ink-2">Niente in questa vista.</p>}
      {sections.map((section) => (
        <SheetSection
          key={`${section.module}-${section.quadro}-${section.memberId ?? ""}-${section.instanceId ?? ""}`}
          section={section}
          dossier={dossier}
          actions={actions}
        />
      ))}
    </div>
  );
}

function SheetSection({
  section,
  dossier,
  actions,
}: {
  section: DsuSection;
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  // Tab-separated pairs paste into a spreadsheet next to the software; values come from the
  // citizen, so they are neutralized against formula injection.
  const values = section.rows.flatMap((row) =>
    row.value === null ? [] : [[row.label, row.value] as [string, string]],
  );
  // With a single value the row's own button already does it.
  const copyable = values.length > 1 ? spreadsheetRows(values) : "";

  return (
    <section aria-label={`Quadro ${section.quadro}`} className="rounded-md ring-1 ring-line">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-paper px-4 py-2.5">
        <span className="rounded-full bg-sunk px-2 py-0.5 text-xs font-semibold text-ink-2">
          {section.module} · quadro {section.quadro}
        </span>
        <h3 className="min-w-0 flex-1 font-semibold">
          {section.title}
          {section.memberName && (
            <span className="font-normal text-ink-2"> · {section.memberName}</span>
          )}
        </h3>
        {copyable && <CopyValue value={copyable} label={`il quadro ${section.quadro}`} wide />}
      </header>
      <dl className="divide-y divide-line">
        {section.rows.map((row, index) => (
          <SheetRow key={`${row.label}-${index}`} row={row} dossier={dossier} actions={actions} />
        ))}
      </dl>
    </section>
  );
}

function SheetRow({
  row,
  dossier,
  actions,
}: {
  row: DsuRow;
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const document =
    row.source.kind === "document"
      ? dossier.documents.find(
          (doc) => doc.id === (row.source as { documentId: string }).documentId,
        )
      : undefined;

  return (
    <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4">
      <dt className="text-sm text-ink-2">
        {row.label}
        {row.note && <span className="mt-0.5 block text-xs text-ink-3">{row.note}</span>}
      </dt>
      <dd className="flex min-w-0 items-center gap-2">
        {row.source.kind === "answer" && row.value !== null ? (
          <>
            <span className="min-w-0 flex-1 font-semibold break-words text-ink tabular-nums">
              {row.value}
            </span>
            <CopyValue value={row.value} label={row.label} />
          </>
        ) : row.source.kind === "document" ? (
          <Tag tone="document">
            {document ? (
              <button
                type="button"
                onClick={() => actions.openDocument(document)}
                className="inline-flex items-start gap-1.5 text-start font-semibold text-stamp underline underline-offset-4"
              >
                <FileSearch className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Apri {document.analysis?.detectedLabel ?? document.fileName}
              </button>
            ) : (
              "Da leggere nel documento"
            )}
          </Tag>
        ) : row.source.kind === "missing" ? (
          <Tag tone="missing">Manca</Tag>
        ) : (
          <Tag tone="caf">A cura del CAF</Tag>
        )}
      </dd>
    </div>
  );
}

const TONES = {
  answer: "bg-ok",
  document: "bg-stamp",
  missing: "bg-warn",
  caf: "bg-ink-3",
} as const;

function Legend({ tone, children }: { tone: keyof typeof TONES; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", TONES[tone])} aria-hidden />
      {children}
    </span>
  );
}

function Tag({
  tone,
  children,
}: {
  tone: Exclude<keyof typeof TONES, "answer">;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2">
      <span className={cn("size-2 shrink-0 rounded-full", TONES[tone])} aria-hidden />
      {children}
    </span>
  );
}

/** Small copy control for a single value; announces the result to screen readers. */
function CopyValue({
  value,
  label,
  wide = false,
}: {
  value: string;
  label: string;
  wide?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Without clipboard access the value is on screen and selectable.
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={wide ? "sm" : "icon-sm"}
        onClick={() => void copy()}
        aria-label={`Copia ${label}`}
      >
        {copied ? (
          <Check className="size-4 text-ok" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        {wide && (copied ? "Copiato" : "Copia il quadro")}
      </Button>
      <span role="status" className="sr-only">
        {copied ? `Copiato: ${label}` : ""}
      </span>
    </>
  );
}
