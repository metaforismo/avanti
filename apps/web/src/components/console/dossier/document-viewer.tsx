"use client";

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  X,
} from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CaseDossier, ChecklistItem, DocumentSummary } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { PdfPreview } from "./pdf-preview";
import {
  CHECKLIST_STATUS,
  DECIDED,
  formatDateTime,
  memberSuffix,
  withMember,
} from "@/lib/console/labels";
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
  // The automatic check thinks the file is something else than the item it was filed under.
  const mismatch = Boolean(
    item &&
    analysis?.detectedRequirementId &&
    analysis.detectedRequirementId !== item.requirementId,
  );
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
  const focusOnArrival = useRef<string | null>(null);
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
      // The panel is rebuilt for the next item: put the keyboard on its main action again,
      // once that item is on screen (the URL change lands a render or more later).
      focusOnArrival.current = following.id;
    }
  };
  useEffect(() => {
    if (!doc || focusOnArrival.current !== doc.id) return;
    focusOnArrival.current = null;
    document.querySelector<HTMLButtonElement>('[data-viewer-primary="true"]')?.focus();
  }, [doc]);
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
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim data-[state=closed]:animate-fade-out" />
        <Primitive.Content
          onOpenAutoFocus={(event) => {
            opener.current = document.activeElement as HTMLElement | null;
            // The panel itself, not its first button: the arrows and V/R work from here, and a
            // focus ring on «Documento successivo» at every opening was noise.
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) return;
            event.preventDefault();
            document.getElementById("checklist-section")?.focus();
          }}
          className="console-viewer fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface outline-none lg:inset-y-3 lg:start-auto lg:end-3 lg:w-[min(64rem,calc(100vw-1.5rem))] lg:rounded-xl lg:shadow-float lg:ring-1 lg:ring-line xl:w-[min(80rem,calc(100vw-1.5rem))]"
        >
          {doc && (
            <>
              <div className="flex h-14 shrink-0 items-center gap-1 border-b border-line ps-4 pe-2">
                {/* The item the file was filed under is the title, as in the decision beside
                    it; what the file looks like to the automatic check is said in that panel. */}
                <div className="min-w-0 flex-1 pe-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Primitive.Title className="min-w-0 truncate text-body-sm font-semibold">
                      {item?.title ?? analysis?.detectedLabel ?? doc.fileName}
                    </Primitive.Title>
                    {item && memberSuffix(item) && (
                      <Pill tone="neutral" className="max-w-40 min-w-0">
                        <span dir="auto" className="truncate">
                          {memberSuffix(item)}
                        </span>
                      </Pill>
                    )}
                  </div>
                  <Primitive.Description className="truncate text-xs text-ink-3">
                    <span dir="auto">{doc.fileName}</span> · caricato{" "}
                    {formatDateTime(doc.uploadedAt)}
                  </Primitive.Description>
                </div>
                <span className="tabular px-2 text-sm text-ink-3">
                  {index + 1} / {docs.length}
                </span>
                <IconButton
                  label="Documento precedente"
                  shortcut="ArrowLeft"
                  disabled={!prev}
                  onClick={() => prev && onNavigate(prev)}
                >
                  <ChevronLeft className="rtl-flip size-4.5" aria-hidden />
                </IconButton>
                <IconButton
                  label="Documento successivo"
                  shortcut="ArrowRight"
                  disabled={!next}
                  onClick={() => next && onNavigate(next)}
                >
                  <ChevronRight className="rtl-flip size-4.5" aria-hidden />
                </IconButton>
                <span aria-hidden className="mx-1.5 h-5 w-px bg-line" />
                <IconButton
                  label="Scarica il file"
                  disabled={files.pending === url}
                  onClick={async () => {
                    const problem = await files.download(url, doc.fileName);
                    setDownloadError(problem ? { doc: doc.id, message: problem } : null);
                  }}
                >
                  <Download className="size-4.5" aria-hidden />
                </IconButton>
                <Primitive.Close asChild>
                  <IconButton label="Chiudi" shortcut="Escape">
                    <X className="size-4.5" aria-hidden />
                  </IconButton>
                </Primitive.Close>
              </div>

              <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_20rem] lg:overflow-hidden xl:grid-cols-[14rem_minmax(0,1fr)_20rem]">
                <DocumentRail dossier={dossier} current={doc.id} onNavigate={onNavigate} />
                <div className="min-h-[60dvh] overflow-auto bg-sunk lg:min-h-0">
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

                <aside className="min-h-0 overflow-y-auto border-t border-line lg:border-s lg:border-t-0">
                  <p role="status" className="sr-only">
                    {announcement}
                  </p>
                  {(failure || (item && finishedOn === doc.id && DECIDED.has(item.status))) && (
                    <div className="grid gap-3 px-5 pt-5">
                      {failure && <Notice tone="danger">{failure}</Notice>}
                      {item && finishedOn === doc.id && DECIDED.has(item.status) && (
                        <Notice
                          tone="ok"
                          role="none"
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
                    </div>
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
                  <section aria-labelledby="viewer-analysis" className="px-5 py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h3 id="viewer-analysis" className="text-sm font-semibold">
                        Controllo automatico
                      </h3>
                      {analysis && (
                        <p className="text-xs text-ink-3">
                          {analysis.engine === "ai" ? "AI" : "Senza AI"} · certezza{" "}
                          <span
                            className={cn(
                              "tabular font-semibold",
                              analysis.confidence < 0.6 ? "text-warn" : "text-ink-2",
                            )}
                          >
                            {Math.round(analysis.confidence * 100)}%
                          </span>
                        </p>
                      )}
                    </div>
                    {!analysis ? (
                      <p className="mt-2 text-sm text-ink-3">
                        {doc.status === "processing"
                          ? "Analisi in corso…"
                          : "Analisi non disponibile: verifica a vista."}
                      </p>
                    ) : (
                      <>
                        {analysis.engine === "heuristic" && (
                          <p className="sr-only">Analisi euristica, senza AI.</p>
                        )}
                        {/* Said only when it differs from the item the file was filed under:
                            otherwise «Abbinato a» below already says it. */}
                        {mismatch && analysis.detectedLabel && (
                          <p className="mt-3 flex items-start gap-2 rounded-sm bg-warn-wash px-2.5 py-2 text-sm">
                            <AlertTriangle
                              className="mt-0.5 size-3.5 shrink-0 text-warn"
                              aria-hidden
                            />
                            <span className="min-w-0">
                              Sembra:{" "}
                              <span className="font-semibold">{analysis.detectedLabel}</span>{" "}
                              <span className="tabular text-ink-3">
                                ({Math.round(analysis.confidence * 100)}%)
                              </span>
                              <span className="sr-only">
                                , non coincide con la voce a cui è abbinato
                              </span>
                            </span>
                          </p>
                        )}
                        <dl className="mt-3 grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
                          <Row
                            label="Abbinato a"
                            value={item ? withMember(item, ", ") : "Nessuna voce"}
                          />
                          <Row label="Intestatario" value={analysis.ownerName} />
                          <Row label="Anno" value={analysis.referenceYear?.toString() ?? null} />
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
                          <dt className="text-ink-3">Leggibilità</dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {/* Without AI nothing was read: "not legible" would be a false alarm. */}
                            {analysis.engine === "heuristic" ? (
                              <Pill tone="muted">Da controllare a vista</Pill>
                            ) : (
                              <Pill tone={analysis.legible ? "ok" : "danger"}>
                                {analysis.legible ? "Leggibile" : "Poco leggibile"}
                              </Pill>
                            )}
                            {analysis.pagesComplete === false && (
                              <Pill tone="warn">Pagine mancanti</Pill>
                            )}
                          </dd>
                        </dl>
                        {analysis.findings.filter((f) => f.severity !== "ok").length > 0 && (
                          <ul className="mt-4 grid gap-2">
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
                    <p className="mt-5 text-xs text-ink-3">
                      Il controllo automatico può sbagliare: la verifica finale spetta
                      all&apos;operatore.
                    </p>
                  </section>
                </aside>
              </div>
            </>
          )}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

/**
 * Every file of the dossier, with where each one stands: the operator sees how far the pass
 * through the documents has gone and jumps anywhere in it. Wide screens only: on smaller ones
 * the arrows do the same and the preview needs the room.
 */
function DocumentRail({
  dossier,
  current,
  onNavigate,
}: {
  dossier: CaseDossier;
  current: string;
  onNavigate: (doc: DocumentSummary) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current]);
  return (
    <nav
      aria-label="Documenti del fascicolo"
      className="hidden min-h-0 flex-col border-e border-line bg-paper xl:flex"
    >
      <ol ref={list} className="grid min-h-0 flex-1 content-start gap-px overflow-y-auto p-2">
        {dossier.documents.map((d, i) => {
          const item = dossier.checklist.find((it) => it.id === d.checklistItemId);
          const state = railState(item);
          const active = d.id === current;
          return (
            <li key={d.id}>
              <button
                type="button"
                aria-current={active || undefined}
                onClick={() => !active && onNavigate(d)}
                className={cn(
                  "grid w-full grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2 rounded-sm px-2 py-1.5 text-start transition-colors duration-100",
                  active ? "bg-surface shadow-xs ring-1 ring-line" : "hover:bg-sunk",
                )}
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 justify-self-center rounded-full", state.dot)}
                />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-baseline gap-1.5 text-sm">
                    <span className="tabular shrink-0 text-xs text-ink-3">{i + 1}</span>
                    {/* A file name in Arabic keeps its own direction instead of scrambling. */}
                    <span
                      dir="auto"
                      className={cn("truncate", active ? "font-semibold text-ink" : "text-ink-2")}
                    >
                      {d.analysis?.detectedLabel ?? d.fileName}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {state.label}
                    {item && memberSuffix(item) ? ` · ${memberSuffix(item)}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-ink-3">
        <Kbd>←</Kbd>
        <Kbd>→</Kbd>
        <span>per scorrere</span>
      </p>
    </nav>
  );
}

function railState(item: ChecklistItem | undefined) {
  if (!item) return { label: "Non abbinato", dot: "bg-line-strong" };
  const status = CHECKLIST_STATUS[item.status];
  const dot = {
    stamp: "bg-stamp",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    neutral: "bg-line-strong",
    muted: "bg-line-strong",
  }[status.tone];
  return { label: status.label, dot };
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
    // A sheet on the desk: the edge shows where the photo ends on the grey background.
    <div className="grid min-h-full place-items-center p-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated private file */}
      <img
        src={url}
        alt={alt}
        onError={() => setFailed(true)}
        className="max-h-[calc(100dvh-9rem)] rounded-xs bg-surface object-contain shadow-raised ring-1 ring-line"
      />
    </div>
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
    <section aria-label="Decisione sulla voce" className="border-b border-line px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-balance">{item.title}</p>
          {memberSuffix(item) && (
            <Pill tone="neutral" className="mt-1.5 max-w-full min-w-0">
              <span dir="auto" className="truncate">
                {memberSuffix(item)}
              </span>
            </Pill>
          )}
        </div>
        <Pill tone={status.tone} className="mt-0.5">
          {status.label}
        </Pill>
      </div>
      {decided ? (
        <Button variant="ghost" size="sm" className="-ms-3 mt-3" loading={busy} onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          Annulla decisione
        </Button>
      ) : rejecting ? (
        <form onSubmit={submit} className="mt-4 grid gap-2">
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={onVerify}
              aria-keyshortcuts="V"
              data-viewer-primary="true"
            >
              <Check className="size-4" aria-hidden />
              Verifica
              <KeyHint>V</KeyHint>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRejecting(true)}
              aria-keyshortcuts="R"
            >
              Rifiuta
              <KeyHint>R</KeyHint>
            </Button>
          </div>
          <p className="mt-2.5 text-xs text-ink-3">
            Poi passa al prossimo documento da controllare.
          </p>
        </>
      )}
    </section>
  );
}

/** The key inside a button: out of the accessible name, which aria-keyshortcuts already carries. */
function KeyHint({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="ms-1 grid h-4.5 min-w-4.5 place-items-center rounded-xs bg-current/15 px-1 font-mono text-[0.6875rem] leading-none"
    >
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("min-w-0", value ? "font-medium text-ink" : "text-ink-3")}>
        {value ?? "Non rilevato"}
      </dd>
    </>
  );
}

function IconButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
  ...props
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-keyshortcuts={shortcut}
      disabled={disabled}
      onClick={onClick}
      {...props}
      className="grid size-9 place-items-center rounded-sm text-ink-2 transition-[background-color,color,transform] duration-100 ease-(--ease-out) hover:bg-sunk hover:text-ink active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
