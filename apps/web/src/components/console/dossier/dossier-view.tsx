"use client";

import {
  ArrowLeft,
  Check,
  FileQuestion,
  ChevronDown,
  Download,
  FileJson,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Route } from "next";
import type {
  CaseDossier,
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
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CASE_STATUS, fullName, LANGUAGE_IT, PRACTICE_SHORT } from "@/lib/console/labels";
import { forgetCase, rememberCase, useQueueHref } from "@/lib/console/recent-cases";
import { useOperator } from "@/lib/console/operator-context";
import { useDownload } from "@/lib/console/use-download";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";
import { ChecklistSection } from "./checklist-section";
import { DeleteCaseDialog } from "./delete-case-dialog";
import { CopilotPanel } from "./copilot-panel";
import { NearReadyPanel } from "./near-ready-panel";
import { DossierChat } from "./dossier-chat";
import { DocumentViewer } from "./document-viewer";
import { DossierAside } from "./dossier-aside";
import { DsuSheetSection } from "./dsu-sheet-section";
import { FamilyErasureDialog } from "./family-erasure-dialog";
import { NewLinkDialog } from "./new-link-dialog";
import { ReuseDialog } from "./reuse-dialog";
import { FindingsSummary } from "./findings-summary";
import { RequestDialog, type ReplyContext } from "./request-dialog";
import { CitizenQuestions } from "./citizen-questions";
import { AnswersSection, AssistantTurnsSection, ConversationSection } from "./secondary-sections";

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
  const [reuse, setReuse] = useState(false);
  const [eraseFamily, setEraseFamily] = useState(false);
  const readyButton = useRef<HTMLButtonElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
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

  const actions: DossierActions = {
    pending,
    error,
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

  const setStatus = (next: CaseStatus) => actions.update({ status: next });
  const exportAs = async (format: "pdf" | "json") => {
    setError(null);
    const problem = await files.download(
      `${base}/export?format=${format}`,
      `${data.reference}.${format}`,
    );
    if (problem) setFailure({ message: `Download non riuscito. ${problem}`, status: 0 });
  };

  return (
    // Bottom room for the floating «Chiedi al fascicolo», so it never hides the last row.
    // Names and file names come from citizens and can be one unbroken word in any script.
    <PageContainer width="7xl" className="pb-24 wrap-anywhere lg:pt-2 lg:pb-24">
      {/* The case's actions stay in reach while the operator works far down the dossier: on a
          desktop this bar sticks to the top, and once the title has scrolled away it names the
          case (aria-hidden: the h1 already does). On a phone the actions follow the title.
          `contents` keeps the bar's sticky range the whole page, not this wrapper. */}
      <div className="flex flex-col items-start lg:contents">
        <div
          ref={setBar}
          className={cn(
            "max-lg:contents lg:sticky lg:top-0 lg:z-20 lg:-mx-10 lg:flex lg:min-h-16 lg:items-center lg:gap-4 lg:border-b lg:bg-paper lg:px-10 lg:py-3",
            compact ? "lg:border-line" : "lg:border-transparent",
          )}
        >
          <Link
            href={queueHref as Route}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-sm text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="rtl-flip size-4" aria-hidden />
            Pratiche
          </Link>
          {compact && (
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
          <div className="mt-4 flex flex-wrap items-center gap-2 max-lg:order-2 lg:ms-auto lg:mt-0">
            {!assignedToMe && data.status !== "closed" && (
              <Button
                variant="secondary"
                loading={pending === "update"}
                onClick={() => void actions.update({ assigneeId: operator.id })}
                // Between 1024 and 1280px the bar has room for one row only if this one is an icon.
                title="Prendi in carico"
                className="lg:max-xl:px-3"
              >
                <UserCheck className="size-4" aria-hidden />
                <span className="lg:max-xl:sr-only">Prendi in carico</span>
              </Button>
            )}
            {data.status !== "closed" && data.status !== "intake" && (
              <Button
                variant={openIssues > 0 ? "primary" : "secondary"}
                onClick={() => void openRequest()}
              >
                <Send className="size-4" aria-hidden />
                Chiedi integrazione
              </Button>
            )}
            {(data.status === "in_review" || data.status === "submitted") && (
              <Button
                ref={readyButton}
                variant={openIssues > 0 ? "secondary" : "primary"}
                loading={pending === "update" && !confirmReady}
                onClick={() => (openIssues > 0 ? setConfirmReady(true) : void setStatus("ready"))}
              >
                <Check className="size-4" aria-hidden />
                Segna come pronta
              </Button>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button ref={moreButton} variant="secondary">
                  Altro
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) animate-pop rounded-md bg-surface p-1 shadow-float ring-1 ring-line data-[state=closed]:animate-sink"
                >
                  <MenuItem onSelect={() => void exportAs("pdf")}>
                    <Download className="me-2.5 size-4 text-ink-3" aria-hidden />
                    Scarica fascicolo PDF
                  </MenuItem>
                  <MenuItem onSelect={() => void exportAs("json")}>
                    <FileJson className="me-2.5 size-4 text-ink-3" aria-hidden />
                    Scarica dati JSON
                  </MenuItem>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  {data.status === "closed" ? (
                    <MenuItem onSelect={() => void setStatus("in_review")}>
                      Riapri la pratica
                    </MenuItem>
                  ) : (
                    <>
                      {data.status === "ready" && (
                        <MenuItem onSelect={() => void setStatus("in_review")}>
                          Torna in revisione
                        </MenuItem>
                      )}
                      <MenuItem onSelect={() => setNewLink(true)}>
                        Nuovo link per il cittadino…
                      </MenuItem>
                      <MenuItem onSelect={() => setConfirmClose(true)}>Chiudi e archivia…</MenuItem>
                    </>
                  )}
                  <MenuItem onSelect={() => setReuse(true)}>
                    Nuova pratica per questa famiglia…
                  </MenuItem>
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
          </div>
        </div>

        <header className="mt-3 min-w-0 max-lg:order-1 lg:mt-2">
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
            className="mt-2 font-display text-3xl leading-tight font-bold tracking-[-0.025em]"
          >
            {citizenName ?? data.headline}
          </h1>
          <p className="mt-1 text-lg text-ink-2">
            {citizenName ? data.headline : "Cittadino senza nome"}
          </p>
        </header>
      </div>
      {withdraw === "done" && (
        <Notice
          tone="ok"
          className="mt-4"
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
            className="shadow-float"
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
          {data.status !== "intake" && (
            <CopilotPanel dossier={data} actions={actions} onAsk={() => setChatOpen(true)} />
          )}
          <FindingsSummary dossier={data} />
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
        <DossierAside dossier={data} actions={actions} />
      </div>

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
        returnFocusTo={moreButton}
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
              if (await actions.update({ status: "closed" })) setConfirmClose(false);
            }}
          >
            Chiudi e archivia
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirmReady}
        onOpenChange={setConfirmReady}
        returnFocusTo={readyButton}
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
              if (await actions.update({ status: "ready" })) setConfirmReady(false);
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
      {data.status !== "intake" && (
        <>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="fixed end-5 bottom-5 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-contrast px-5 font-semibold text-on-contrast shadow-float transition-transform duration-150 ease-(--ease-out) hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-stamp focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0 active:scale-[0.97]"
          >
            <Sparkles className="size-4.5" aria-hidden />
            Chiedi al fascicolo
          </button>
          <DossierChat
            open={chatOpen}
            onOpenChange={setChatOpen}
            dossier={data}
            actions={actions}
          />
        </>
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
        }}
        onConflict={() => void dossier.reload()}
      />
    </PageContainer>
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
      <div className="lg:flex lg:min-h-16 lg:items-center">
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
        {/* On a phone the actions sit under the title (in the bar from lg). */}
        <Skeleton className="mt-4 h-10 w-full max-w-md lg:hidden" />
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
