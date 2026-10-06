"use client";

import {
  AlertTriangle,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  CircleDashed,
  FileText,
  FileUp,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import type { ChecklistItem, CitizenCase, DocumentSummary, Finding } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, format, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import type { CitizenCaseApi, PendingUpload } from "@/lib/citizen/use-citizen-case";
import { cn } from "@/lib/cn";
import { DONE_STATUSES } from "@/lib/citizen/view";
import { ActionErrorNotice } from "./action-error";
import type { StepProps } from "./citizen-app";
import { PhotoTips } from "./photo-tips";
import { SaveLinkActions } from "./save-link";
import { STEP_TITLE_ID } from "@/lib/citizen/view";

type M = Widen<CitizenMessages>;

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic,.heif";

export function DocumentsStep({ api, data, m, goTo, token }: StepProps) {
  const required = data.checklist.filter((item) => item.required);
  const missingRequired = required.filter((item) => !DONE_STATUSES.has(item.status)).length;
  const unmatched = data.documents.filter((doc) => !doc.checklistItemId);
  const operatorMessage = data.status === "needs_citizen" ? lastOperatorMessage(data) : null;
  const sections = groupByMember(data.checklist, m);

  return (
    <div className="grid gap-6">
      <div>
        <h1
          id={STEP_TITLE_ID}
          tabIndex={-1}
          className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.025em] outline-none"
        >
          {m.docs.title}
        </h1>
        <p className="mt-2 text-lg text-ink-2">{m.docs.lead}</p>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar
            value={
              data.progress.documentsRequired
                ? (data.progress.documentsDone / data.progress.documentsRequired) * 100
                : 100
            }
            label={format(m.docs.progress, {
              done: data.progress.documentsDone,
              total: data.progress.documentsRequired,
            })}
            tone={missingRequired === 0 ? "ok" : "stamp"}
            className="flex-1"
          />
          <span className="tabular shrink-0 text-sm font-semibold text-ink-2">
            {format(m.docs.progress, {
              done: data.progress.documentsDone,
              total: data.progress.documentsRequired,
            })}
          </span>
        </div>
      </div>

      {operatorMessage && (
        <section className="animate-rise rounded-lg bg-warn-wash p-5 ring-1 ring-warn/20">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-warn">
            <MessageCircle className="size-5" aria-hidden />
            {m.request.title}
          </h2>
          <p dir="auto" className="mt-2 text-lg whitespace-pre-line text-ink">
            {operatorMessage.text}
          </p>
          {data.language !== "it" &&
            (operatorMessage.originalText === null ||
              operatorMessage.originalText === operatorMessage.text) && (
              <p className="mt-2 text-sm text-ink-2">{m.request.untranslated}</p>
            )}
          <p className="mt-2 text-ink-2">{m.request.lead}</p>
        </section>
      )}

      <ActionErrorNotice error={api.actionError} m={m} onDismiss={api.clearActionError} />

      <PhotoTips m={m} defaultOpen={data.documents.length === 0} />

      {sections.map((section) => (
        <section
          key={section.key}
          aria-labelledby={`section-${section.key}`}
          className="grid gap-3"
        >
          <h2
            id={`section-${section.key}`}
            className="font-display text-xl font-semibold tracking-[-0.01em]"
          >
            {section.title}
          </h2>
          <ul className="grid gap-3">
            {section.items.map((item) => (
              <ChecklistCard key={item.id} item={item} data={data} api={api} m={m} token={token} />
            ))}
          </ul>
        </section>
      ))}

      {unmatched.length > 0 && (
        <section className="grid gap-3 rounded-lg bg-sunk p-4">
          <div>
            <h2 className="font-display text-xl font-semibold">{m.docs.unmatched}</h2>
            <p className="mt-1 text-ink-2">{m.docs.unmatchedHint}</p>
          </div>
          <ul className="grid gap-2">
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

      <section className="rounded-lg border-2 border-dashed border-line-strong p-5">
        <h2 className="font-semibold">{m.docs.uploadAny}</h2>
        <p className="mt-1 text-ink-2">{m.docs.uploadAnyHint}</p>
        <PendingUploads
          uploads={api.uploads.filter((u) => u.checklistItemId === null)}
          api={api}
          m={m}
        />
        <UploadButtons api={api} m={m} checklistItemId={null} className="mt-4" />
      </section>

      {missingRequired > 0 && (
        <section
          aria-labelledby="resume-later"
          className="rounded-lg bg-surface p-4 ring-1 ring-line"
        >
          <h2 id="resume-later" className="flex items-center gap-2 font-semibold">
            <Bookmark className="size-5 shrink-0 text-stamp" aria-hidden />
            {m.docs.resumeTitle}
          </h2>
          <p className="mt-1 mb-3 text-ink-2">{m.docs.resumeBody}</p>
          <SaveLinkActions m={m} title={data.reference} />
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface shadow-[0_-8px_24px_-16px_rgb(20_27_45/0.25)]">
        <div className="mx-auto flex max-w-xl flex-col gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p
            className={cn(
              "text-sm",
              missingRequired === 0 ? "font-semibold text-ok" : "text-ink-2",
            )}
          >
            {missingRequired === 0
              ? m.docs.allDone
              : format(m.docs.missing, { n: missingRequired })}
          </p>
          <Button
            size="lg"
            className="w-full"
            onClick={() => goTo("review")}
            disabled={api.uploads.some((u) => !u.error)}
          >
            {m.docs.toReview}
          </Button>
        </div>
      </div>
    </div>
  );
}

function lastOperatorMessage(data: CitizenCase) {
  for (let i = data.messages.length - 1; i >= 0; i--) {
    if (data.messages[i]!.role === "operator") return data.messages[i]!;
  }
  return null;
}

function groupByMember(items: ChecklistItem[], m: M) {
  const sections = new Map<string, { key: string; title: string; items: ChecklistItem[] }>();
  for (const item of items) {
    const key = item.memberId ?? "household";
    const title = item.memberId ? (item.memberName ?? m.members.title) : m.docs.household;
    if (!sections.has(key)) sections.set(key, { key, title, items: [] });
    sections.get(key)!.items.push(item);
  }
  // Required and unfinished first: what still needs doing is what people look for.
  const rank = (item: ChecklistItem) =>
    (item.required ? 0 : 2) + (DONE_STATUSES.has(item.status) ? 1 : 0);
  return [...sections.values()].map((section) => ({
    ...section,
    items: [...section.items].sort((a, b) => rank(a) - rank(b)),
  }));
}

function StatusBadge({ item, m }: { item: ChecklistItem; m: M }) {
  const tone = DONE_STATUSES.has(item.status)
    ? "bg-ok-wash text-ok"
    : item.status === "issue" || item.status === "rejected"
      ? "bg-warn-wash text-warn"
      : "bg-sunk text-ink-2";
  const Icon = DONE_STATUSES.has(item.status)
    ? Check
    : item.status === "issue" || item.status === "rejected"
      ? AlertTriangle
      : CircleDashed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {m.docs.status[item.status]}
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
  const done = DONE_STATUSES.has(item.status);

  return (
    <li
      className={cn(
        "rounded-lg bg-surface p-4 ring-1 transition-shadow sm:p-5",
        item.status === "rejected" || item.status === "issue" ? "ring-warn/40" : "ring-line",
        done && "bg-surface/70",
      )}
    >
      {/* On narrow phones the badge drops below the title instead of squeezing it. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 grow basis-52">
          <h3 className="text-lg leading-snug font-semibold">{item.title}</h3>
          {!item.required && <p className="mt-0.5 text-sm text-ink-3">{m.docs.optional}</p>}
        </div>
        <StatusBadge item={item} m={m} />
      </div>
      {!done && <p className="mt-2 text-ink-2">{item.description}</p>}

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
        <ul className="mt-4 grid gap-2">
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
    <p className={cn("mt-2 flex items-start gap-2 text-[0.9375rem]", tone)}>
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
        type="button"
        variant="secondary"
        className="hidden min-w-40 flex-1 text-stamp pointer-coarse:inline-flex"
        onClick={() => cameraRef.current?.click()}
      >
        <Camera className="size-4" aria-hidden />
        {hasDocuments ? m.docs.addPage : m.docs.takePhoto}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="text-stamp pointer-coarse:min-w-40 pointer-coarse:flex-1 pointer-coarse:text-ink"
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
    <ul className="grid gap-2 not-empty:mt-3" aria-live="polite">
      {uploads.map((upload) => {
        const message = upload.error
          ? upload.error === "compress"
            ? m.docs.compressFailed
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
              <p className="truncate text-sm font-semibold" dir="auto">
                {upload.fileName}
              </p>
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
              <Button variant="secondary" size="sm" onClick={() => api.retryUpload(upload.id)}>
                {m.common.retry}
              </Button>
            )}
            {upload.error && (
              <button
                type="button"
                onClick={() => api.dismissUpload(upload.id)}
                className="grid size-10 shrink-0 place-items-center rounded-sm text-danger hover:bg-danger/10"
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
  const findings = (doc.analysis?.findings ?? []).filter((f) => f.severity !== "ok");
  const isImage = doc.mimeType.startsWith("image/") && doc.mimeType !== "image/heic";
  const fileUrl = `/api/c/${encodeURIComponent(token)}/documents/${doc.id}/file`;
  const thumbClass =
    "grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-sunk ring-1 ring-line";

  return (
    <li className="rounded-md bg-paper p-3 ring-1 ring-line">
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
          <p className="truncate text-sm font-semibold" dir="auto">
            {doc.analysis?.detectedLabel ?? doc.fileName}
          </p>
          <p className="truncate text-sm text-ink-3">
            {doc.status === "processing" ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="size-3.5" />
                {m.docs.checking}
              </span>
            ) : (
              <>
                <span dir="ltr">{formatSize(doc.sizeBytes, data.language)}</span>
                {doc.pages && doc.pages > 1 ? ` · ${format(m.docs.pages, { n: doc.pages })}` : ""}
              </>
            )}
          </p>
        </div>
        {confirming ? (
          <div
            role="group"
            aria-describedby={confirmId}
            className="flex shrink-0 items-center gap-1"
          >
            <Button
              variant="danger"
              loading={removing}
              onClick={() => void api.removeDocument(doc.id)}
            >
              {m.common.remove}
            </Button>
            <Button ref={cancelRef} variant="ghost" onClick={closeConfirm}>
              {m.common.cancel}
            </Button>
          </div>
        ) : (
          <button
            ref={trashRef}
            type="button"
            onClick={openConfirm}
            className="grid size-11 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-danger-wash hover:text-danger"
            aria-label={`${m.common.remove}: ${doc.fileName}`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {confirming && (
        <p id={confirmId} role="status" className="mt-2 text-sm text-ink-2">
          {m.docs.removeConfirm}
        </p>
      )}
      {findings.map((finding) => (
        <FindingLine key={finding.id} finding={finding} />
      ))}
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

function formatSize(bytes: number, language: string) {
  const megabytes = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(language, {
    style: "unit",
    unit: megabytes ? "megabyte" : "kilobyte",
    maximumFractionDigits: megabytes ? 1 : 0,
  }).format(megabytes ? bytes / (1024 * 1024) : Math.max(1, bytes / 1024));
}
