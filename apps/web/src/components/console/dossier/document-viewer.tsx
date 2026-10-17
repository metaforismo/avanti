"use client";

import { Check, ChevronLeft, ChevronRight, Download, RotateCcw, X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CaseDossier, ChecklistItem, DocumentSummary } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { PdfPreview } from "./pdf-preview";
import { CHECKLIST_STATUS, DECIDED, formatDateTime } from "@/lib/console/labels";
import { useDownload } from "@/lib/console/use-download";
import { cn } from "@/lib/cn";
import type { DossierActions } from "./dossier-view";

export function DocumentViewer({
  caseId,
  doc,
  dossier,
  onClose,
  onNavigate,
  actions,
}: {
  actions: DossierActions;
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
  // The open document changes through the URL, a render later: quick arrow presses count from
  // where the previous press went, not from the document still on screen.
  const position = useRef(index);
  useEffect(() => {
    position.current = index;
  }, [index]);
  const step = (delta: number) => {
    const target = docs[position.current + delta];
    if (position.current < 0 || !target) return;
    position.current += delta;
    onNavigate(target);
  };

  const url = doc ? `/api/cases/${encodeURIComponent(caseId)}/documents/${doc.id}/file` : "";
  const item = doc?.checklistItemId
    ? dossier.checklist.find((i) => i.id === doc.checklistItemId)
    : undefined;
  const analysis = doc?.analysis;
  const canDecide = dossier.status !== "closed" && dossier.status !== "intake";
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The pass through the files ended on this document: say so and offer the way back. Only
  // until the viewer shows another document or closes: reopened later, it would be stale.
  const [finishedOn, setFinishedOn] = useState<string | null>(null);
  const [shown, setShown] = useState(doc?.id ?? null);
  if (shown !== (doc?.id ?? null)) {
    setShown(doc?.id ?? null);
    setFinishedOn(null);
  }
  // Where the keyboard goes back on close: the chip or button that opened the viewer, unless the
  // pass removed it («Controlla uno per uno» goes once nothing is left to check).
  const opener = useRef<HTMLElement | null>(null);
  // The page's error notice sits under this panel: a failed decision is reported here too.
  const [failedOn, setFailedOn] = useState<string | null>(null);
  const files = useDownload();
  const [downloadError, setDownloadError] = useState<{ doc: string; message: string } | null>(null);
  const failure =
    doc && failedOn === doc.id
      ? actions.error
      : doc && downloadError?.doc === doc.id
        ? `Download non riuscito. ${downloadError.message}`
        : null;

  // After a decision, go straight to the next document whose item is still open: checking a
  // dossier becomes one pass through the files instead of back-and-forth with the list.
  const decide = async (target: ChecklistItem, decision: "verified" | "reset", note?: string) => {
    const after = await actions.review(target.id, { decision, note });
    setFailedOn(after ? null : (doc?.id ?? null));
    if (after)
      setAnnouncement(
        decision === "verified" ? `${target.title}: verificato.` : "Decisione annullata.",
      );
    if (!after || decision !== "verified") return;
    // From the dossier the decision returned: meanwhile a colleague or an analysis may have
    // changed other items, and the render's copy predates the wait.
    const list = after.documents;
    const here = list.findIndex((d) => d.id === doc?.id);
    const open = (d: DocumentSummary) => {
      const it = after.checklist.find((i) => i.id === d.checklistItemId);
      return it && it.id !== target.id && !DECIDED.has(it.status);
    };
    const following = [...list.slice(here + 1), ...list.slice(0, Math.max(here, 0))].find(open);
    if (!following) {
      setFinishedOn(doc?.id ?? null);
      setAnnouncement(`${target.title}: verificato. Nessun altro documento da controllare.`);
    } else {
      onNavigate(following);
      const position = list.indexOf(following) + 1;
      setAnnouncement(
        `${target.title}: verificato. Documento ${position} di ${list.length}: ${following.analysis?.detectedLabel ?? following.fileName}.`,
      );
      // The panel is rebuilt for the next item: put the keyboard on its main action again.
      requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>('[data-viewer-primary="true"]')?.focus(),
      );
    }
  };
  const reject = async (target: ChecklistItem, note: string) => {
    const done = await actions.review(target.id, { decision: "rejected", note: note || undefined });
    setFailedOn(done ? null : (doc?.id ?? null));
    if (done) setRejecting(null);
  };

  // Rebound every render: the handler reads the current item and pending state.
  useEffect(() => {
    if (!doc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      // Holding V must not verify file after file as the viewer advances.
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
      if (!item || !canDecide || DECIDED.has(item.status) || actions.pending) return;
      if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        void decide(item, "verified");
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        setRejecting(item.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Primitive.Root open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim" />
        <Primitive.Content
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) return;
            event.preventDefault();
            document.getElementById("checklist-section")?.focus();
          }}
          className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-surface outline-none lg:inset-y-3 lg:right-3 lg:left-auto lg:w-[min(64rem,calc(100vw-1.5rem))] lg:rounded-xl lg:shadow-float"
        >
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
                <button
                  type="button"
                  onClick={async () => {
                    const problem = await files.download(url, doc.fileName);
                    setDownloadError(problem ? { doc: doc.id, message: problem } : null);
                  }}
                  disabled={files.pending === url}
                  className="rounded-sm p-2 text-ink-2 hover:bg-sunk hover:text-ink disabled:opacity-50"
                  aria-label="Scarica il file"
                >
                  <Download className="size-5" />
                </button>
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
                    <ImagePreview
                      key={doc.id}
                      url={url}
                      alt={analysis?.detectedLabel ?? doc.fileName}
                    />
                  )}
                </div>

                <aside className="overflow-y-auto border-t border-line p-5 lg:border-s lg:border-t-0">
                  <p role="status" className="sr-only">
                    {announcement}
                  </p>
                  {failure && (
                    <Notice tone="danger" className="mb-4">
                      {failure}
                    </Notice>
                  )}
                  {item && finishedOn === doc.id && DECIDED.has(item.status) && (
                    <Notice
                      tone="ok"
                      role="none"
                      className="mb-4"
                      title="Nessun altro documento da controllare."
                      action={
                        <Primitive.Close asChild>
                          <Button size="sm" autoFocus>
                            Torna al fascicolo
                          </Button>
                        </Primitive.Close>
                      }
                    />
                  )}
                  {item && canDecide && (
                    <Decision
                      key={item.id}
                      item={item}
                      busy={actions.pending === `review:${item.id}`}
                      rejecting={rejecting === item.id}
                      onRejecting={(on) => setRejecting(on ? item.id : null)}
                      onVerify={() => void decide(item, "verified")}
                      onReset={() => void decide(item, "reset")}
                      onReject={(note) => void reject(item, note)}
                    />
                  )}
                  <h3 className="font-semibold">Controllo automatico</h3>
                  {!analysis ? (
                    <p className="mt-2 text-sm text-ink-3">
                      {doc.status === "processing"
                        ? "Analisi in corso…"
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
                      <dl className="mt-4 grid gap-3 text-body-sm">
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
                              ? // A calendar date: read it in UTC so it never shifts by a day.
                                new Date(
                                  `${analysis.expiresOn.slice(0, 10)}T00:00:00Z`,
                                ).toLocaleDateString("it-IT", { timeZone: "UTC" })
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
                              <li key={finding.id}>
                                <Notice
                                  tone={finding.severity === "blocker" ? "danger" : "warn"}
                                  role="none"
                                >
                                  {finding.message}
                                </Notice>
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

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <p role="alert" className="p-8 text-center text-ink-2">
        Anteprima non disponibile. Prova a scaricare il file; se la sessione è scaduta, accedi di
        nuovo.
      </p>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated private file
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      className="mx-auto max-h-full object-contain p-4"
    />
  );
}

/** The decision on the item this file belongs to, without leaving the document. */
function Decision({
  item,
  busy,
  rejecting,
  onRejecting,
  onVerify,
  onReset,
  onReject,
}: {
  item: ChecklistItem;
  busy: boolean;
  rejecting: boolean;
  onRejecting: (on: boolean) => void;
  onVerify: () => void;
  onReset: () => void;
  onReject: (note: string) => void;
}) {
  const status = CHECKLIST_STATUS[item.status];
  const decided = DECIDED.has(item.status);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onReject(String(new FormData(event.currentTarget).get("note") ?? "").trim());
  };
  return (
    <section aria-label="Decisione sulla voce" className="mb-6 rounded-md bg-paper p-4">
      <p className="text-sm text-ink-3">Voce</p>
      <p className="font-semibold">
        {item.title}
        {item.memberName && <span className="font-normal text-ink-3"> · {item.memberName}</span>}
      </p>
      <div className="mt-2">
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      {decided ? (
        <Button variant="ghost" size="sm" className="mt-3" loading={busy} onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          Annulla decisione
        </Button>
      ) : rejecting ? (
        <form onSubmit={submit} className="mt-3 grid gap-2">
          <label htmlFor={`viewer-note-${item.id}`} className="text-sm text-ink-2">
            Motivo per il cittadino (in italiano, viene tradotto)
          </label>
          <input
            id={`viewer-note-${item.id}`}
            name="note"
            autoFocus
            maxLength={500}
            placeholder="es. Manca il retro della carta d'identità…"
            className="h-9 rounded-sm bg-surface px-3 text-sm ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="danger" loading={busy}>
              Rifiuta documento
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onRejecting(false)}>
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={onVerify}
              aria-keyshortcuts="V"
              data-viewer-primary="true"
            >
              <Check className="size-4" aria-hidden />
              Verifica
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRejecting(true)}
              aria-keyshortcuts="R"
            >
              Rifiuta
            </Button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            Tasti: <Kbd>V</Kbd> verifica, <Kbd>R</Kbd> rifiuta, <Kbd>←</Kbd> <Kbd>→</Kbd> documenti.
            Dopo la verifica passa al prossimo documento da controllare.
          </p>
        </>
      )}
    </section>
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
