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
import { useEffect, useRef, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CASE_STATUS, LANGUAGE_IT, PRACTICE_SHORT } from "@/lib/console/labels";
import { rememberCase } from "@/lib/console/recent-cases";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
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
  review: (itemId: string, input: ReviewChecklistItemRequest) => Promise<boolean>;
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
};

export function DossierView({ caseId }: { caseId: string }) {
  const operator = useOperator();
  const dossier = useResource<CaseDossier>(`/api/cases/${encodeURIComponent(caseId)}`);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  async function mutate(key: string, run: () => Promise<CaseDossier | unknown>) {
    setPending(key);
    setError(null);
    try {
      const result = await run();
      if (result && typeof result === "object" && "checklist" in result)
        dossier.setData(result as CaseDossier);
      else await dossier.reload();
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "conflict") {
        // Someone else (a colleague, the citizen, a finished analysis) changed the case since it
        // was read: show the current state and let the operator decide again. Never retry blindly.
        await dossier.reload();
        setError(CONFLICT_MESSAGE);
        return false;
      }
      setError(err instanceof ApiRequestError ? err.message : "Operazione non riuscita. Riprova.");
      return false;
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
      name: [loaded.citizen.firstName, loaded.citizen.lastName].filter(Boolean).join(" ") || null,
      practice: loaded.practice ? PRACTICE_SHORT[loaded.practice.id] : null,
    });
  }, [loaded, operator.id]);

  // Uploads are analysed in the background: refresh until every document has its result.
  const analysing = dossier.data?.documents.some((doc) => doc.status === "processing") ?? false;
  const { reload } = dossier;
  useEffect(() => {
    if (!analysing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 3000);
    return () => window.clearInterval(id);
  }, [analysing, reload]);

  if (dossier.status === "loading") {
    return (
      <div className="grid min-h-[60dvh] place-items-center text-ink-3">
        <Spinner label="Caricamento del fascicolo" className="size-6" />
      </div>
    );
  }
  if (dossier.status === "error" && !dossier.data) {
    const missing = dossier.error.status === 404;
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
                <Link href="/console">Torna alle pratiche</Link>
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
  const startReview = async () => {
    if (data.status !== "submitted") return data.updatedAt;
    const started = await apiFetch<CaseDossier>(base, {
      method: "PATCH",
      body: { status: "in_review", expectedUpdatedAt: data.updatedAt },
    });
    return started.updatedAt;
  };

  const actions: DossierActions = {
    pending,
    openDocument: setViewing,
    nearReady: (action, input) =>
      mutate(`near:${action}`, () =>
        apiFetch(`${base}/near-ready/${action}`, {
          method: "POST",
          body: { ...input, expectedUpdatedAt: data.updatedAt },
        }),
      ),
    decidePrefill: (fieldId, decision) =>
      mutate(`prefill:${fieldId}`, async () => {
        await startReview();
        return apiFetch(`${base}/ai/dsu-prefill/${encodeURIComponent(fieldId)}/${decision}`, {
          method: "POST",
        });
      }),
    review: (itemId, input) =>
      mutate(`review:${itemId}`, async () => {
        const expectedUpdatedAt = await startReview();
        return apiFetch(`${base}/checklist/${encodeURIComponent(itemId)}/review`, {
          method: "POST",
          body: { ...input, expectedUpdatedAt },
        });
      }),
    update: (input, key = "update") =>
      mutate(key, async () => {
        const needsReview =
          input.status === "ready" || input.status === "needs_citizen" || input.assigneeId;
        const expectedUpdatedAt = needsReview ? await startReview() : data.updatedAt;
        return apiFetch(base, { method: "PATCH", body: { ...input, expectedUpdatedAt } });
      }),
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
      if (data.status === "submitted") await startReview();
      const draft = await apiFetch<ReplyDraftResponse>(`${base}/ai/reply-draft`, {
        method: "POST",
        body: { messageId: question.id },
      });
      await dossier.reload();
      setReply({ question, draft });
      setRequesting(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Bozza non disponibile. Riprova.");
    } finally {
      setPending(null);
    }
  };

  const setStatus = (next: CaseStatus) => actions.update({ status: next });

  return (
    // Bottom room for the floating «Chiedi al fascicolo», so it never hides the last row.
    <PageContainer width="7xl" className="pb-24 lg:pb-24">
      <Link
        href="/console"
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="rtl-flip size-4" aria-hidden />
        Pratiche
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={status.tone}>{status.label}</Pill>
            <span className="font-mono text-sm text-ink-3">{data.reference}</span>
            {data.language !== "it" && (
              <Pill tone="neutral">Cittadino in {LANGUAGE_IT[data.language].toLowerCase()}</Pill>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight font-bold tracking-[-0.025em]">
            {data.headline}
          </h1>
          <p className="mt-1 text-lg text-ink-2">
            {[data.citizen.firstName, data.citizen.lastName].filter(Boolean).join(" ") ||
              "Cittadino senza nome"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!assignedToMe && data.status !== "closed" && (
            <Button
              variant="secondary"
              loading={pending === "update"}
              onClick={() => void actions.update({ assigneeId: operator.id })}
            >
              <UserCheck className="size-4" aria-hidden />
              Prendi in carico
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
                <MenuLink href={`${base}/export?format=pdf`} icon={Download}>
                  Scarica fascicolo PDF
                </MenuLink>
                <MenuLink href={`${base}/export?format=json`} icon={FileJson}>
                  Scarica dati JSON
                </MenuLink>
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
      </header>
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

      {error && (
        <Notice tone="danger" size="md" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
        <div className="grid min-w-0 content-start gap-8">
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

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Download;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <a
        href={href}
        download
        className="flex h-10 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-body-sm outline-none data-[highlighted]:bg-sunk"
      >
        <Icon className="size-4 text-ink-3" aria-hidden />
        {children}
      </a>
    </DropdownMenu.Item>
  );
}
