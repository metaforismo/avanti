"use client";

import {
  AlertTriangle,
  ArrowDown,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  FileText,
  FileUp,
  History,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChecklistItem, CitizenCase, DocumentSummary, Finding } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { FileName } from "@/components/ui/file-name";
import { Notice } from "@/components/ui/notice";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useChanged } from "@/components/ui/use-changed";
import {
  documentsProgress,
  errorMessage,
  plural,
  type CitizenMessages,
  type Widen,
} from "@/lib/citizen/messages";
import type { CitizenCaseApi, PendingUpload } from "@/lib/citizen/use-citizen-case";
import { cn } from "@/lib/cn";
import { directionOf } from "@/lib/citizen/document-language";
import { documentCountsOf, readinessOf, splitRequest } from "@/lib/citizen/view";
import type { Readiness } from "@avanti/core/readiness";
import { requestLabel } from "@avanti/core/request-labels";
import { ActionErrorNotice } from "./action-error";
import type { StepProps } from "./citizen-app";
import { PhotoTips } from "./photo-tips";
import { SaveLinkActions } from "./save-link";
import { onlineRetries } from "@/lib/citizen/online-retry";
import { STEP_TITLE_ID } from "@/lib/citizen/view";

type M = Widen<CitizenMessages>;

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic,.heif";

export function DocumentsStep({ api, data, m, goTo, token }: StepProps) {
  const counts = documentCountsOf(data);
  const progressLabel = documentsProgress(data.language, counts, m);
  const unmatched = data.documents.filter((doc) => !doc.checklistItemId);
  const operatorMessage = data.status === "needs_citizen" ? lastOperatorMessage(data) : null;
  const sections = groupByMember(data, m);
  const request = operatorMessage ? splitRequest(operatorMessage.text, data.checklist) : null;

  // A waiting-room connection comes and goes: when the browser says it is back, what failed while
  // it was away is sent again without a tap the citizen may not know they need. A stall on a Wi-Fi
  // that never dropped still needs «Riprova».
  // Listening from the start, not from the failure on: the connection can come back before an
  // effect run after the failing render would have attached the listener.
  const retryLost = useEffectEvent(() => {
    for (const upload of api.uploads) if (upload.error === "network") api.retryUpload(upload.id);
  });
  useEffect(() => {
    const retries = onlineRetries(
      () => retryLost(),
      () => navigator.onLine,
    );
    window.addEventListener("online", retries.onOnline);
    return () => {
      window.removeEventListener("online", retries.onOnline);
      retries.cancel();
    };
  }, []);

  return (
    // minmax(0, 1fr) on every grid down to the files: a long unbroken file name must truncate,
    // not widen the column past a 320px screen.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <h1
          id={STEP_TITLE_ID}
          tabIndex={-1}
          className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.025em] outline-none"
        >
          {m.docs.title}
        </h1>
        {/* With documents still being read the label grows: on a narrow phone it drops under the
            bar instead of squeezing it. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ProgressBar
            value={counts.required ? (counts.ready / counts.required) * 100 : 100}
            label={progressLabel}
            tone={counts.ready === counts.required ? "ok" : "stamp"}
            className="h-2 min-w-24 flex-1"
          />
          <span className="tabular text-sm font-semibold text-ink-2">{progressLabel}</span>
        </div>
      </div>

      {operatorMessage && request && (
        <section className="animate-rise rounded-lg bg-warn-wash p-5 ring-1 ring-warn/20">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-warn">
            <MessageCircle className="size-5" aria-hidden />
            {m.request.title}
          </h2>
          {request.body && (
            <p dir="auto" className="mt-2 text-lg whitespace-pre-line text-ink">
              {request.body}
            </p>
          )}
          {request.items.length > 0 && (
            <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
              {request.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => showItem(item.id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-md bg-surface px-4 py-2.5 text-start font-semibold text-ink ring-1 ring-warn/30 transition-transform ring-inset active:scale-[0.98]"
                  >
                    <span dir="auto" className="min-w-0 flex-1">
                      {requestLabel(item)}
                    </span>
                    {readinessOf(item, data) !== "todo" ? (
                      <Check className="size-5 shrink-0 text-ok" aria-hidden />
                    ) : (
                      <ArrowDown className="size-5 shrink-0 text-warn" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.language !== "it" &&
            (operatorMessage.originalText === null ||
              operatorMessage.originalText === operatorMessage.text) && (
              <p className="mt-2 text-sm text-ink-2">{m.request.untranslated}</p>
            )}
          <p className="mt-2 text-ink-2">{m.request.lead}</p>
        </section>
      )}

      {data.reuseNotice && (
        <Notice tone="info" size="md" icon={History}>
          <span dir="auto">{data.reuseNotice}</span>
        </Notice>
      )}

      <ActionErrorNotice error={api.actionError} m={m} onDismiss={api.clearActionError} />

      <PhotoTips m={m} defaultOpen={data.documents.length === 0} />

      {sections.map((section) => (
        <section
          key={section.key}
          aria-labelledby={`section-${section.key}`}
          className="grid grid-cols-[minmax(0,1fr)] gap-3"
        >
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2
              id={`section-${section.key}`}
              className="min-w-0 font-display text-xl font-semibold tracking-[-0.01em]"
            >
              {section.title}
            </h2>
            <span aria-hidden className="tabular shrink-0 text-sm font-medium text-ink-3">
              {section.items.filter((item) => readinessOf(item, data) !== "todo").length}/
              {section.items.length}
            </span>
          </div>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
            {section.items.map((item) => (
              <ChecklistCard key={item.id} item={item} data={data} api={api} m={m} token={token} />
            ))}
          </ul>
        </section>
      ))}

      {unmatched.length > 0 && (
        <section className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg bg-sunk p-4">
          <div>
            <h2 className="font-display text-xl font-semibold">{m.docs.unmatched}</h2>
            <p className="mt-1 text-ink-2">{m.docs.unmatchedHint}</p>
          </div>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {unmatched.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                data={data}
                api={api}
                m={m}
                token={token}
                showAssign
              />
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border-[1.5px] border-dashed border-line-strong p-4">
        <h2 className="font-semibold">{m.docs.uploadAny}</h2>
        <p className="mt-1 text-body-sm text-ink-3">{m.docs.uploadAnyHint}</p>
        <PendingUploads
          uploads={api.uploads.filter((u) => u.checklistItemId === null)}
          api={api}
          m={m}
        />
        <UploadButtons api={api} m={m} checklistItemId={null} className="mt-4" />
      </section>

      {counts.todo > 0 && (
        <section aria-labelledby="resume-later" className="px-1">
          <h2 id="resume-later" className="flex items-center gap-2 font-semibold">
            <Bookmark className="size-5 shrink-0 text-stamp" aria-hidden />
            {m.docs.resumeTitle}
          </h2>
          <p className="mt-1 mb-3 text-body-sm text-ink-3">{m.docs.resumeBody}</p>
          <SaveLinkActions m={m} title={data.reference} />
        </section>
      )}

      {/* Portalled: the step's entrance animation moves its content, and a moving ancestor
          would carry a fixed bar along with it. */}
      {createPortal(
        <div
          lang={data.language}
          dir={directionOf(data.language)}
          className="fixed inset-x-0 bottom-0 z-20 animate-dock-in border-t border-line bg-surface shadow-dock"
        >
          <div className="mx-auto flex max-w-xl flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <p
              className={cn(
                "flex items-center gap-2 text-sm",
                counts.todo + counts.checking === 0 ? "font-semibold text-ok" : "text-ink-2",
              )}
            >
              {counts.todo + counts.checking === 0 && (
                <Check className="size-4 shrink-0 animate-check-in" aria-hidden />
              )}
              {counts.todo > 0
                ? plural(data.language, counts.todo, m.docs.missing)
                : counts.checking > 0
                  ? plural(data.language, counts.checking, m.docs.allUploaded)
                  : m.docs.allDone}
            </p>
            {/* While documents are missing, uploading is the next step: the way on stays, quieter. */}
            <Button
              size="lg"
              variant={counts.todo > 0 ? "secondary" : "primary"}
              className="w-full"
              onClick={() => goTo("review")}
              disabled={api.uploads.some((u) => !u.error)}
            >
              {m.docs.toReview}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const itemId = (id: string) => `item-${id}`;

/**
 * Brings a card under the sticky header and gives it focus, so a screen reader reads it next.
 * The card is focusable only for this jump: a card that always is would show a ring on every tap.
 */
function showItem(id: string) {
  const card = document.getElementById(itemId(id));
  if (!card) return;
  card.tabIndex = -1;
  card.dataset.jumped = "";
  card.addEventListener(
    "blur",
    () => {
      card.removeAttribute("tabindex");
      delete card.dataset.jumped;
    },
    { once: true },
  );
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  card.focus({ preventScroll: true });
}

function lastOperatorMessage(data: CitizenCase) {
  for (let i = data.messages.length - 1; i >= 0; i--) {
    if (data.messages[i]!.role === "operator") return data.messages[i]!;
  }
  return null;
}

function groupByMember(data: CitizenCase, m: M) {
  const sections = new Map<string, { key: string; title: string; items: ChecklistItem[] }>();
  for (const item of data.checklist) {
    const key = item.memberId ?? "household";
    const title = item.memberId ? (item.memberName ?? m.members.title) : m.docs.household;
    if (!sections.has(key)) sections.set(key, { key, title, items: [] });
    sections.get(key)!.items.push(item);
  }
  // Required and unfinished first: what still needs doing is what people look for.
  const rank = (item: ChecklistItem) =>
    (item.required ? 0 : 2) + (readinessOf(item, data) === "todo" ? 0 : 1);
  return [...sections.values()].map((section) => ({
    ...section,
    items: [...section.items].sort((a, b) => rank(a) - rank(b)),
  }));
}

/**
 * The badge follows readiness: an optional item whose only file could not be read has no blocking
 * finding, so it stays «uploaded», yet the citizen still has something to look at.
 */
function shownStatus(item: ChecklistItem, readiness: Readiness) {
  return readiness === "todo" && item.status === "uploaded" ? "issue" : item.status;
}

/**
 * Where the item stands: a round mark at the start of the card and a short coloured line under
 * the title. The mark pops when an upload or the operator changes it, not when the page opens.
 */
function useStatus(item: ChecklistItem, readiness: Readiness) {
  const status = shownStatus(item, readiness);
  const shown = readiness === "checking" ? "checking" : status;
  const warn = status === "issue" || status === "rejected";
  return { status, shown, warn, changed: useChanged(shown) };
}

function StatusMark({
  readiness,
  warn,
  shown,
  changed,
}: {
  readiness: Readiness;
  warn: boolean;
  shown: string;
  changed: boolean;
}) {
  return (
    <span
      key={shown}
      aria-hidden
      className={cn(
        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
        readiness === "ready"
          ? "bg-ok text-white"
          : warn
            ? "bg-warn-wash text-warn"
            : readiness === "checking"
              ? "bg-stamp-wash text-stamp"
              : "border-[1.5px] border-dashed border-line-strong text-ink-3",
        changed && "animate-check-in",
      )}
    >
      {readiness === "checking" ? (
        <Spinner className="size-4" />
      ) : readiness === "ready" ? (
        <Check className="size-4.5" strokeWidth={2.75} />
      ) : warn ? (
        <AlertTriangle className="size-4" />
      ) : (
        <FileUp className="size-4" />
      )}
    </span>
  );
}

function ChecklistCard({
  item,
  data,
  api,
  m,
  token,
}: {
  item: ChecklistItem;
  data: CitizenCase;
  api: CitizenCaseApi;
  m: M;
  token: string;
}) {
  const [howOpen, setHowOpen] = useState(false);
  const howId = useId();
  const documents = data.documents.filter((doc) => doc.checklistItemId === item.id);
  const findings = data.findings.filter(
    (f) =>
      f.checklistItemId === item.id &&
      !f.documentId &&
      f.severity !== "ok" &&
      f.code !== "checklist.missing",
  );
  const uploads = api.uploads.filter((u) => u.checklistItemId === item.id);
  const readiness = readinessOf(item, data);
  const { status, shown, warn, changed } = useStatus(item, readiness);
  // Ready or being read: nothing for the citizen to do, so the card stops explaining.
  const done = readiness !== "todo";

  return (
    <li
      id={itemId(item.id)}
      aria-labelledby={`${itemId(item.id)}-title`}
      className={cn(
        "rounded-lg bg-surface p-4 ring-1 transition-shadow outline-none data-jumped:ring-2 data-jumped:ring-stamp",
        warn ? "ring-warn/40" : "ring-line",
        done && "py-3.5",
      )}
    >
      <div className="flex items-start gap-3">
        <StatusMark readiness={readiness} warn={warn} shown={shown} changed={changed} />
        <div className="min-w-0 flex-1">
          <h3
            id={`${itemId(item.id)}-title`}
            className="text-[1.0625rem] leading-snug font-semibold"
          >
            {item.title}
          </h3>
          <p
            className={cn(
              "mt-0.5 text-sm font-medium",
              readiness === "ready" ? "text-ok" : warn ? "text-warn" : "text-ink-3",
            )}
          >
            {readiness === "checking" ? m.docs.statusChecking : m.docs.status[status]}
            {!item.required && <span className="font-normal text-ink-3"> · {m.docs.optional}</span>}
          </p>
        </div>
      </div>
      {!done && <p className="mt-3 text-ink-2">{item.description}</p>}

      {item.note && (
        <p className="mt-3 rounded-sm bg-warn-wash px-3 py-2.5 text-ink">
          <span className="font-semibold">{m.docs.operatorNote}: </span>
          {item.note}
        </p>
      )}

      {findings.map((finding) => (
        <FindingLine key={finding.id} finding={finding} />
      ))}

      {item.howToGet && !done && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={howOpen}
            aria-controls={howId}
            onClick={() => setHowOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-stamp"
          >
            {m.docs.howToGet}
            <ChevronDown
              className={cn("size-4 transition-transform duration-200", howOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {howOpen && (
            <p
              id={howId}
              className="mt-2 animate-fade-in rounded-sm bg-sunk px-3 py-2.5 whitespace-pre-line text-ink-2"
            >
              {item.howToGet}
            </p>
          )}
        </div>
      )}

      {documents.length > 0 && (
        <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} data={data} api={api} m={m} token={token} />
          ))}
        </ul>
      )}
      <PendingUploads uploads={uploads} api={api} m={m} />

      {item.status !== "verified" && item.status !== "waived" && (
        <UploadButtons
          api={api}
          m={m}
          checklistItemId={item.id}
          hasDocuments={documents.length > 0}
          className="mt-4"
        />
      )}
    </li>
  );
}

function FindingLine({ finding }: { finding: Finding }) {
  const tone =
    finding.severity === "blocker"
      ? "text-danger"
      : finding.severity === "warning"
        ? "text-warn"
        : "text-ink-2";
  return (
    <p className={cn("mt-2 flex items-start gap-2 text-body-sm", tone)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {finding.message}
    </p>
  );
}

function UploadButtons({
  api,
  m,
  checklistItemId,
  hasDocuments = false,
  className,
}: {
  api: CitizenCaseApi;
  m: M;
  checklistItemId: string | null;
  hasDocuments?: boolean;
  className?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) void api.upload(file, checklistItemId);
  };

  return (
    // Two equal buttons side by side; they stack when a language makes the labels too long.
    <div className={cn("flex flex-wrap gap-2", className)}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {/* Pointer type is decided in CSS, not after hydration: no layout shift on phones. */}
      <Button
        size="touch"
        type="button"
        variant="tinted"
        className="hidden min-h-12 min-w-40 flex-1 pointer-coarse:inline-flex"
        onClick={() => cameraRef.current?.click()}
      >
        <Camera className="size-4" aria-hidden />
        {hasDocuments ? m.docs.addPage : m.docs.takePhoto}
      </Button>
      <Button
        size="touch"
        type="button"
        variant="tinted"
        // On phones the camera is the main way in; choosing a file steps back to a plain button.
        className="pointer-coarse:min-h-12 pointer-coarse:min-w-40 pointer-coarse:flex-1 pointer-coarse:bg-surface pointer-coarse:text-ink pointer-coarse:ring-1 pointer-coarse:ring-line-strong pointer-coarse:ring-inset"
        onClick={() => fileRef.current?.click()}
      >
        <FileUp className="size-4" aria-hidden />
        <span className="pointer-coarse:hidden">
          {hasDocuments ? m.docs.addPage : m.docs.upload}
        </span>
        <span className="hidden pointer-coarse:inline">{m.docs.chooseFile}</span>
      </Button>
    </div>
  );
}

/** Errors worth another try with the same file; size and format errors are not. */
const RETRYABLE = new Set<PendingUpload["error"]>(["network", "rate_limited", "internal"]);

function PendingUploads({
  uploads,
  api,
  m,
}: {
  uploads: PendingUpload[];
  api: CitizenCaseApi;
  m: M;
}) {
  // The live region is always mounted: one that appears with its first item is not announced.
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 not-empty:mt-3" aria-live="polite">
      {uploads.map((upload) => {
        const message = upload.error
          ? upload.error === "compress"
            ? m.docs.compressFailed
            : // Upload conflicts are mostly the case limits, not a change made elsewhere.
              upload.error === "conflict"
              ? m.errors.generic
              : errorMessage(m, upload.error)
          : upload.progress >= 1
            ? m.docs.checking
            : m.docs.uploading;
        return (
          <li
            key={upload.id}
            className={cn(
              "flex animate-fade-in items-center gap-3 rounded-md px-3 py-2.5 ring-1 ring-inset",
              upload.error ? "bg-danger-wash ring-danger/20" : "bg-sunk ring-line",
            )}
          >
            {upload.error ? (
              <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden />
            ) : (
              <Spinner className="size-5 shrink-0 text-stamp" />
            )}
            <div className="min-w-0 flex-1">
              <FileName name={upload.fileName} className="text-sm font-semibold" />
              <p className={cn("text-sm", upload.error ? "text-danger" : "text-ink-3")}>
                {message}
              </p>
              {!upload.error && upload.progress < 1 && (
                <ProgressBar
                  value={upload.progress * 100}
                  label={m.docs.uploading}
                  className="mt-1.5 h-1"
                />
              )}
            </div>
            {upload.error && RETRYABLE.has(upload.error) && (
              <Button variant="secondary" size="touch" onClick={() => api.retryUpload(upload.id)}>
                {m.common.retry}
              </Button>
            )}
            {upload.error && (
              <button
                type="button"
                onClick={() => api.dismissUpload(upload.id)}
                className="grid size-11 shrink-0 place-items-center rounded-sm text-danger hover:bg-danger/10"
                aria-label={m.common.close}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DocumentRow({
  doc,
  data,
  api,
  m,
  token,
  showAssign = false,
}: {
  doc: DocumentSummary;
  data: CitizenCase;
  api: CitizenCaseApi;
  m: M;
  token: string;
  showAssign?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const selectId = useId();
  const confirmId = `${selectId}-confirm`;
  const trashRef = useRef<HTMLButtonElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const openConfirm = () => {
    setConfirming(true);
    requestAnimationFrame(() => cancelRef.current?.focus());
  };
  const closeConfirm = () => {
    setConfirming(false);
    requestAnimationFrame(() => trashRef.current?.focus());
  };
  const removing = api.pending === `remove:${doc.id}`;
  const reassigning = api.pending === `reassign:${doc.id}`;
  const isImage = doc.mimeType.startsWith("image/") && doc.mimeType !== "image/heic";
  const fileUrl = `/api/c/${encodeURIComponent(token)}/documents/${doc.id}/file`;
  const thumbClass =
    "grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-sunk ring-1 ring-line";

  return (
    <li className="rounded-md bg-paper p-2.5 ring-1 ring-line">
      <div className="flex items-center gap-3">
        {/* Files are served as downloads: photos open here, other files are saved. */}
        {isImage ? (
          <button
            type="button"
            onClick={() => setPreviewing(true)}
            className={thumbClass}
            aria-label={`${m.docs.preview}: ${doc.fileName}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- private, token-scoped file: no optimizer */}
            <img src={fileUrl} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        ) : (
          <a
            href={fileUrl}
            download={doc.fileName}
            className={thumbClass}
            aria-label={`${m.docs.preview}: ${doc.fileName}`}
          >
            <FileText className="size-5 text-ink-3" aria-hidden />
          </a>
        )}
        <div className="min-w-0 flex-1">
          {doc.analysis?.detectedLabel ? (
            <p className="truncate text-sm font-semibold" dir="auto" title={doc.fileName}>
              {doc.analysis.detectedLabel}
            </p>
          ) : (
            <FileName name={doc.fileName} className="text-sm font-semibold" />
          )}
          <p className="truncate text-sm text-ink-3">
            {doc.status === "processing" ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="size-3.5" />
                {m.docs.checking}
              </span>
            ) : (
              <>
                <span dir="ltr">{formatSize(doc.sizeBytes, data.language)}</span>
                {doc.pages && doc.pages > 1
                  ? ` · ${plural(data.language, doc.pages, m.docs.pages)}`
                  : ""}
                {doc.reuse && (
                  <Pill tone="stamp" className="ms-2">
                    <History aria-hidden />
                    {m.docs.reused.label} · {m.docs.reused[doc.reuse.status]}
                  </Pill>
                )}
              </>
            )}
          </p>
        </div>
        {!confirming && (
          <button
            ref={trashRef}
            type="button"
            onClick={openConfirm}
            className="grid size-11 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-danger-wash hover:text-danger active:bg-danger-wash active:text-danger"
            aria-label={`${m.common.remove}: ${doc.fileName}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {/* Below the file, not beside it: two buttons in a long language would squeeze the name
          to nothing on a narrow phone. */}
      {confirming && (
        <div className="mt-2 flex animate-fade-in flex-wrap items-center gap-x-3 gap-y-1">
          <p id={confirmId} role="status" className="min-w-0 flex-1 basis-40 text-sm text-ink-2">
            {m.docs.removeConfirm}
          </p>
          <div role="group" aria-describedby={confirmId} className="flex shrink-0 gap-1">
            <Button
              size="touch"
              variant="danger"
              loading={removing}
              onClick={() => void api.removeDocument(doc.id)}
            >
              {m.common.remove}
            </Button>
            <Button size="touch" ref={cancelRef} variant="ghost" onClick={closeConfirm}>
              {m.common.cancel}
            </Button>
          </div>
        </div>
      )}
      <DocumentCheck doc={doc} api={api} m={m} />
      {showAssign && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor={selectId} className="shrink-0 text-sm text-ink-2">
            {m.docs.assignTo}
          </label>
          <Select
            id={selectId}
            value={doc.checklistItemId ?? ""}
            disabled={reassigning}
            onChange={(e) => void api.reassign(doc.id, e.target.value || null)}
            compact
            wrapperClassName="min-w-0 flex-1"
            className="text-sm"
          >
            <option value="">{m.docs.notAssigned}</option>
            {data.checklist.map((item) => (
              <option key={item.id} value={item.id}>
                {item.memberName ? `${item.title} (${item.memberName})` : item.title}
              </option>
            ))}
          </Select>
          {reassigning && <Spinner className="size-4 text-stamp" />}
        </div>
      )}
      {isImage && (
        <Dialog
          open={previewing}
          onOpenChange={setPreviewing}
          title={doc.analysis?.detectedLabel ?? doc.fileName}
          closeLabel={m.common.close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private, token-scoped file: no optimizer */}
          <img
            src={fileUrl}
            alt={doc.analysis?.detectedLabel ?? doc.fileName}
            className="max-h-[70dvh] w-full rounded-md bg-sunk object-contain"
          />
        </Dialog>
      )}
    </li>
  );
}

/**
 * What the immediate check found, in the citizen's language. A flagged document can be kept:
 * the citizen may know better (a renewal receipt, an old card still in use), and the
 * operator verifies it anyway.
 */
function DocumentCheck({ doc, api, m }: { doc: DocumentSummary; api: CitizenCaseApi; m: M }) {
  const check = doc.citizenCheck;
  if (doc.status === "processing" || check.status === "pending") return null;
  if (check.status === "ok")
    // Only an AI reading can say the document looks right; otherwise it is simply received.
    return doc.analysis?.engine === "ai" ? (
      <p className="mt-2 flex items-center gap-1.5 text-sm text-ok">
        <Check className="size-4 shrink-0" aria-hidden />
        {m.docs.checkOk}
      </p>
    ) : (
      <p className="mt-2 text-sm text-ink-3">{m.docs.received}</p>
    );
  const problem = check.status === "problem";
  return (
    <div
      className={cn(
        "mt-3 rounded-sm px-3 py-2.5",
        problem ? "bg-danger-wash text-danger" : "bg-warn-wash text-warn",
      )}
    >
      <ul className="grid gap-1">
        {check.messages.map((message) => (
          <li key={message} className="flex items-start gap-2 text-body-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span dir="auto">{message}</span>
          </li>
        ))}
      </ul>
      {doc.citizenKeptAt ? (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-2">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          {m.docs.kept}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="secondary"
            size="touch"
            loading={api.pending === `keep:${doc.id}`}
            onClick={() => void api.keepDocument(doc.id)}
          >
            {m.docs.keep}
          </Button>
          <p className="min-w-0 flex-1 basis-48 text-sm text-ink-2">{m.docs.keepHint}</p>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number, language: string) {
  const megabytes = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(language, {
    style: "unit",
    unit: megabytes ? "megabyte" : "kilobyte",
    maximumFractionDigits: megabytes ? 1 : 0,
  }).format(megabytes ? bytes / (1024 * 1024) : Math.max(1, bytes / 1024));
}
