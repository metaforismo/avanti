"use client";

import { AlertTriangle, CheckCircle2, Inbox, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import type { CaseListItem, CaseListResponse, CaseStatus } from "@avanti/contracts";
import { PRACTICE_IDS } from "@avanti/contracts/constants";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { apiFetch } from "@/lib/api";
import {
  CASE_STATUS,
  LANGUAGE_IT,
  PRACTICE_SHORT,
  STATUS_ORDER,
  TONE_CLASSES,
  timeAgo,
} from "@/lib/console/labels";
import { useResource } from "@/lib/console/use-resource";
import { cn } from "@/lib/cn";

export default function QueuePage() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}

function Queue() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (params.get("stato") as CaseStatus | null) ?? "submitted";
  const practice = params.get("pratica") ?? "";
  const assignee = params.get("assegnatario") ?? "";
  // Set by the dossier after a permanent deletion, which leaves nothing else to show.
  const deleted = params.get("eliminata");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());
  // One request per pause in typing, not per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  const deferredSearch = debouncedSearch;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.delete("eliminata");
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/console?${next.toString()}` as Route, { scroll: false });
  };

  const query = useMemo(() => {
    const q = new URLSearchParams({ status, limit: "50" });
    if (practice) q.set("practiceId", practice);
    if (assignee) q.set("assignee", assignee);
    if (deferredSearch) q.set("q", deferredSearch);
    return `/api/cases?${q.toString()}`;
  }, [status, practice, assignee, deferredSearch]);

  const list = useResource<CaseListResponse>(query);
  const [extra, setExtra] = useState<{
    query: string;
    items: CaseListItem[];
    cursor: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // Keep the queue fresh while an operator works on it.
  const { reload } = list;
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [reload]);

  // Waiting cases in the tab title: visible while the operator works in another tab.
  const waiting = list.data?.counts.submitted ?? 0;
  useEffect(() => {
    document.title =
      waiting > 0 ? `(${waiting}) Pratiche · Console Avanti` : "Pratiche · Console Avanti";
  }, [waiting]);

  const appended = extra?.query === query ? extra : null;
  const items = [...(list.data?.items ?? []), ...(appended?.items ?? [])];
  const nextCursor = appended ? appended.cursor : (list.data?.nextCursor ?? null);
  const counts = list.data?.counts;

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const page = await apiFetch<CaseListResponse>(
        `${query}&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setExtra({
        query,
        items: [...(appended?.items ?? []), ...page.items],
        cursor: page.nextCursor,
      });
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Pratiche</h1>

      <div role="status">
        {deleted && (
          <p className="mt-4 flex items-center gap-3 rounded-md bg-ok-wash py-2 ps-4 pe-2 text-ok">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">
              Fascicolo <span className="font-mono">{deleted}</span> eliminato definitivamente.
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Chiudi avviso"
              onClick={() => setParam("eliminata", "")}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </p>
        )}
      </div>

      <div role="group" aria-label="Stato" className="-mx-1 mt-5 flex gap-1 overflow-x-auto pb-1">
        {STATUS_ORDER.map((key) => {
          const active = key === status;
          const count = counts?.[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              title={CASE_STATUS[key].hint}
              onClick={() => setParam("stato", key === "submitted" ? "" : key)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm transition-colors",
                active
                  ? "bg-contrast font-semibold text-on-contrast"
                  : "text-ink-2 hover:bg-sunk hover:text-ink",
              )}
            >
              {CASE_STATUS[key].label}
              {count !== undefined && (
                <span
                  className={cn(
                    "tabular min-w-5 rounded-full px-1.5 text-center text-xs",
                    active
                      ? "bg-on-contrast/20"
                      : key === "submitted" && count > 0
                        ? "bg-stamp text-on-stamp"
                        : "bg-sunk",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setParam("q", search.trim())}
            placeholder="Cerca per nome o codice pratica…"
            aria-label="Cerca pratiche"
            className="h-10 w-full rounded-sm bg-surface ps-9 pe-9 text-[0.9375rem] ring-1 ring-line-strong ring-inset placeholder:text-ink-3 focus:ring-2 focus:ring-stamp focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setParam("q", "");
              }}
              className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-ink-3 hover:text-ink"
              aria-label="Cancella ricerca"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select
          value={practice}
          onChange={(e) => setParam("pratica", e.target.value)}
          aria-label="Filtra per pratica"
          compact
        >
          <option value="">Tutte le pratiche</option>
          {PRACTICE_IDS.map((id) => (
            <option key={id} value={id}>
              {PRACTICE_SHORT[id]}
            </option>
          ))}
        </Select>
        <Select
          value={assignee}
          onChange={(e) => setParam("assegnatario", e.target.value)}
          aria-label="Filtra per operatore"
          compact
        >
          <option value="">Tutti gli operatori</option>
          <option value="me">Assegnate a me</option>
          <option value="none">Non assegnate</option>
        </Select>
      </div>

      <p role="status" className="sr-only">
        {list.status === "ready"
          ? `${items.length} pratiche: ${CASE_STATUS[status].label.toLowerCase()}`
          : ""}
      </p>
      <section aria-busy={list.status === "loading" || list.refreshing} className="mt-5">
        {list.status === "error" && !list.data ? (
          <div className="rounded-lg bg-danger-wash p-6 text-danger">
            <p className="font-semibold">Impossibile caricare le pratiche.</p>
            <p className="mt-1 text-sm">{list.error.message}</p>
            <Button variant="secondary" className="mt-4" onClick={() => void list.reload()}>
              Riprova
            </Button>
          </div>
        ) : list.status === "loading" && !list.data ? (
          <QueueSkeleton />
        ) : items.length === 0 ? (
          <EmptyQueue status={status} filtered={Boolean(practice || assignee || deferredSearch)} />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_9rem_7rem_7rem] gap-4 px-4 pb-2 text-xs text-ink-3 md:grid">
              <span>Cittadino</span>
              <span>Pratica</span>
              <span>Documenti</span>
              <span>Problemi</span>
              <span className="text-end">Aggiornata</span>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              {items.map((item) => (
                <QueueRow key={item.id} item={item} />
              ))}
            </ul>
            {nextCursor && (
              <div className="mt-4 grid justify-items-center gap-2">
                {loadMoreFailed && (
                  <p role="alert" className="text-sm text-danger">
                    Non è stato possibile caricare altre pratiche. Riprova.
                  </p>
                )}
                <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                  Mostra altre
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function QueueRow({ item }: { item: CaseListItem }) {
  const { documentsDone, documentsRequired } = item.progress;
  const docPercent = documentsRequired ? (documentsDone / documentsRequired) * 100 : 0;
  return (
    <li>
      <Link
        href={`/console/pratiche/${item.id}`}
        className="grid gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-paper focus-visible:bg-paper md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_9rem_7rem_7rem] md:items-center"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {item.citizenName ?? "Cittadino senza nome"}
          </span>
          <span className="flex items-center gap-2 text-sm text-ink-3">
            <span className="font-mono text-xs" translate="no">
              {item.reference}
            </span>
            {item.language !== "it" && (
              <span className="rounded-xs bg-folder px-1.5 text-xs text-ink-2">
                {LANGUAGE_IT[item.language]}
              </span>
            )}
          </span>
        </span>
        <span className="min-w-0 text-[0.9375rem]">
          <span className="sr-only">Pratica: </span>
          <span className="block truncate">
            {item.practice ? PRACTICE_SHORT[item.practice.id] : "Da capire"}
          </span>
          <span className="block truncate text-sm text-ink-3">
            {item.assignee ? item.assignee.name : item.office?.name}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
            <span
              className={cn("block h-full rounded-full", docPercent >= 100 ? "bg-ok" : "bg-stamp")}
              style={{ width: `${Math.min(100, docPercent)}%` }}
            />
          </span>
          <span className="tabular text-sm text-ink-2">
            <span className="sr-only">Documenti pronti: </span>
            {documentsDone}/{documentsRequired}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          {item.blockers > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                TONE_CLASSES.danger,
              )}
            >
              <AlertTriangle className="size-3" aria-hidden />
              {item.blockers}
              <span className="sr-only">bloccanti</span>
            </span>
          )}
          {item.warnings > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                TONE_CLASSES.warn,
              )}
            >
              {item.warnings}
              <span className="sr-only">avvisi</span>
            </span>
          )}
          {item.blockers === 0 && item.warnings === 0 && <span className="text-ok">Nessuno</span>}
        </span>
        <span className="text-sm text-ink-3 md:text-end">
          <time dateTime={item.updatedAt}>{timeAgo(item.updatedAt)}</time>
        </span>
      </Link>
    </li>
  );
}

function EmptyQueue({ status, filtered }: { status: CaseStatus; filtered: boolean }) {
  return (
    <div className="grid place-items-center rounded-lg border-2 border-dashed border-line px-6 py-16 text-center">
      <Inbox className="size-8 text-ink-3" aria-hidden />
      <p className="mt-4 text-lg font-semibold">
        {filtered
          ? "Nessuna pratica con questi filtri"
          : `Nessuna pratica: ${CASE_STATUS[status].label.toLowerCase()}`}
      </p>
      <p className="mt-1 max-w-sm text-ink-2">
        {filtered
          ? "Prova a togliere un filtro o a cercare un altro nome."
          : status === "submitted"
            ? "Quando un cittadino invia il suo fascicolo, compare qui."
            : CASE_STATUS[status].hint + "."}
      </p>
      {!filtered && status === "submitted" && (
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/console/sportelli">Stampa il QR dello sportello</Link>
        </Button>
      )}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        Caricamento delle pratiche…
      </p>
      <div className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded-xs bg-sunk" />
              <div className="h-3 w-1/4 animate-pulse rounded-xs bg-sunk" />
            </div>
            <div className="h-3 w-24 animate-pulse rounded-xs bg-sunk" />
          </div>
        ))}
      </div>
    </>
  );
}
