"use client";

import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useEffect } from "react";
import type { CaseDossier, DocumentSummary } from "@avanti/contracts";
import { Pill } from "@/components/ui/pill";
import { PdfPreview } from "./pdf-preview";
import { formatDateTime } from "@/lib/console/labels";
import { cn } from "@/lib/cn";

export function DocumentViewer({
  caseId,
  doc,
  dossier,
  onClose,
  onNavigate,
}: {
  caseId: string;
  doc: DocumentSummary | null;
  dossier: CaseDossier;
  onClose: () => void;
  onNavigate: (doc: DocumentSummary) => void;
}) {
  const docs = dossier.documents;
  const index = doc ? docs.findIndex((d) => d.id === doc.id) : -1;
  const prev = index > 0 ? docs[index - 1] : undefined;
  const next = index >= 0 && index < docs.length - 1 ? docs[index + 1] : undefined;

  useEffect(() => {
    if (!doc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (event.key === "ArrowLeft" && prev) onNavigate(prev);
      if (event.key === "ArrowRight" && next) onNavigate(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, prev, next, onNavigate]);

  const url = doc ? `/api/cases/${encodeURIComponent(caseId)}/documents/${doc.id}/file` : "";
  const item = doc?.checklistItemId
    ? dossier.checklist.find((i) => i.id === doc.checklistItemId)
    : undefined;
  const analysis = doc?.analysis;

  return (
    <Primitive.Root open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim" />
        <Primitive.Content className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-surface outline-none lg:inset-y-3 lg:right-3 lg:left-auto lg:w-[min(64rem,calc(100vw-1.5rem))] lg:rounded-xl lg:shadow-float">
          {doc && (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Primitive.Title className="truncate font-semibold">
                    {analysis?.detectedLabel ?? doc.fileName}
                  </Primitive.Title>
                  <Primitive.Description className="truncate text-sm text-ink-3">
                    {doc.fileName} · caricato {formatDateTime(doc.uploadedAt)}
                  </Primitive.Description>
                </div>
                <span className="tabular text-sm text-ink-3">
                  {index + 1} / {docs.length}
                </span>
                <NavButton
                  label="Documento precedente"
                  disabled={!prev}
                  onClick={() => prev && onNavigate(prev)}
                >
                  <ChevronLeft className="size-5" />
                </NavButton>
                <NavButton
                  label="Documento successivo"
                  disabled={!next}
                  onClick={() => next && onNavigate(next)}
                >
                  <ChevronRight className="size-5" />
                </NavButton>
                <a
                  href={url}
                  download={doc.fileName}
                  className="rounded-sm p-2 text-ink-2 hover:bg-sunk hover:text-ink"
                  aria-label="Scarica il file"
                >
                  <Download className="size-5" />
                </a>
                <Primitive.Close
                  className="rounded-sm p-2 text-ink-2 hover:bg-sunk hover:text-ink"
                  aria-label="Chiudi"
                >
                  <X className="size-5" />
                </Primitive.Close>
              </div>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_20rem]">
                <div className="min-h-[50dvh] overflow-auto bg-sunk">
                  {doc.mimeType === "application/pdf" ? (
                    <PdfPreview key={doc.id} url={url} title={doc.fileName} />
                  ) : doc.mimeType === "image/heic" ? (
                    <p className="p-8 text-center text-ink-2">
                      Anteprima HEIC non supportata da questo browser. Scarica il file per aprirlo.
                    </p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- authenticated private file
                    <img
                      key={doc.id}
                      src={url}
                      alt={analysis?.detectedLabel ?? doc.fileName}
                      className="mx-auto max-h-full object-contain p-4"
                    />
                  )}
                </div>

                <aside className="overflow-y-auto border-t border-line p-5 lg:border-s lg:border-t-0">
                  <h3 className="font-semibold">Controllo automatico</h3>
                  {!analysis ? (
                    <p className="mt-2 text-sm text-ink-3">
                      {doc.status === "processing"
                        ? "Analisi in corso."
                        : "Analisi non disponibile: verifica a vista."}
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-ink-3">
                        {analysis.engine === "ai" ? "Analisi AI" : "Analisi euristica (senza AI)"},
                        certezza{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            analysis.confidence < 0.6 ? "text-warn" : "text-ink-2",
                          )}
                        >
                          {Math.round(analysis.confidence * 100)}%
                        </span>
                      </p>
                      <dl className="mt-4 grid gap-3 text-[0.9375rem]">
                        <Row
                          label="Abbinato a"
                          value={
                            item
                              ? `${item.title}${item.memberName ? `, ${item.memberName}` : ""}`
                              : "Nessuna voce"
                          }
                        />
                        <Row label="Intestatario" value={analysis.ownerName} />
                        <Row
                          label="Anno di riferimento"
                          value={analysis.referenceYear?.toString() ?? null}
                        />
                        <Row
                          label="Scadenza"
                          value={
                            analysis.expiresOn
                              ? new Date(analysis.expiresOn).toLocaleDateString("it-IT")
                              : null
                          }
                        />
                        <Row label="Pagine" value={doc.pages?.toString() ?? null} />
                        <div>
                          <dt className="text-sm text-ink-3">Leggibilità</dt>
                          <dd className="mt-1 flex flex-wrap gap-1.5">
                            <Pill tone={analysis.legible ? "ok" : "danger"}>
                              {analysis.legible ? "Leggibile" : "Poco leggibile"}
                            </Pill>
                            {analysis.pagesComplete === false && (
                              <Pill tone="warn">Pagine mancanti</Pill>
                            )}
                          </dd>
                        </div>
                      </dl>
                      {analysis.findings.filter((f) => f.severity !== "ok").length > 0 && (
                        <ul className="mt-5 grid gap-2">
                          {analysis.findings
                            .filter((f) => f.severity !== "ok")
                            .map((finding) => (
                              <li
                                key={finding.id}
                                className={cn(
                                  "rounded-sm px-3 py-2 text-sm",
                                  finding.severity === "blocker"
                                    ? "bg-danger-wash text-danger"
                                    : "bg-warn-wash text-warn",
                                )}
                              >
                                {finding.message}
                              </li>
                            ))}
                        </ul>
                      )}
                    </>
                  )}
                  <p className="mt-6 text-xs text-ink-3">
                    Il controllo automatico può sbagliare: la verifica finale spetta
                    all&apos;operatore.
                  </p>
                </aside>
              </div>
            </>
          )}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className={cn("mt-0.5", value ? "font-semibold" : "text-ink-3")}>
        {value ?? "Non rilevato"}
      </dd>
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-sm p-2 text-ink-2 hover:bg-sunk hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
