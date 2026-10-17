"use client";

import { Check, ChevronDown, ExternalLink, FileSearch, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type {
  CaseDossier,
  DsuPrefill,
  DsuPrefillField,
  DsuRow,
  DsuSection,
} from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { spreadsheetRows } from "@/lib/console/spreadsheet-safe";
import { useResource } from "@/lib/console/use-resource";
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
const VIEW_OPTIONS = (Object.keys(VIEWS) as View[]).map((key) => ({
  value: key,
  label: VIEWS[key].label,
}));

function SheetBody({ dossier, actions }: { dossier: CaseDossier; actions: DossierActions }) {
  // While typing into the software the operator wants either the values or what to look up.
  const [view, setView] = useState<View>("all");
  // Values the AI read from the documents; each one becomes a value only once confirmed.
  const prefill = useResource<DsuPrefill>(
    // Keyed by version: a decision or a new upload changes what is left to confirm.
    dossier.dsuSheet
      ? `/api/cases/${encodeURIComponent(dossier.id)}/ai/dsu-prefill?v=${encodeURIComponent(dossier.updatedAt)}`
      : null,
  );
  const proposals = prefill.data?.fields ?? [];
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
      <SegmentedControl label="Mostra" value={view} onChange={setView} options={VIEW_OPTIONS} />
      {proposals.length > 0 && (
        <Notice tone="info" icon={Sparkles}>
          {proposals.length === 1
            ? "L'AI ha letto un importo nei documenti."
            : `L'AI ha letto ${proposals.length} importi nei documenti.`}{" "}
          Controllali sul file e conferma: solo i valori confermati entrano nel prospetto.
        </Notice>
      )}
      {sections.length === 0 && <p className="text-ink-2">Niente in questa vista.</p>}
      {sections.map((section) => (
        <SheetSection
          key={`${section.module}-${section.quadro}-${section.memberId ?? ""}-${section.instanceId ?? ""}`}
          section={section}
          dossier={dossier}
          actions={actions}
          proposals={proposals}
        />
      ))}
    </div>
  );
}

function SheetSection({
  section,
  dossier,
  actions,
  proposals,
}: {
  section: DsuSection;
  dossier: CaseDossier;
  actions: DossierActions;
  proposals: DsuPrefillField[];
}) {
  const sectionId = `${section.quadro}:${section.memberId ?? "household"}:${section.instanceId ?? "main"}`;
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
        <Pill tone="neutral">
          {section.module} · quadro {section.quadro}
        </Pill>
        <h3 className="min-w-0 flex-1 font-semibold">
          {section.title}
          {section.memberName && (
            <span className="font-normal text-ink-2"> · {section.memberName}</span>
          )}
        </h3>
        {copyable && (
          // Several lines of tab-separated pairs: a one-line fallback field would flatten them,
          // and the values are on screen anyway.
          <CopyButton
            value={copyable}
            variant="ghost"
            size="sm"
            aria-label={`Copia il quadro ${section.quadro}`}
            showValueOnFailure={false}
            labels={{
              copy: "Copia il quadro",
              copied: "Copiato",
              failed: "Copia non riuscita: copia i valori a mano.",
            }}
          />
        )}
        {section.note && <p className="basis-full text-sm text-ink-2">{section.note}</p>}
      </header>
      <dl className="divide-y divide-line">
        {section.rows.map((row, index) => (
          <SheetRow
            key={`${row.label}-${index}`}
            row={row}
            dossier={dossier}
            actions={actions}
            proposal={
              row.value === null
                ? proposals.find((p) => p.sectionId === sectionId && p.label === row.label)
                : undefined
            }
          />
        ))}
      </dl>
    </section>
  );
}

function SheetRow({
  row,
  dossier,
  actions,
  proposal,
}: {
  row: DsuRow;
  dossier: CaseDossier;
  actions: DossierActions;
  proposal?: DsuPrefillField;
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
        {row.value !== null ? (
          <>
            <span className="min-w-0 flex-1 font-semibold text-ink tabular-nums">
              {row.value}
              {row.source.kind === "document" && (
                <span className="mt-0.5 block text-xs font-normal text-ink-3">
                  Letto dal documento, confermato
                  {row.source.page ? ` · pagina ${row.source.page}` : ""}
                </span>
              )}
            </span>
            <CopyButton
              value={row.value}
              iconOnly
              // The value is on screen and selectable: no need to repeat it in a fallback field.
              showValueOnFailure={false}
              labels={{
                copy: `Copia ${row.label}`,
                copied: `Copiato: ${row.label}`,
                failed: "Copia non riuscita: seleziona il valore e copialo a mano.",
              }}
            />
          </>
        ) : proposal ? (
          <PrefillProposal proposal={proposal} dossier={dossier} actions={actions} />
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

const amount = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** An AI reading waiting for the operator: the value, where it comes from, confirm or discard. */
function PrefillProposal({
  proposal,
  dossier,
  actions,
}: {
  proposal: DsuPrefillField;
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const document = dossier.documents.find((doc) => doc.id === proposal.documentId);
  const busy = actions.pending === `prefill:${proposal.fieldId}`;
  const value = typeof proposal.value === "number" ? amount.format(proposal.value) : proposal.value;
  return (
    <div className="min-w-0 flex-1 rounded-sm bg-stamp-wash px-3 py-2 ring-1 ring-stamp/15">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-ink tabular-nums">{value}</span>
        <span className="inline-flex items-center gap-1 text-xs text-stamp">
          <Sparkles className="size-3" aria-hidden />
          proposto dall&apos;AI
        </span>
      </p>
      <p className="mt-0.5 text-xs text-ink-2">
        {document ? (
          <button
            type="button"
            onClick={() => actions.openDocument(document)}
            className="font-semibold text-stamp underline underline-offset-2"
          >
            {document.analysis?.detectedLabel ?? document.fileName}
            {proposal.page ? `, pagina ${proposal.page}` : ""}
          </button>
        ) : (
          "Documento non più disponibile"
        )}
        {proposal.note && <span className="block">{proposal.note}</span>}
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          loading={busy}
          disabled={actions.pending !== null && !busy}
          onClick={() => void actions.decidePrefill(proposal.fieldId, "accept")}
        >
          <Check className="size-4" aria-hidden />
          Conferma
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={actions.pending !== null}
          onClick={() => void actions.decidePrefill(proposal.fieldId, "reject")}
        >
          <X className="size-4" aria-hidden />
          Scarta
        </Button>
      </div>
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
