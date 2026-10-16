"use client";

import { ArrowUpRight, Link2, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Route } from "next";
import type {
  CreateRenewalsResponse,
  RenewalItem,
  RenewalsResponse,
  RenewalStatus,
} from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { formatDateTime, type Tone } from "@/lib/console/labels";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";

const STATUSES: { key: RenewalStatus; label: string; hint: string }[] = [
  { key: "not_invited", label: "Da invitare", hint: "Nessun rinnovo ancora preparato" },
  { key: "invited", label: "Invitati", hint: "Hanno il link, devono confermare il nucleo" },
  { key: "started", label: "Iniziati", hint: "Hanno confermato il nucleo e stanno rispondendo" },
  { key: "submitted", label: "Inviati", hint: "Il rinnovo è arrivato allo sportello" },
];

const INVITATION: Record<
  CreateRenewalsResponse["items"][number]["invitation"],
  { label: string; tone: Tone }
> = {
  queued: { label: "Email in partenza", tone: "ok" },
  disabled: { label: "Inviti email spenti", tone: "muted" },
  no_email: { label: "Senza email", tone: "warn" },
  no_consent: { label: "Senza consenso all'email", tone: "warn" },
  rate_limited: { label: "Email già inviata di recente", tone: "muted" },
  existing: { label: "Già preparato", tone: "muted" },
};

/** The API takes at most 50 sources per request. */
const BATCH = 50;

/**
 * From October the CAF prepares the next year's campaign (ISEE expires on 31 December, see
 * docs/research/isee-renewals.md); before that, the current year.
 */
function campaignYear(now = new Date()) {
  const parts = new Intl.DateTimeFormat("it-IT", {
    year: "numeric",
    month: "numeric",
    timeZone: "Europe/Rome",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return month >= 10 ? year + 1 : year;
}

const countAll = (counts: RenewalsResponse["counts"]) =>
  counts.not_invited + counts.invited + counts.started + counts.submitted;

const people = (n: number) => (n === 1 ? "1 persona" : `${n} persone`);

export default function RenewalsPage() {
  const suggested = useMemo(() => campaignYear(), []);
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const [status, setStatus] = useState<RenewalStatus>("not_invited");
  const [more, setMore] = useState<{ items: RenewalItem[]; next: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    response: CreateRenewalsResponse;
    names: Map<string, string | null>;
  } | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [withdrawing, setWithdrawing] = useState<RenewalItem | null>(null);
  const [withdrawPending, setWithdrawPending] = useState(false);

  async function withdraw(item: RenewalItem) {
    setWithdrawPending(true);
    setError(null);
    try {
      await apiFetch(`/api/renewals/${encodeURIComponent(item.sourceCaseId)}/renewal-consent`, {
        method: "PUT",
        body: { consented: false },
      });
      setMore(null);
      void list.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Revoca non riuscita. Riprova.");
    } finally {
      setWithdrawPending(false);
      setWithdrawing(null);
    }
  }

  // The first year with something to renew is the useful one: in the pilot's first autumn
  // the CAF has no files from last year yet, only from this one.
  const probe = useResource<RenewalsResponse>(
    chosenYear === null ? `/api/renewals?year=${suggested}&status=all&limit=1` : null,
  );
  const probeTotal = probe.data ? countAll(probe.data.counts) : null;
  const year =
    chosenYear ?? (probeTotal === null ? null : probeTotal === 0 ? suggested + 1 : suggested);
  const shownYear = year ?? suggested;

  const list = useResource<RenewalsResponse>(
    year === null ? null : `/api/renewals?year=${year}&status=${status}&limit=${BATCH}`,
  );
  const data = list.data?.year === year ? list.data : null;
  const total = data ? countAll(data.counts) : null;

  function reset() {
    setMore(null);
    setSelected(new Set());
  }

  const items = [...(data?.items ?? []), ...(more?.items ?? [])];
  const next = more ? more.next : (data?.nextAfter ?? null);
  const selectable = status === "not_invited" || status === "invited";
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.sourceCaseId));

  async function loadMore() {
    if (!next || loadingMore || year === null) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<RenewalsResponse>(
        `/api/renewals?year=${year}&status=${status}&limit=${BATCH}&after=${encodeURIComponent(next)}`,
      );
      setMore((current) => ({
        items: [...(current?.items ?? []), ...page.items],
        next: page.nextAfter,
      }));
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Non è stato possibile caricare altri.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function prepare(regenerateLinks: boolean) {
    const ids = [...selected].slice(0, BATCH);
    if (ids.length === 0 || pending || year === null) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch<CreateRenewalsResponse>("/api/renewals", {
        method: "POST",
        body: { sourceCaseIds: ids, year, regenerateLinks },
      });
      const names = new Map(items.map((item) => [item.sourceCaseId, item.citizenName]));
      setResult({ response, names });
      setSelected(new Set());
      setMore(null);
      void list.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Rinnovi non preparati. Riprova.");
    } finally {
      setPending(false);
      setConfirmRegenerate(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(id)) nextSet.delete(id);
      else if (nextSet.size < BATCH) nextSet.add(id);
      return nextSet;
    });
  }

  return (
    <PageContainer width="6xl" className="pb-28 lg:pb-28">
      <PageHeader
        title="Rinnovi ISEE"
        lead={`Le famiglie che hanno fatto l'ISEE ${shownYear - 1} con voi. Il rinnovo ${shownYear} riparte da nucleo e documenti già raccolti: il cittadino conferma chi vive con lui e risponde solo alle domande del nuovo anno.`}
        actions={
          <Select
            value={String(shownYear)}
            aria-label="Anno del rinnovo"
            compact
            onChange={(e) => {
              setChosenYear(Number(e.target.value));
              reset();
            }}
          >
            {[suggested - 1, suggested, suggested + 1].map((y) => (
              <option key={y} value={y}>
                Rinnovo {y} (ISEE {y - 1})
              </option>
            ))}
          </Select>
        }
      />

      <div role="group" aria-label="Stato" className="-mx-1 mt-6 flex gap-1 overflow-x-auto pb-1">
        {STATUSES.map(({ key, label, hint }) => {
          const active = key === status;
          const count = data?.counts[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              title={hint}
              onClick={() => {
                setStatus(key);
                reset();
              }}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm transition-colors",
                active
                  ? "bg-contrast font-semibold text-on-contrast"
                  : "text-ink-2 hover:bg-sunk hover:text-ink",
              )}
            >
              {label}
              {count !== undefined && (
                <span
                  className={cn(
                    "tabular min-w-5 rounded-full px-1.5 text-center text-xs",
                    active ? "bg-on-contrast/20" : "bg-sunk",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <Notice tone="danger" className="mt-4" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}

      <p role="status" className="sr-only">
        {data ? `${items.length} famiglie: ${STATUSES.find((s) => s.key === status)?.label}` : ""}
      </p>
      <section aria-busy={list.status === "loading" || list.refreshing} className="mt-5">
        {list.status === "error" && !list.data ? (
          <Notice
            tone="danger"
            size="page"
            title="Impossibile caricare i rinnovi."
            action={
              <Button variant="secondary" onClick={() => void list.reload()}>
                Riprova
              </Button>
            }
          >
            {list.error.message}
          </Notice>
        ) : !data ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          total === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title={`Nessuna pratica ISEE ${shownYear - 1} da rinnovare`}
            >
              Qui compaiono le pratiche ISEE ordinario dell&apos;anno prima arrivate allo sportello
              e ancora conservate. Ogni rinnovo riparte dal loro nucleo e dai documenti ancora
              validi.
            </EmptyState>
          ) : (
            <EmptyState title="Nessuna famiglia in questo stato">
              {status === "not_invited"
                ? "Avete già preparato il rinnovo per tutte le famiglie dell'anno scorso."
                : "Le famiglie compaiono qui man mano che avanzano."}
            </EmptyState>
          )
        ) : (
          <>
            <div className="hidden grid-cols-[2rem_minmax(0,1.6fr)_7rem_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4 px-4 pb-2 text-xs text-ink-3 md:grid">
              {selectable ? (
                <input
                  type="checkbox"
                  aria-label="Seleziona tutte le famiglie mostrate"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected
                        ? new Set()
                        : new Set(items.slice(0, BATCH).map((item) => item.sourceCaseId)),
                    )
                  }
                  className="size-4.5 accent-stamp"
                />
              ) : (
                <span />
              )}
              <span>Famiglia</span>
              <span>Nucleo</span>
              <span>Documenti dell&apos;anno scorso</span>
              <span>Rinnovo</span>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              {items.map((item) => (
                <RenewalRow
                  key={item.sourceCaseId}
                  item={item}
                  selectable={selectable}
                  checked={selected.has(item.sourceCaseId)}
                  onToggle={() => toggle(item.sourceCaseId)}
                  onWithdraw={() => setWithdrawing(item)}
                />
              ))}
            </ul>
            {next && (
              <div className="mt-4 grid justify-items-center">
                <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                  Mostra altre famiglie
                </Button>
              </div>
            )}
            <p className="mt-4 text-sm text-ink-3">
              I documenti «validi» vanno bene anche per il nuovo anno secondo i controlli
              automatici; quelli «da aggiornare» sono scaduti o dell&apos;anno sbagliato. La
              verifica resta all&apos;operatore.
            </p>
          </>
        )}
      </section>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:start-60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="text-sm">
              <span className="tabular font-semibold">{selected.size}</span>{" "}
              {selected.size === 1 ? "famiglia selezionata" : "famiglie selezionate"}
              {selected.size >= BATCH && (
                <span className="text-ink-3"> (al massimo {BATCH} per volta)</span>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                Annulla
              </Button>
              {status === "not_invited" ? (
                <Button loading={pending} onClick={() => void prepare(false)}>
                  <RefreshCw className="size-4" aria-hidden />
                  {selected.size === 1 ? "Prepara il rinnovo" : `Prepara ${selected.size} rinnovi`}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setConfirmRegenerate(true)}>
                  <Link2 className="size-4" aria-hidden />
                  {selected.size === 1 ? "Nuovo link" : `Nuovi link per ${selected.size}`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={confirmRegenerate}
        onOpenChange={setConfirmRegenerate}
        title="Generare nuovi link?"
        description="I link inviati prima smettono di funzionare subito. Serve quando un cittadino ha perso il suo o non l'ha mai ricevuto."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegenerate(false)}>
            Annulla
          </Button>
          <Button loading={pending} onClick={() => void prepare(true)}>
            Genera i nuovi link
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title="Revocare l'avviso email?"
        description="Usalo quando il cittadino chiede di non ricevere più l'email per il rinnovo. Vale per tutta la famiglia in questo CAF; se resta solo il promemoria, viene cancellato subito."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setWithdrawing(null)}>
            Annulla
          </Button>
          <Button
            variant="danger"
            loading={withdrawPending}
            onClick={() => withdrawing && void withdraw(withdrawing)}
          >
            Revoca l&apos;avviso
          </Button>
        </div>
      </Dialog>

      {result && <ResultDialog result={result} onClose={() => setResult(null)} />}
    </PageContainer>
  );
}

function RenewalRow({
  item,
  selectable,
  checked,
  onToggle,
  onWithdraw,
}: {
  item: RenewalItem;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
  onWithdraw: () => void;
}) {
  const name = item.citizenName ?? "Cittadino senza nome";
  const { valid, toUpdate, toVerify } = item.documents;
  return (
    <li
      className={cn(
        "grid gap-x-4 gap-y-2 px-4 py-3.5 md:grid-cols-[2rem_minmax(0,1.6fr)_7rem_minmax(0,1.4fr)_minmax(0,1fr)] md:items-center",
        checked && "bg-stamp-wash/50",
      )}
    >
      {selectable ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Seleziona ${name}, ${item.reference}`}
          className="size-4.5 accent-stamp"
        />
      ) : (
        <span className="hidden md:block" />
      )}
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono text-xs whitespace-nowrap text-ink-3" translate="no">
            {item.reference}
          </span>
          {item.sourceKind === "reminder" && (
            <span
              className="rounded-xs bg-folder px-1.5 text-xs text-ink-2"
              title={
                item.reminderExpiresAt
                  ? `Il fascicolo è stato cancellato a fine conservazione: restano contatto e nucleo, fino al ${formatDate(item.reminderExpiresAt)}.`
                  : "Il fascicolo è stato cancellato a fine conservazione: restano contatto e nucleo."
              }
            >
              Solo promemoria
            </span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-sm text-ink-2">
        <Users className="size-4 text-ink-3" aria-hidden />
        {people(item.householdCount)}
      </span>
      <span className="flex flex-wrap gap-1.5 text-sm">
        {valid > 0 && (
          <Pill tone="ok" size="xs">
            {valid} {valid === 1 ? "valido" : "validi"}
          </Pill>
        )}
        {toUpdate > 0 && (
          <Pill tone="warn" size="xs">
            {toUpdate} da aggiornare
          </Pill>
        )}
        {toVerify > 0 && (
          <Pill tone="neutral" size="xs">
            {toVerify} da verificare
          </Pill>
        )}
        {valid + toUpdate + toVerify === 0 && <span className="text-ink-3">Nessuno</span>}
      </span>
      <span className="min-w-0 text-sm text-ink-2">
        {item.renewalCaseId ? (
          <Link
            href={`/console/pratiche/${item.renewalCaseId}` as Route}
            className="inline-flex items-center gap-1 font-semibold text-stamp hover:underline"
          >
            Apri il rinnovo
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <span className="text-ink-3">Da preparare</span>
        )}
        {item.lastInvitedAt && (
          <span className="block text-xs text-ink-3">
            Link del {formatDateTime(item.lastInvitedAt)}
          </span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
          {item.renewalContactConsent ? "Avviso email: sì" : "Avviso email: no"}
          {item.renewalContactConsent && (
            <button
              type="button"
              onClick={onWithdraw}
              className="font-semibold text-ink-2 underline underline-offset-2 hover:text-danger"
              aria-label={`Revoca l'avviso email di ${name}`}
            >
              Revoca
            </button>
          )}
        </span>
      </span>
    </li>
  );
}

/** The links exist only now: the dialog says so and puts each one a click away. */
function ResultDialog({
  result: { response, names },
  onClose,
}: {
  result: { response: CreateRenewalsResponse; names: Map<string, string | null> };
  onClose: () => void;
}) {
  const withLink = response.items.filter((item) => item.citizenLink);
  const emailed = response.items.filter((item) => item.invitation === "queued").length;
  const byHand = withLink.length - emailed;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={withLink.length === 1 ? "Rinnovo preparato" : `${withLink.length} rinnovi preparati`}
      className="sm:max-w-2xl"
    >
      <div className="grid gap-4">
        {withLink.length > 0 && (
          <Notice tone="info" role="none">
            {emailed > 0 &&
              `${emailed} ${emailed === 1 ? "riceve" : "ricevono"} il link per email. `}
            {byHand > 0 &&
              `${byHand} ${byHand === 1 ? "link va consegnato" : "link vanno consegnati"} da voi: copiali adesso, dopo non si vedono più. `}
            Se un link si perde, se ne genera uno nuovo da «Invitati».
          </Notice>
        )}
        <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
          {response.items.map((item) => (
            <li key={item.caseId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {names.get(item.sourceCaseId) ?? "Cittadino senza nome"}
                </span>
                <span className="font-mono text-xs text-ink-3" translate="no">
                  {item.reference}
                </span>
              </span>
              <Pill tone={INVITATION[item.invitation].tone} size="xs">
                {INVITATION[item.invitation].label}
              </Pill>
              {item.citizenLink && (
                <CopyButton value={item.citizenLink} size="sm" variant="secondary" />
              )}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button onClick={onClose}>Fatto</Button>
        </div>
      </div>
    </Dialog>
  );
}
