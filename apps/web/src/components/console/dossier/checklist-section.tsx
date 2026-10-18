"use client";

import { ArrowRight, Check, FileText, Image as ImageIcon, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  CaseDossier,
  ChecklistItem,
  DocumentSummary,
  ReviewChecklistItemRequest,
} from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { CHECKLIST_STATUS, DECIDED } from "@/lib/console/labels";
import { useChanged } from "@/components/ui/use-changed";
import { cn } from "@/lib/cn";
import type { DossierActions } from "./dossier-view";

export function ChecklistSection({
  dossier,
  actions,
}: {
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const groups = new Map<string, { title: string; items: ChecklistItem[] }>();
  for (const item of dossier.checklist) {
    const key = item.memberId ?? "nucleo";
    if (!groups.has(key))
      groups.set(key, { title: item.memberName ?? "Nucleo familiare", items: [] });
    groups.get(key)!.items.push(item);
  }
  const verified = dossier.checklist.filter(
    (i) => i.status === "verified" || i.status === "waived",
  ).length;
  const unmatched = dossier.documents.filter((d) => !d.checklistItemId);
  const readOnly = dossier.status === "closed" || dossier.status === "intake";
  // The first file still waiting for a decision: the viewer then walks through the others.
  const firstToCheck = readOnly
    ? undefined
    : dossier.documents.find((doc) => {
        const item = dossier.checklist.find((i) => i.id === doc.checklistItemId);
        return item !== undefined && !DECIDED.has(item.status);
      });

  return (
    // Focusable: the document viewer returns the keyboard here when its opener is gone.
    <section
      id="checklist-section"
      aria-labelledby="checklist-title"
      tabIndex={-1}
      className="outline-none"
    >
      <SectionHeader
        id="checklist-title"
        title="Documenti"
        actions={
          <>
            <p className="tabular text-sm text-ink-3">
              {verified} di {dossier.checklist.length}{" "}
              {dossier.checklist.length === 1 ? "verificato" : "verificati"}
            </p>
            {firstToCheck && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => actions.openDocument(firstToCheck)}
              >
                Controlla uno per uno
                <ArrowRight className="rtl-flip size-4" aria-hidden />
              </Button>
            )}
          </>
        }
      />
      {readOnly && dossier.status === "intake" && (
        <p className="mt-2 text-sm text-ink-3">
          Il cittadino sta ancora compilando: potrai verificare dopo l&apos;invio.
        </p>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6">
        {[...groups.entries()].map(([key, group]) => (
          <div key={key}>
            <h3 className="mb-2 text-sm font-semibold text-ink-2">{group.title}</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              {group.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  dossier={dossier}
                  actions={actions}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          </div>
        ))}

        {unmatched.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-2">Documenti non abbinati</h3>
            <ul className="flex flex-wrap gap-2 rounded-lg bg-surface p-3 ring-1 ring-line">
              {unmatched.map((doc) => (
                <li key={doc.id} className="max-w-full min-w-0">
                  <DocChip doc={doc} onClick={() => actions.openDocument(doc)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function ChecklistRow({
  item,
  dossier,
  actions,
  readOnly,
}: {
  item: ChecklistItem;
  dossier: CaseDossier;
  actions: DossierActions;
  readOnly: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const docs = dossier.documents.filter((d) => d.checklistItemId === item.id);
  const findings = dossier.findings.filter(
    (f) =>
      f.checklistItemId === item.id &&
      f.code !== "checklist.missing" &&
      (f.severity === "blocker" || f.severity === "warning"),
  );
  // A missing optional document doesn't block the case: it shouldn't look like an error.
  const status =
    item.status === "missing" && !item.required
      ? { label: "Non caricato", tone: "muted" as const }
      : CHECKLIST_STATUS[item.status];
  const busy = actions.pending === `review:${item.id}`;
  const statusChanged = useChanged(item.status);
  const decided = DECIDED.has(item.status);
  // Deciding swaps the row's controls: the keyboard moves to the replacement (undo, or the
  // decision again after an undo) instead of falling back to <body>.
  const undoRef = useRef<HTMLButtonElement>(null);
  const decideRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (decided ? undoRef : decideRef).current?.focus();
  }, [decided]);
  async function decide(input: ReviewChecklistItemRequest) {
    refocus.current = true;
    const result = await actions.review(item.id, input);
    if (!result) refocus.current = false;
    return result;
  }
  const pill = (
    <Pill
      key={item.status}
      tone={status.tone}
      className={cn("sm:justify-self-start", statusChanged && "animate-pop")}
    >
      {status.label}
    </Pill>
  );

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    if (await decide({ decision: "rejected", note: note || undefined })) setRejecting(false);
  }

  return (
    <li id={`item-${item.id}`} className="scroll-mt-24 px-4 py-3.5 target:bg-marker-soft/50">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.title}</p>
            {!item.required && <span className="text-xs text-ink-3">facoltativo</span>}
          </div>
          {findings.map((finding) => (
            <p
              key={finding.id}
              className={cn(
                "mt-1 text-sm",
                finding.severity === "blocker" ? "text-danger" : "text-warn",
              )}
            >
              {finding.message}
            </p>
          ))}
          {item.note && <p className="mt-1 text-sm text-ink-2">Nota: {item.note}</p>}
          {docs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {docs.map((doc) => (
                <DocChip key={doc.id} doc={doc} onClick={() => actions.openDocument(doc)} />
              ))}
            </div>
          )}
        </div>
        {/* Fixed columns from sm: statuses line up down the list and read like a table column,
            whatever actions each row offers. A decision and its undo are one unit: the undo
            sits right after the status instead of out in the actions column. */}
        <div
          className={cn(
            "flex items-center gap-1.5",
            !readOnly && "sm:grid sm:grid-cols-[7rem_minmax(10.5rem,auto)] sm:gap-2",
          )}
        >
          {decided && !readOnly ? (
            <div className="flex items-center gap-1.5 sm:col-span-2">
              {pill}
              <Button
                ref={undoRef}
                variant="ghost"
                size="icon-sm"
                // 44px hit area around the 32px icon, without making the row taller.
                className="after:absolute after:-inset-1.5"
                aria-label={`Annulla la decisione su ${item.title}`}
                title="Annulla decisione"
                loading={busy}
                onClick={() => void decide({ decision: "reset" })}
              >
                <RotateCcw className="size-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <>
              {pill}
              {!readOnly && (
                <div className="flex items-center gap-1.5 sm:justify-end">
                  {docs.length > 0 ? (
                    <>
                      <Button
                        ref={decideRef}
                        variant="secondary"
                        size="sm"
                        loading={busy && !rejecting}
                        onClick={() => void decide({ decision: "verified" })}
                      >
                        <Check className="size-4 text-ok" aria-hidden />
                        Verifica
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRejecting((v) => !v)}
                        aria-expanded={rejecting}
                      >
                        Rifiuta
                      </Button>
                    </>
                  ) : (
                    <Button
                      ref={decideRef}
                      variant="ghost"
                      size="sm"
                      loading={busy}
                      title="Segna la voce come non necessaria per questo nucleo"
                      onClick={() =>
                        void decide({
                          decision: "waived",
                          note: "Non necessario per questo nucleo",
                        })
                      }
                    >
                      Non serve
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {rejecting && (
        <form
          onSubmit={reject}
          className="mt-3 flex animate-fade-in flex-wrap gap-2 rounded-md bg-paper p-3"
        >
          <label htmlFor={`note-${item.id}`} className="sr-only">
            Motivo per il cittadino, in italiano: viene tradotto nella sua lingua
          </label>
          <input
            id={`note-${item.id}`}
            name="note"
            autoFocus
            maxLength={500}
            placeholder="es. Manca il retro della carta d'identità…"
            className="h-9 min-w-0 flex-1 basis-64 rounded-sm bg-surface px-3 text-sm ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
          />
          <Button type="submit" size="sm" variant="danger" loading={busy}>
            Rifiuta documento
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Annulla"
            onClick={() => setRejecting(false)}
          >
            <X className="size-4" />
          </Button>
        </form>
      )}
    </li>
  );
}

const REUSE = {
  valido: { label: "riusato", tone: "text-ok" },
  da_aggiornare: { label: "da aggiornare", tone: "text-danger" },
  da_verificare: { label: "da verificare", tone: "text-warn" },
} as const;

/**
 * How sure the type on a chip is. Only a type read from the analysis needs qualifying: a chip
 * showing the file name claims nothing. Without AI the type comes from the file name alone.
 */
function recognition(doc: DocumentSummary) {
  const analysis = doc.analysis;
  if (!analysis?.detectedLabel || analysis.confidence >= 0.6) return null;
  return analysis.engine === "heuristic"
    ? {
        label: "dal nome file",
        detail: "Tipo dedotto dal nome del file, senza AI: controlla a vista",
      }
    : {
        label: "incerto",
        detail: `Tipo riconosciuto dall'AI con certezza ${Math.round(analysis.confidence * 100)}%: controlla a vista`,
      };
}

function DocChip({ doc, onClick }: { doc: DocumentSummary; onClick: () => void }) {
  const Icon = doc.mimeType.startsWith("image/") ? ImageIcon : FileText;
  const name = doc.analysis?.detectedLabel ?? doc.fileName;
  const guess = recognition(doc);
  // Carried over from an earlier practice of the same family, with its check.
  const reuse = doc.reuse;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-paper px-2 py-1 text-sm text-ink-2 ring-1 ring-line ring-inset hover:bg-sunk hover:text-ink"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate" title={name === doc.fileName ? name : `${name} (${doc.fileName})`}>
        {name}
      </span>
      {guess && (
        <span className="shrink-0 text-xs text-warn" title={guess.detail}>
          <span aria-hidden>· </span>
          {guess.label}
          <span className="sr-only">: {guess.detail}</span>
        </span>
      )}
      {reuse && (
        <span
          className={`shrink-0 text-xs font-semibold ${REUSE[reuse.status].tone}`}
          title={reuse.reason}
        >
          <span aria-hidden>· </span>
          {REUSE[reuse.status].label}
          <span className="sr-only">: {reuse.reason}</span>
        </span>
      )}
    </button>
  );
}
