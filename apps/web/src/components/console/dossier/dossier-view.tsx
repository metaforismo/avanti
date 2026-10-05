"use client";

import { ArrowLeft, Check, ChevronDown, Download, FileJson, Send, UserCheck } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";
import type {
  CaseDossier,
  CaseStatus,
  DocumentSummary,
  ReviewChecklistItemRequest,
  UpdateCaseRequest,
} from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CASE_STATUS, LANGUAGE_IT } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { ChecklistSection } from "./checklist-section";
import { DocumentViewer } from "./document-viewer";
import { DossierAside } from "./dossier-aside";
import { FindingsSummary } from "./findings-summary";
import { RequestDialog } from "./request-dialog";
import { AnswersSection, ConversationSection } from "./secondary-sections";

export type DossierActions = {
  review: (itemId: string, input: ReviewChecklistItemRequest) => Promise<boolean>;
  /** `key` separates background saves (notes) from button spinners. */
  update: (input: UpdateCaseRequest, key?: string) => Promise<boolean>;
  openDocument: (doc: DocumentSummary) => void;
  pending: string | null;
};

export function DossierView({ caseId }: { caseId: string }) {
  const operator = useOperator();
  const dossier = useResource<CaseDossier>(`/api/cases/${encodeURIComponent(caseId)}`);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
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
      setError(err instanceof ApiRequestError ? err.message : "Operazione non riuscita. Riprova.");
      return false;
    } finally {
      setPending(null);
    }
  }

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
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="font-display text-2xl font-semibold">
          {missing ? "Pratica non trovata" : "Fascicolo non disponibile"}
        </p>
        <p className="mt-2 text-ink-2">
          {missing
            ? "Potrebbe essere stata eliminata o appartenere a un altro CAF."
            : dossier.error.message}
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/console">Torna alle pratiche</Link>
        </Button>
      </div>
    );
  }

  const data = dossier.data!;
  const viewing = viewingId ? (data.documents.find((doc) => doc.id === viewingId) ?? null) : null;
  const status = CASE_STATUS[data.status];
  const base = `/api/cases/${encodeURIComponent(data.id)}`;
  const assignedToMe = data.assignee?.id === operator.id;

  // Opening a case is read-only. Review starts with the first real action, so the measured
  // review time counts work, not glances at the queue.
  const ensureInReview = async () => {
    if (data.status === "submitted") {
      await apiFetch(base, { method: "PATCH", body: { status: "in_review" } });
    }
  };

  const actions: DossierActions = {
    pending,
    openDocument: setViewing,
    review: (itemId, input) =>
      mutate(`review:${itemId}`, async () => {
        await ensureInReview();
        return apiFetch(`${base}/checklist/${encodeURIComponent(itemId)}/review`, {
          method: "POST",
          body: input,
        });
      }),
    update: (input, key = "update") =>
      mutate(key, async () => {
        const needsReview =
          input.status === "ready" || input.status === "needs_citizen" || input.assigneeId;
        if (needsReview) await ensureInReview();
        return apiFetch(base, { method: "PATCH", body: input });
      }),
  };

  const openRequest = async () => {
    if (data.status === "submitted") {
      const ok = await mutate("update", () =>
        apiFetch(base, { method: "PATCH", body: { status: "in_review" } }),
      );
      if (!ok) return;
    }
    setRequesting(true);
  };

  const setStatus = (next: CaseStatus) => actions.update({ status: next });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
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
            <Button variant="secondary" onClick={() => void openRequest()}>
              <Send className="size-4" aria-hidden />
              Chiedi integrazione
            </Button>
          )}
          {(data.status === "in_review" || data.status === "submitted") && (
            <Button loading={pending === "update"} onClick={() => void setStatus("ready")}>
              <Check className="size-4" aria-hidden />
              Segna come pronta
            </Button>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="secondary">
                Altro
                <ChevronDown className="size-4" aria-hidden />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-56 animate-pop rounded-md bg-surface p-1 shadow-float ring-1 ring-line"
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
                    <MenuItem onSelect={() => setConfirmClose(true)}>Chiudi e archivia…</MenuItem>
                  </>
                )}
                {assignedToMe && (
                  <MenuItem onSelect={() => void actions.update({ assigneeId: null })}>
                    Lascia la pratica
                  </MenuItem>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger-wash px-4 py-3 text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-8">
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
          <AnswersSection dossier={data} />
          <ConversationSection dossier={data} />
        </div>
        <DossierAside dossier={data} actions={actions} />
      </div>

      <DocumentViewer
        caseId={data.id}
        doc={viewing}
        dossier={data}
        onClose={() => setViewing(null)}
        onNavigate={setViewing}
      />
      <Dialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
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
      <RequestDialog
        open={requesting}
        onOpenChange={setRequesting}
        dossier={data}
        onSent={(result) => {
          if (result) dossier.setData(result);
          else void dossier.reload();
        }}
      />
    </div>
  );
}

function MenuItem({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex h-10 cursor-pointer items-center rounded-sm px-3 text-[0.9375rem] outline-none data-[highlighted]:bg-sunk"
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
        className="flex h-10 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-[0.9375rem] outline-none data-[highlighted]:bg-sunk"
      >
        <Icon className="size-4 text-ink-3" aria-hidden />
        {children}
      </a>
    </DropdownMenu.Item>
  );
}
