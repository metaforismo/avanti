"use client";

import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Check,
  FileQuestion,
  ChevronDown,
  Download,
  MoreHorizontal,
  FileArchive,
  FileJson,
  Printer,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { documentArchivePlan, type DocumentArchivePlan } from "@avanti/core/document-archive";
import type { Route } from "next";
import type {
  CaseDossier,
  CaseListResponse,
  CaseStatus,
  ChatMessage,
  DocumentSummary,
  ReplyDraftResponse,
  ReviewChecklistItemRequest,
  UpdateCaseRequest,
} from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CASE_STATUS, fullName, LANGUAGE_IT, PRACTICE_SHORT } from "@/lib/console/labels";
import { forgetCase, rememberCase, useQueueHref } from "@/lib/console/recent-cases";
import { useOperator } from "@/lib/console/operator-context";
import { useDownload } from "@/lib/console/use-download";
import { zipComplete } from "@/lib/console/zip-complete";
import { moveInCachedList } from "@/lib/console/queue-params";
import { updateCached, useResource } from "@/lib/console/use-resource";
import { useDesktop } from "@/lib/console/use-media-query";
import { cn } from "@/lib/cn";
import { ChecklistSection, firstDocumentToCheck } from "./checklist-section";
import { DeleteCaseDialog } from "./delete-case-dialog";
import { CopilotPanel } from "./copilot-panel";
import { NearReadyPanel } from "./near-ready-panel";
import { DossierChat } from "./dossier-chat";
import { DocumentViewer } from "./document-viewer";
import { DossierAside } from "./dossier-aside";
import { DsuSheetSection } from "./dsu-sheet-section";
import { FamilyErasureDialog } from "./family-erasure-dialog";
import { ErasureRequestNotice } from "./erasure-request-notice";
import { NewLinkDialog } from "./new-link-dialog";
import { ReuseDialog } from "./reuse-dialog";
import { FindingsSummary } from "./findings-summary";
import { RequestDialog, type ReplyContext } from "./request-dialog";
import { CitizenQuestions } from "./citizen-questions";
import { CitizenNoticeDialog, printPath, type IssuedLink } from "../citizen-notice";
import { AnswersSection, AssistantTurnsSection, ConversationSection } from "./secondary-sections";
import { isTyping } from "../shortcuts-dialog";
import { useNextCase } from "./use-next-case";

/**
 * Moving to another page of the console keeps no beforeunload: notes that failed to save would
 * go silently. They are the only text on the dossier that lives outside a dialog.
 */
function mayLeave() {
  if (!document.querySelector('[data-unsaved="true"]')) return true;
  return window.confirm("Le note interne non sono salvate. Lasciare comunque la pratica?");
}

const CONFLICT_MESSAGE =
  "La pratica è cambiata nel frattempo (un collega, il cittadino o un'analisi appena conclusa). Ti mostriamo la versione aggiornata: controlla e ripeti l'azione se serve.";

export type DossierActions = {
  /** The dossier as the decision left it, or null if it failed. */
  review: (itemId: string, input: ReviewChecklistItemRequest) => Promise<CaseDossier | null>;
  /** `key` separates background saves (notes) from button spinners. */
  update: (input: UpdateCaseRequest, key?: string) => Promise<boolean>;
  openDocument: (doc: DocumentSummary) => void;
  /** Confirms or discards a value the AI read from a document for the DSU sheet. */
  decidePrefill: (fieldId: string, decision: "accept" | "reject") => Promise<boolean>;
  /** Near-ready actions; every one carries the version the suggestion was computed on. */
  nearReady: (
    action: "evaluate" | "blind-review" | "decision" | "final-decision",
    input: Record<string, unknown>,
  ) => Promise<boolean>;
  pending: string | null;
  /** Why the last action failed, for surfaces that cover the page (the document viewer). */
  error: string | null;
  /** Every original in one ZIP, named and ordered for the CAF's software. */
  archive: { plan: DocumentArchivePlan; download: () => Promise<void>; pending: boolean };
};

export function DossierView({ caseId }: { caseId: string }) {
  const operator = useOperator();
  const dossier = useResource<CaseDossier>(`/api/cases/${encodeURIComponent(caseId)}`);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; status: number } | null>(null);
  const error = failure?.message ?? null;
  const setError = (message: string | null) =>
    setFailure(message === null ? null : { message, status: 0 });
  const [confirmClose, setConfirmClose] = useState(false);
  const [withdraw, setWithdraw] = useState<"ask" | "saving" | "done" | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [newLink, setNewLink] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [issuedLink, setIssuedLink] = useState<IssuedLink | null>(null);
  const [reuse, setReuse] = useState(false);
  const [eraseFamily, setEraseFamily] = useState(false);
  const readyButton = useRef<HTMLButtonElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  // The «Altro» button as state too: menu items hand it to a confirmation as the place where
  // focus returns, and render code may not read a ref.
  const [moreTrigger, setMoreTrigger] = useState<HTMLButtonElement | null>(null);
  const setMore = (node: HTMLButtonElement | null) => {
    moreButton.current = node;
    setMoreTrigger(node);
  };
  const closeButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  // Where the keyboard lands after «Chiudi e archivia»: back on the opener if cancelled, on
  // «Prossima pratica» once the case is closed (the opener is gone by then).
  const closeReturn = useRef<HTMLElement | null>(null);
  const focusClose = useRef(false);
  // The open document lives in the URL: shareable with a colleague, closed by the Back button.
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const viewingId = params.get("documento");
  const setViewing = (doc: DocumentSummary | null) => {
    const next = new URLSearchParams(params);
    if (doc) next.set("documento", doc.id);
    else next.delete("documento");
    const search = next.toString();
    const href = (search ? `${pathname}?${search}` : pathname) as Route;
    // Opening adds a history entry (Back closes it); moving between documents or closing replaces it.
    if (doc && !viewingId) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };
  const [requesting, setRequesting] = useState(false);
  const [reply, setReply] = useState<ReplyContext | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const files = useDownload();
  const queueHref = useQueueHref();
  const next = useNextCase(caseId);
  const desktop = useDesktop();
  // The sticky action bar's height (0 on phones, where it isn't a box): the error notice sticks
  // just below it, and the bar names the case once the h1 has scrolled under it.
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => {
    if (!bar) return;
    const observer = new ResizeObserver(([entry]) =>
      setBarHeight(Math.round(entry?.borderBoxSize[0]?.blockSize ?? 0)),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, [bar]);
  const [title, setTitle] = useState<HTMLHeadingElement | null>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!title) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(entry ? !entry.isIntersecting : false),
      { rootMargin: `-${barHeight}px 0px 0px 0px` },
    );
    observer.observe(title);
    return () => observer.disconnect();
  }, [title, barHeight]);

  // The version every write must carry. A ref, not the render's copy: writes queue up behind
  // each other (a note saved on blur while «Verifica» is clicked), and each one must carry
  // the version the previous one returned, or the operator's own note looks like a colleague's
  // change and the click is rejected as a conflict.
  const latest = useRef<CaseDossier | null>(null);
  useEffect(() => {
    const seen = dossier.data;
    // A slow background refresh can land after a write: never step back to an older version.
    if (seen && !(latest.current?.id === seen.id && latest.current.updatedAt > seen.updatedAt))
      latest.current = seen;
  }, [dossier.data]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const { setData, reload } = dossier;
  const refresh = async () => {
    try {
      const next = await apiFetch<CaseDossier>(`/api/cases/${encodeURIComponent(caseId)}`);
      latest.current = next;
      setData(next);
    } catch {
      reload();
    }
  };

  const succeeded = (task: Promise<CaseDossier | null>) => task.then((done) => done !== null);

  function mutate(key: string, run: () => Promise<CaseDossier | unknown>) {
    const task = queue.current.then(() => perform(key, run));
    queue.current = task;
    return task;
  }

  async function perform(
    key: string,
    run: () => Promise<CaseDossier | unknown>,
  ): Promise<CaseDossier | null> {
    setPending(key);
    setError(null);
    try {
      const result = await run();
      if (result && typeof result === "object" && "checklist" in result) {
        latest.current = result as CaseDossier;
        setData(result as CaseDossier);
      } else await refresh();
      return latest.current ?? dossier.data;
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "conflict") {
        // Someone else (a colleague, the citizen, a finished analysis) changed the case since it
        // was read: show the current state and let the operator decide again. Never retry blindly.
        await refresh();
        setError(CONFLICT_MESSAGE);
        return null;
      }
      // Deleted meanwhile: the reload turns the page into «Pratica non trovata».
      if (err instanceof ApiRequestError && err.status === 404) reload();
      if (err instanceof ApiRequestError) setFailure({ message: err.message, status: err.status });
      else setError("Operazione non riuscita. Riprova.");
      return null;
    } finally {
      setPending(null);
    }
  }

  // Remembered for the sidebar and the ⌘K search: the cases this operator is working on.
  const loaded = dossier.data;
  useEffect(() => {
    if (!loaded) return;
    rememberCase({
      operatorId: operator.id,
      id: loaded.id,
      reference: loaded.reference,
      name: fullName(loaded.citizen),
      practice: loaded.practice ? PRACTICE_SHORT[loaded.practice.id] : null,
    });
  }, [loaded, operator.id]);

  // A case that changes status leaves the cached queue lists it was in: back on the queue, the
  // case just finished is not the first row while the list refreshes (and opened by mistake).
  const shownStatus = useRef<{ id: string; status: CaseStatus } | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const before = shownStatus.current;
    shownStatus.current = { id: loaded.id, status: loaded.status };
    if (!before || before.id !== loaded.id || before.status === loaded.status) return;
    // The erasure requests list every status: a case changing status stays in it.
    updateCached<CaseListResponse>("/api/cases?", (list, path) =>
      path.includes("erasure=")
        ? null
        : moveInCachedList(list, loaded.id, before.status, loaded.status),
    );
  }, [loaded]);

  useEffect(() => {
    if (!focusClose.current || loaded?.status !== "ready") return;
    focusClose.current = false;
    closeButton.current?.focus({ preventScroll: true });
  }, [loaded?.status]);

  const notFound = dossier.error?.status === 404;
  useEffect(() => {
    if (notFound) forgetCase(caseId);
  }, [notFound, caseId]);

  // Uploads are analysed in the background: refresh until every document has its result.
  const analysing = dossier.data?.documents.some((doc) => doc.status === "processing") ?? false;
  useEffect(() => {
    if (!analysing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 3000);
    return () => window.clearInterval(id);
  }, [analysing, reload]);

  if (dossier.status === "loading") return <DossierSkeleton queueHref={queueHref} />;
  const gone = dossier.status === "error" && dossier.error.status === 404;
  if ((dossier.status === "error" && !dossier.data) || gone) {
    const missing = gone;
    return (
      <PageContainer width="3xl" centered className="py-16 lg:py-24">
        <EmptyState
          icon={FileQuestion}
          title={missing ? "Pratica non trovata" : "Fascicolo non disponibile"}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {!missing && (
                <Button variant="secondary" onClick={() => void reload()}>
                  Riprova
                </Button>
              )}
              <Button asChild>
                <Link href={queueHref as Route}>Torna alle pratiche</Link>
              </Button>
            </div>
          }
        >
          {missing
            ? "Potrebbe essere stata eliminata o appartenere a un altro CAF. Puoi cercarla con ⌘K."
            : dossier.error.message}
        </EmptyState>
      </PageContainer>
    );
  }

  const data = dossier.data!;
  const viewing = viewingId ? (data.documents.find((doc) => doc.id === viewingId) ?? null) : null;
  const status = CASE_STATUS[data.status];
  const citizenName = fullName(data.citizen);
  const base = `/api/cases/${encodeURIComponent(data.id)}`;
  const assignedToMe = data.assignee?.id === operator.id;
  // What still stands between this case and the official practice. While anything is open,
  // asking the citizen is the natural next step and "ready" needs a second thought.
  const missingCount = data.checklist.filter(
    (item) => item.required && item.status === "missing",
  ).length;
  const blockerCount = data.findings.filter(
    (finding) => finding.severity === "blocker" && finding.code !== "checklist.missing",
  ).length;
  const openIssues = missingCount + blockerCount;

  // Opening a case is read-only. Review starts with the first real action, so the measured
  // review time counts work, not glances at the queue. Every write carries the version the
  // operator saw; a chained write uses the version the previous one returned.
  const current = () => latest.current ?? data;
  const startReview = async () => {
    const seen = current();
    if (seen.status !== "submitted") return seen.updatedAt;
    const started = await apiFetch<CaseDossier>(base, {
      method: "PATCH",
      body: { status: "in_review", expectedUpdatedAt: seen.updatedAt },
    });
    latest.current = started;
    return started.updatedAt;
  };

  const archivePath = `${base}/documents/archive`;
  const actions: DossierActions = {
    pending,
    error,
    archive: {
      plan: documentArchivePlan(data.checklist, data.documents),
      pending: files.pending === archivePath,
      download: async () => {
        setError(null);
        const problem = await files.download(
          archivePath,
          `${data.reference} - documenti.zip`,
          zipComplete,
        );
        if (problem) setFailure({ message: `Download non riuscito. ${problem}`, status: 0 });
      },
    },
    openDocument: setViewing,
    nearReady: (action, input) =>
      succeeded(
        mutate(`near:${action}`, () =>
          apiFetch(`${base}/near-ready/${action}`, {
            method: "POST",
            body: { ...input, expectedUpdatedAt: current().updatedAt },
          }),
        ),
      ),
    decidePrefill: (fieldId, decision) =>
      succeeded(
        mutate(`prefill:${fieldId}`, async () => {
          await startReview();
          return apiFetch(`${base}/ai/dsu-prefill/${encodeURIComponent(fieldId)}/${decision}`, {
            method: "POST",
          });
        }),
      ),
    review: (itemId, input) =>
      mutate(`review:${itemId}`, async () => {
        const expectedUpdatedAt = await startReview();
        return apiFetch(`${base}/checklist/${encodeURIComponent(itemId)}/review`, {
          method: "POST",
          body: { ...input, expectedUpdatedAt },
        });
      }),
    update: (input, key = "update") =>
      succeeded(
        mutate(key, async () => {
          const needsReview =
            input.status === "ready" || input.status === "needs_citizen" || input.assigneeId;
          const expectedUpdatedAt = needsReview ? await startReview() : current().updatedAt;
          return apiFetch(base, { method: "PATCH", body: { ...input, expectedUpdatedAt } });
        }),
      ),
  };

  const openRequest = async () => {
    if (data.status === "submitted") {
      const ok = await mutate("update", startReview);
      if (!ok) return;
    }
    setRequesting(true);
  };

  // The reply opens on an AI draft grounded in official sources; the operator edits and sends.
  const openReply = async (question: ChatMessage) => {
    setPending(`reply:${question.id}`);
    setError(null);
    try {
      await startReview();
      const draft = await apiFetch<ReplyDraftResponse>(`${base}/ai/reply-draft`, {
        method: "POST",
        body: { messageId: question.id },
      });
      await refresh();
      setReply({ question, draft });
      setRequesting(true);
    } catch (err) {
      setFailure(
        err instanceof ApiRequestError
          ? { message: err.message, status: err.status }
          : { message: "Bozza non disponibile. Riprova.", status: 0 },
      );
    } finally {
      setPending(null);
    }
  };

  const setStatus = (status: CaseStatus) => actions.update({ status });
  const canReady = data.status === "in_review" || data.status === "submitted";
  const markReady = async () => {
    if (openIssues > 0) return setConfirmReady(true);
    // The button goes once the case is ready: the keyboard moves on to the next step, once
    // «Chiudi e archivia» is on screen.
    if (await setStatus("ready")) focusClose.current = true;
  };
  const askClose = (opener: HTMLElement | null) => {
    closeReturn.current = opener;
    setConfirmClose(true);
  };
  const firstToCheck = firstDocumentToCheck(data);
  const shortcuts: Shortcuts = {
    v: firstToCheck ? () => actions.openDocument(firstToCheck) : undefined,
    i: data.status !== "closed" && data.status !== "intake" ? () => void openRequest() : undefined,
    p: canReady && !pending ? () => void markReady() : undefined,
    n: () => mayLeave() && void next.go(),
  };
  const exportAs = async (format: "pdf" | "json") => {
    setError(null);
    const problem = await files.download(
      `${base}/export?format=${format}`,
      `${data.reference}.${format}`,
    );
    if (problem) setFailure({ message: `Download non riuscito. ${problem}`, status: 0 });
  };

  // One filled button at a time: the step this case is waiting for. The others stay quiet.
  const requestPrimary =
    openIssues > 0 && (data.status === "submitted" || data.status === "in_review");
  const nextPrimary = data.status === "needs_citizen" || data.status === "closed";
  const flow: FlowAction[] = [
    ...(data.status !== "closed" && data.status !== "intake"
      ? [
          {
            id: "request" as const,
            label: "Chiedi integrazione",
            icon: Send,
            primary: requestPrimary,
            keys: ["I"],
          },
        ]
      : []),
    ...(canReady
      ? [
          {
            id: "ready" as const,
            label: "Segna come pronta",
            icon: Check,
            primary: !requestPrimary,
            keys: ["P"],
            loading: pending === "update" && !confirmReady,
          },
        ]
      : []),
    // Ready means «into the CAF's software»: closing is the step after, in reach.
    ...(data.status === "ready"
      ? [
          {
            id: "close" as const,
            label: "Chiudi e archivia",
            icon: Archive,
            primary: true,
          },
        ]
      : []),
  ];
  // On a phone the step waiting for this case is the wide button of the bottom bar; with no
  // step left (closed, waiting for the citizen) the way on is the next case.
  const mobileMain = flow.find((action) => action.primary) ?? null;
  // Gets the control that ran it: focus goes back there when a confirmation is cancelled.
  const runFlow = (id: FlowAction["id"], opener: HTMLElement | null) => {
    if (id === "request") void openRequest();
    else if (id === "ready") void markReady();
    else askClose(opener);
  };
  const canAsk = data.status !== "intake";
  const openChat = () => setChatOpen(true);
  const assignedName = data.assignee
    ? assignedToMe
      ? "Assegnata a te"
      : `Assegnata a ${data.assignee.name}`
    : "Non assegnata";

  const nextAction = (className?: string) => (
    <Tooltip label="Apri la pratica successiva della coda" keys={["N"]}>
      <Button
        ref={nextButton}
        size="sm"
        variant={nextPrimary ? "primary" : "ghost"}
        loading={next.pending}
        onClick={() => mayLeave() && void next.go()}
        aria-keyshortcuts="N"
        className={className}
      >
        {/* Icon only where the bar is tight: the actions stay on one row at 1024px. */}
        <span className="lg:max-xl:sr-only">Prossima pratica</span>
        <ArrowRight className="rtl-flip size-4" aria-hidden />
      </Button>
    </Tooltip>
  );

  const moreMenu = (trigger: React.ReactElement, phone: boolean) => (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side={phone ? "top" : "bottom"}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) animate-pop overflow-y-auto rounded-md bg-surface p-1 shadow-float ring-1 ring-line data-[state=closed]:animate-sink"
        >
          {/* On a phone the bottom bar holds one action: the rest of the case's steps and the
              question to the dossier come first here. */}
          {phone && (
            <>
              {flow
                .filter((action) => action !== mobileMain)
                .map((action) => (
                  <MenuItem key={action.id} onSelect={() => runFlow(action.id, moreTrigger)}>
                    <action.icon className="me-2.5 size-4 text-ink-3" aria-hidden />
                    {action.label}
                  </MenuItem>
                ))}
              {canAsk && (
                <MenuItem onSelect={openChat}>
                  <Sparkles className="me-2.5 size-4 text-stamp" aria-hidden />
                  Chiedi al fascicolo
                </MenuItem>
              )}
              {(canAsk || flow.some((action) => action !== mobileMain)) && (
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
              )}
            </>
          )}
          <MenuItem onSelect={() => void exportAs("pdf")}>
            <Download className="me-2.5 size-4 text-ink-3" aria-hidden />
            Scarica fascicolo PDF
          </MenuItem>
          <MenuItem onSelect={() => void exportAs("json")}>
            <FileJson className="me-2.5 size-4 text-ink-3" aria-hidden />
            Scarica dati JSON
          </MenuItem>
          {actions.archive.plan.entries.length > 0 && (
            <MenuItem onSelect={() => void actions.archive.download()}>
              <FileArchive className="me-2.5 size-4 text-ink-3" aria-hidden />
              Scarica tutti i documenti (ZIP)
            </MenuItem>
          )}
          {data.practice && data.status !== "closed" && (
            <MenuItem onSelect={() => window.open(printPath(data.id), "_blank", "noopener")}>
              <Printer className="me-2.5 size-4 text-ink-3" aria-hidden />
              Stampa i documenti da portare
            </MenuItem>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {data.status === "closed" ? (
            <MenuItem onSelect={() => void setStatus("in_review")}>Riapri la pratica</MenuItem>
          ) : (
            <>
              {data.status === "ready" && (
                <MenuItem onSelect={() => void setStatus("in_review")}>Torna in revisione</MenuItem>
              )}
              <MenuItem onSelect={() => setNewLink(true)}>Nuovo link per il cittadino…</MenuItem>
              <MenuItem onSelect={() => askClose(moreTrigger)}>Chiudi e archivia…</MenuItem>
            </>
          )}
          <MenuItem onSelect={() => setReuse(true)}>Nuova pratica per questa famiglia…</MenuItem>
          {data.practice?.id === "isee_ordinario" && (
            <MenuItem
              onSelect={() => {
                setWithdrawError(null);
                setWithdraw("ask");
              }}
            >
              Revoca l&apos;avviso di rinnovo…
            </MenuItem>
          )}
          {assignedToMe && (
            <MenuItem onSelect={() => void actions.update({ assigneeId: null })}>
              Lascia la pratica
            </MenuItem>
          )}
          {operator.role === "admin" && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <MenuItem onSelect={() => setConfirmDelete(true)}>
                <span className="text-danger">Elimina definitivamente…</span>
              </MenuItem>
              <MenuItem onSelect={() => setEraseFamily(true)}>
                <span className="text-danger">Cancella tutta la famiglia…</span>
              </MenuItem>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    // Names and file names come from citizens and can be one unbroken word in any script. On a
    // phone the bottom room is the action bar's, so the last section never sits under it.
    <PageContainer
      width="7xl"
      className="wrap-anywhere max-lg:pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pt-2"
    >
      {/* The case's actions stay in reach while the operator works far down the dossier: on a
          desktop this bar sticks to the top, and once the title has scrolled away it names the
          case (aria-hidden: the h1 already does). On a phone they live in a bar at the bottom,
          under the thumb, and only the way back and the next case stay at the top. */}
      <div
        ref={setBar}
        className={cn(
          "flex min-h-11 items-center gap-3 lg:sticky lg:top-0 lg:z-20 lg:-mx-10 lg:min-h-14 lg:border-b lg:bg-paper lg:px-10 lg:py-2.5",
          compact ? "lg:border-line" : "lg:border-transparent",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 lg:flex-none">
          <Link
            href={queueHref as Route}
            onClick={(event) => {
              if (!mayLeave()) event.preventDefault();
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm pe-2 text-sm text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="rtl-flip size-4" aria-hidden />
            Pratiche
          </Link>
          {/* The way on once this case is done: the next one of the same queue, no list in
              between. Quiet while there is still work here. */}
          {(desktop || mobileMain) && nextAction("max-lg:ms-auto")}
        </div>
        {compact && desktop && (
          <p
            aria-hidden
            className="hidden min-w-0 flex-1 animate-fade-in items-baseline gap-2 border-s border-line ps-4 xl:flex"
          >
            <span className="min-w-0 truncate font-semibold" title={citizenName ?? data.headline}>
              {citizenName ?? data.headline}
            </span>
            <span
              // Up to 1536px the actions leave room for the name only.
              className="hidden shrink-0 font-mono text-xs text-ink-3 2xl:inline"
              translate="no"
            >
              {data.reference}
            </span>
          </p>
        )}
        {desktop && (
          <div className="ms-auto flex shrink-0 items-center gap-1">
            {canAsk && (
              <>
                <Tooltip label="Chiedi al fascicolo" keys={["⌘", "J"]}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openChat}
                    aria-keyshortcuts="Meta+J Control+J"
                  >
                    <Sparkles className="size-4 text-stamp" aria-hidden />
                    Chiedi
                  </Button>
                </Tooltip>
                <span aria-hidden className="mx-1 h-5 w-px bg-line" />
              </>
            )}
            {/* Quiet steps first, the filled one last, next to «Altro». */}
            {[...flow.filter((a) => !a.primary), ...flow.filter((a) => a.primary)].map((action) => (
              <Tooltip key={action.id} label={action.label} keys={action.keys}>
                <Button
                  ref={
                    action.id === "ready"
                      ? readyButton
                      : action.id === "close"
                        ? closeButton
                        : undefined
                  }
                  size="sm"
                  variant={action.primary ? "primary" : "ghost"}
                  loading={action.loading}
                  onClick={(event) => runFlow(action.id, event.currentTarget)}
                  aria-keyshortcuts={action.keys?.join("+")}
                  className={cn(action.primary && "ms-1")}
                >
                  <action.icon className="size-4" aria-hidden />
                  {action.label}
                </Button>
              </Tooltip>
            ))}
            {moreMenu(
              <Button ref={setMore} variant="ghost" size="sm" className="ms-1">
                Altro
                <ChevronDown className="size-4" aria-hidden />
              </Button>,
              false,
            )}
          </div>
        )}
      </div>

      <header className="mt-3 min-w-0 lg:mt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={status.tone}>{status.label}</Pill>
          <span className="font-mono text-sm text-ink-3" translate="no">
            {data.reference}
          </span>
          {data.language !== "it" && (
            <Pill tone="neutral">Cittadino in {LANGUAGE_IT[data.language].toLowerCase()}</Pill>
          )}
        </div>
        {/* The person, not the practice, is the title: a January desk sees forty «ISEE
            ordinario» in a day, and the name is what tells them apart (as in the queue). */}
        <h1
          ref={setTitle}
          className="mt-2 font-display text-[1.75rem] leading-tight font-[650] tracking-[-0.012em] text-balance"
        >
          {citizenName ?? data.headline}
        </h1>
        {/* What and who in one line: taking the case sits by the person it is assigned to. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2">
          <span>{citizenName ? data.headline : "Cittadino senza nome"}</span>
          <span aria-hidden className="text-ink-3">
            ·
          </span>
          <span className={cn("text-body-sm", data.assignee ? "text-ink-2" : "text-ink-3")}>
            {assignedName}
          </span>
          {!assignedToMe && data.status !== "closed" && (
            <Button
              variant="ghost"
              size="sm"
              loading={pending === "update"}
              onClick={() => void actions.update({ assigneeId: operator.id })}
              className="-my-1 h-7 px-2 text-stamp not-disabled:hover:text-stamp"
            >
              <UserCheck className="size-3.5" aria-hidden />
              Assegna a me
            </Button>
          )}
        </p>
      </header>
      <ErasureRequestNotice
        dossier={data}
        isAdmin={operator.role === "admin"}
        onDelete={() => setConfirmDelete(true)}
        onEraseFamily={() => setEraseFamily(true)}
        onChanged={() => void dossier.reload()}
      />
      <div role="status">
        {next.message && (
          <Notice
            tone="neutral"
            role="none"
            className="console-arrive mt-4"
            onDismiss={next.dismiss}
            dismissLabel="Chiudi avviso"
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href={queueHref as Route}>Torna alle pratiche</Link>
              </Button>
            }
          >
            {next.message}
          </Notice>
        )}
      </div>
      {withdraw === "done" && (
        <Notice
          tone="ok"
          className="console-arrive mt-4"
          onDismiss={() => setWithdraw(null)}
          dismissLabel="Chiudi avviso"
        >
          Avviso di rinnovo revocato: il cittadino non riceverà l&apos;email per il rinnovo.
        </Notice>
      )}

      {/* Sticky: an action far down the dossier must not fail out of sight. A session that
          ended has its own notice from the console shell, with the way back to sign in. */}
      {error && failure?.status !== 401 && (
        <div
          className="sticky top-16 z-20 mt-4 lg:top-[calc(var(--dossier-bar)+1rem)]"
          style={{ "--dossier-bar": `${barHeight}px` } as CSSProperties}
        >
          <Notice
            tone="danger"
            size="md"
            className="console-arrive shadow-float"
            onDismiss={() => setFailure(null)}
            dismissLabel="Chiudi avviso"
          >
            {error}
          </Notice>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-8">
          <CitizenQuestions
            dossier={data}
            pending={pending}
            onReply={(question) => void openReply(question)}
          />
          {data.nearReady && <NearReadyPanel dossier={data} actions={actions} />}
          {data.status !== "intake" && <CopilotPanel dossier={data} actions={actions} />}
          <FindingsSummary dossier={data} onOpenDocument={actions.openDocument} />
          {data.facts.length > 0 && (
            <section aria-labelledby="facts-title">
              <h2 id="facts-title" className="sr-only">
                Riepilogo
              </h2>
              <dl className="grid gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line sm:grid-cols-2">
                {data.facts.map((fact) => (
                  <div key={fact.label} className="bg-surface px-4 py-3">
                    <dt className="text-sm text-ink-3">{fact.label}</dt>
                    <dd className="mt-0.5 font-semibold">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <ChecklistSection dossier={data} actions={actions} />
          <DsuSheetSection dossier={data} actions={actions} />
          <AnswersSection dossier={data} />
          <ConversationSection dossier={data} />
          <AssistantTurnsSection dossier={data} />
        </div>
        <DossierAside dossier={data} actions={actions} onNotify={() => setNotifying(true)} />
      </div>

      <DossierShortcuts keys={shortcuts} onAsk={canAsk ? openChat : undefined} />
      <DocumentViewer
        caseId={data.id}
        doc={viewing}
        dossier={data}
        onClose={() => setViewing(null)}
        onNavigate={setViewing}
        actions={actions}
      />
      <Dialog
        open={withdraw === "ask" || withdraw === "saving"}
        onOpenChange={(open) => {
          if (open || withdraw === "saving") return;
          setWithdraw(null);
          setWithdrawError(null);
        }}
        returnFocusTo={moreButton}
        title="Revocare l'avviso di rinnovo?"
        description="Usalo quando il cittadino chiede allo sportello di non ricevere più l'email per il rinnovo dell'ISEE. Vale per tutta la famiglia in questo CAF e cancella subito l'eventuale promemoria conservato."
      >
        {withdrawError && (
          <Notice tone="danger" className="mb-4">
            {withdrawError}
          </Notice>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={withdraw === "saving"}
            onClick={() => {
              setWithdraw(null);
              setWithdrawError(null);
            }}
          >
            Annulla
          </Button>
          <Button
            variant="danger"
            loading={withdraw === "saving"}
            onClick={async () => {
              setWithdraw("saving");
              setWithdrawError(null);
              try {
                await apiFetch(`${base}/renewal-consent`, {
                  method: "PUT",
                  body: { consented: false },
                });
                setWithdraw("done");
              } catch (err) {
                setWithdraw("ask");
                setWithdrawError(
                  err instanceof ApiRequestError ? err.message : "Revoca non riuscita. Riprova.",
                );
              }
            }}
          >
            Revoca l&apos;avviso
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        returnFocusTo={closeReturn}
        title="Chiudere e archiviare la pratica?"
        description="Il cittadino non potrà più caricare documenti da questo link. Potrai riaprirla dal menu Altro."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmClose(false)}>
            Annulla
          </Button>
          <Button
            variant="danger"
            loading={pending === "update"}
            onClick={async () => {
              if (!(await actions.update({ status: "closed" }))) return;
              closeReturn.current = nextButton.current;
              setConfirmClose(false);
            }}
          >
            Chiudi e archivia
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirmReady}
        onOpenChange={setConfirmReady}
        // Once ready, the ready button is gone and closing comes next.
        returnFocusTo={data.status === "ready" ? closeButton : readyButton}
        title="Segnare come pronta anche se manca qualcosa?"
        description={`${[
          missingCount > 0 &&
            (missingCount === 1
              ? "Manca 1 documento obbligatorio"
              : `Mancano ${missingCount} documenti obbligatori`),
          blockerCount > 0 &&
            (blockerCount === 1
              ? "c'è 1 problema bloccante"
              : `ci sono ${blockerCount} problemi bloccanti`),
        ]
          .filter(Boolean)
          .join(" e ")}. Se la segni come pronta, al cittadino non arriva nessuna richiesta.`}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmReady(false);
              void openRequest();
            }}
          >
            <Send className="size-4" aria-hidden />
            Chiedi integrazione
          </Button>
          <Button
            loading={pending === "update"}
            onClick={async () => {
              if (!(await actions.update({ status: "ready" }))) return;
              setConfirmReady(false);
            }}
          >
            Segna comunque come pronta
          </Button>
        </div>
      </Dialog>
      <ReuseDialog open={reuse} onOpenChange={setReuse} dossier={data} />
      <FamilyErasureDialog
        open={eraseFamily}
        onOpenChange={setEraseFamily}
        dossier={data}
        returnFocusTo={moreButton}
      />
      <NewLinkDialog
        open={newLink}
        onOpenChange={setNewLink}
        dossier={data}
        returnFocusTo={moreButton}
      />
      <DeleteCaseDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        dossier={data}
        returnFocusTo={moreButton}
      />
      {!desktop && (
        <ActionDock>
          {mobileMain ? (
            <Button
              ref={
                mobileMain.id === "ready"
                  ? readyButton
                  : mobileMain.id === "close"
                    ? closeButton
                    : undefined
              }
              size="lg"
              loading={mobileMain.loading}
              onClick={(event) => runFlow(mobileMain.id, event.currentTarget)}
              className="min-w-0 flex-1"
            >
              <mobileMain.icon className="size-5" aria-hidden />
              {mobileMain.label}
            </Button>
          ) : (
            nextAction("h-12 min-w-0 flex-1 rounded-md text-base")
          )}
          {moreMenu(
            <Button
              ref={setMore}
              variant="secondary"
              size="icon"
              aria-label="Altro"
              className="size-12 rounded-md"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </Button>,
            true,
          )}
        </ActionDock>
      )}
      {canAsk && (
        <DossierChat open={chatOpen} onOpenChange={setChatOpen} dossier={data} actions={actions} />
      )}
      <RequestDialog
        open={requesting}
        onOpenChange={(next) => {
          setRequesting(next);
          if (!next) setReply(null);
        }}
        dossier={data}
        reply={reply}
        onSent={(result) => {
          if (result) dossier.setData(result);
          else void dossier.reload();
          // Without an email nothing reaches the citizen: offer the message right away.
          if (!reply && !data.citizen.email) setNotifying(true);
        }}
        onConflict={() => void dossier.reload()}
      />
      <CitizenNoticeDialog
        open={notifying}
        onOpenChange={setNotifying}
        dossier={data}
        link={issuedLink}
        onLinkChange={setIssuedLink}
        onClosedAfterChanges={() => void dossier.reload()}
      />
    </PageContainer>
  );
}

type Shortcuts = Partial<Record<"v" | "i" | "p" | "n", () => void>>;

/** Single-key shortcuts for the steps every case goes through (listed under «?»). */
function DossierShortcuts({ keys, onAsk }: { keys: Shortcuts; onAsk?: () => void }) {
  // Rebound every render: the handlers carry this render's dossier.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // ⌘J / Ctrl+J asks the dossier, also from a field: it is a chord, not a letter typed.
      if (
        onAsk &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "j"
      ) {
        if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
        event.preventDefault();
        onAsk();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTyping(event.target)) return;
      // The document viewer, menus and dialogs have keys of their own.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const run = keys[event.key.toLowerCase() as keyof Shortcuts];
      if (!run) return;
      event.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return null;
}

type FlowAction = {
  id: "request" | "ready" | "close";
  label: string;
  icon: typeof Send;
  primary: boolean;
  keys?: string[];
  loading?: boolean;
};

/**
 * The phone's action bar: fixed under the thumb, above the safe area. While it is on screen the
 * page scrolls focused fields clear of it (scroll-padding), so the keyboard never lands behind.
 */
function ActionDock({ children }: { children: React.ReactNode }) {
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!dock) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry?.borderBoxSize[0]?.blockSize ?? 0);
      root.style.scrollPaddingBottom = `${height + 16}px`;
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingBottom = "";
    };
  }, [dock]);
  return (
    <div
      ref={setDock}
      role="toolbar"
      aria-label="Azioni sulla pratica"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-dock"
    >
      {children}
    </div>
  );
}

function MenuItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex h-10 cursor-pointer items-center rounded-sm px-3 text-body-sm outline-none data-[highlighted]:bg-sunk"
    >
      {children}
    </DropdownMenu.Item>
  );
}

/**
 * The dossier's shape while it loads: header, main column and side cards stay where they will
 * be, so nothing jumps when the data lands. «← Pratiche» already works.
 */
function DossierSkeleton({ queueHref }: { queueHref: string }) {
  return (
    <PageContainer width="7xl" className="lg:pt-2">
      <div className="flex min-h-11 items-center lg:min-h-14 lg:py-2.5">
        <Link
          href={queueHref as Route}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="rtl-flip size-4" aria-hidden />
          Pratiche
        </Link>
      </div>
      <div role="status" className="mt-3 lg:mt-2">
        <span className="sr-only">Caricamento del fascicolo</span>
        <Skeleton className="h-5 w-48 rounded-full" />
        <Skeleton className="mt-3 h-9 w-full max-w-sm" />
        <Skeleton className="mt-2.5 h-6 w-48" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid content-start gap-8">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
          <div className="hidden content-start gap-5 lg:grid">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-36 rounded-lg" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
