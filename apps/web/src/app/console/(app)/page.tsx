"use client";

import {
  AlertTriangle,
  CheckCheck,
  Inbox,
  MessageCircleQuestion,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import type { CaseListItem, CaseListResponse, CaseStatus } from "@avanti/contracts";
import { PRACTICE_IDS } from "@avanti/contracts/constants";
import { FirstSteps } from "@/components/console/first-steps";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import {
  CASE_STATUS,
  LANGUAGE_IT,
  PRACTICE_SHORT,
  STATUS_ORDER,
  timeAgo,
  type Tone,
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
  const priority = params.get("priorita") ?? "";
  // Set by the dossier after a permanent deletion, which leaves nothing else to show.
  const deleted = params.get("eliminata");
  const familyErased = params.get("famiglia");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  // "/" jumps to the search, as in most work tools, unless the operator is typing elsewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
    next.delete("famiglia");
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/console?${next.toString()}` as Route, { scroll: false });
  };

  const query = useMemo(() => {
    const q = new URLSearchParams({ status, limit: "50" });
    if (practice) q.set("practiceId", practice);
    if (assignee) q.set("assignee", assignee);
    if (priority in PRIORITY) q.set("ai", priority);
    if (deferredSearch) q.set("q", deferredSearch);
    return `/api/cases?${q.toString()}`;
  }, [status, practice, assignee, priority, deferredSearch]);

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
  const filtered = Boolean(practice || assignee || priority || deferredSearch);
  // No case in any state yet: a CAF's first day.
  const firstDay = counts ? Object.values(counts).every((n) => n === 0) : false;

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
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
    <PageContainer width="6xl">
      <PageHeader title="Pratiche" />

      {/* The live region stays mounted so the confirmation is announced when it appears. */}
      <div role="status">
        {familyErased && (
          <Notice
            tone="ok"
            role="none"
            className="mt-4"
            onDismiss={() => setParam("famiglia", "")}
            dismissLabel="Chiudi avviso"
          >
            Famiglia cancellata: {familyErased}{" "}
            {familyErased === "1" ? "pratica eliminata" : "pratiche eliminate"} definitivamente.
          </Notice>
        )}
        {deleted && (
          <Notice
            tone="ok"
            role="none"
            className="mt-4"
            onDismiss={() => setParam("eliminata", "")}
            dismissLabel="Chiudi avviso"
          >
            Fascicolo <span className="font-mono">{deleted}</span> eliminato definitivamente.
          </Notice>
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
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            name="q"
            aria-keyshortcuts="/"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              setSearch("");
              setParam("q", "");
              event.currentTarget.blur();
            }}
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => setParam("q", search.trim())}
            placeholder="Cerca per nome o codice pratica…"
            aria-label="Cerca pratiche"
            className="peer h-10 w-full rounded-sm bg-surface ps-9 pe-9 text-body-sm ring-1 ring-line-strong ring-inset placeholder:text-ink-3 focus:ring-2 focus:ring-stamp focus:outline-none"
          />
          {!search && (
            <kbd
              aria-hidden
              className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded-xs px-1.5 font-mono text-xs text-ink-3 ring-1 ring-line-strong peer-focus:hidden md:block"
            >
              /
            </kbd>
          )}
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setParam("q", "");
              }}
              className="absolute end-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-ink-3 hover:text-ink"
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
        <Select
          value={priority}
          onChange={(e) => setParam("priorita", e.target.value)}
          aria-label="Filtra per priorità"
          compact
        >
          <option value="">Tutte le priorità</option>
          {(Object.keys(PRIORITY) as Priority[]).map((key) => (
            <option key={key} value={key}>
              {PRIORITY[key].filter}
            </option>
          ))}
        </Select>
      </div>

      <p role="status" className="sr-only">
        {list.status === "ready"
          ? `${items.length} pratiche: ${CASE_STATUS[status].label.toLowerCase()}`
          : ""}
      </p>
      <section aria-busy={list.status === "loading" || list.refreshing} className="mt-5">
        {list.status === "error" && !list.data ? (
          <Notice
            tone="danger"
            size="page"
            title="Impossibile caricare le pratiche."
            action={
              <Button variant="secondary" onClick={() => void list.reload()}>
                Riprova
              </Button>
            }
          >
            {list.error.message}
          </Notice>
        ) : list.status === "loading" && !list.data ? (
          <QueueSkeleton />
        ) : items.length === 0 ? (
          firstDay && !filtered ? (
            <FirstSteps />
          ) : (
            <EmptyQueue status={status} filtered={filtered} />
          )
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
                {!loadMoreFailed && (
                  <LoadMoreSentinel key={nextCursor} onVisible={() => void loadMore()} />
                )}
                {loadMoreFailed && (
                  <Notice tone="danger">
                    Non è stato possibile caricare altre pratiche. Riprova.
                  </Notice>
                )}
                <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                  Mostra altre
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </PageContainer>
  );
}

function QueueRow({ item }: { item: CaseListItem }) {
  const router = useRouter();
  const { documentsDone, documentsRequired } = item.progress;
  const docPercent = documentsRequired ? (documentsDone / documentsRequired) * 100 : 0;
  const href = `/console/pratiche/${item.id}` as Route;
  // Prefetch on intent, not on sight: scrolling hundreds of cases must not fire hundreds of
  // requests. Only the route's code is fetched; opening the case itself is what gets audited.
  const prefetch = () => router.prefetch(href);
  return (
    // Rows off screen skip layout and paint: long queues scroll as lightly as short ones.
    <li className="[contain-intrinsic-size:auto_4.5rem] [content-visibility:auto]">
      <Link
        href={href}
        prefetch={false}
        onPointerEnter={prefetch}
        onFocus={prefetch}
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
          {item.aiPriority && <PriorityBadge item={item} />}
        </span>
        <span className="min-w-0 text-body-sm">
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
              title={
                item.blockers === 1 ? "1 problema bloccante" : `${item.blockers} problemi bloccanti`
              }
            >
              <Pill tone="danger" size="sm" className="py-0.5">
                <AlertTriangle aria-hidden />
                {item.blockers}
                <span className="sr-only">bloccanti</span>
              </Pill>
            </span>
          )}
          {item.warnings > 0 && (
            <span title={item.warnings === 1 ? "1 avviso" : `${item.warnings} avvisi`}>
              <Pill tone="warn" size="sm" className="py-0.5">
                {item.warnings}
                <span className="sr-only">avvisi</span>
              </Pill>
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

type Priority = NonNullable<CaseListItem["aiPriority"]>;

// Suggestions to order the work, never a decision on the case: the operator still reviews all.
const PRIORITY: Record<Priority, { filter: string; badge: string; tone: Tone }> = {
  near_ready: {
    filter: "Quasi pronte",
    badge: "Quasi pronta",
    tone: "ok",
  },
  citizen_question: {
    filter: "Il cittadino ha scritto",
    badge: "Ha scritto allo sportello",
    tone: "stamp",
  },
  attention: {
    filter: "Da guardare con attenzione",
    badge: "Punti da guardare",
    tone: "warn",
  },
  quick_review: {
    filter: "Revisione rapida",
    badge: "Revisione rapida",
    tone: "ok",
  },
};

function PriorityBadge({ item }: { item: CaseListItem }) {
  const key = item.aiPriority!;
  const Icon =
    key === "citizen_question"
      ? MessageCircleQuestion
      : key === "near_ready"
        ? CheckCheck
        : Sparkles;
  return (
    <Pill tone={PRIORITY[key].tone} className="mt-1 w-fit whitespace-normal">
      <Icon aria-hidden />
      {PRIORITY[key].badge}
      {key === "attention" && item.aiAttention ? `: ${item.aiAttention}` : ""}
    </Pill>
  );
}

function EmptyQueue({ status, filtered }: { status: CaseStatus; filtered: boolean }) {
  return (
    <EmptyState
      icon={Inbox}
      title={
        filtered
          ? "Nessuna pratica con questi filtri"
          : `Nessuna pratica: ${CASE_STATUS[status].label.toLowerCase()}`
      }
      action={
        !filtered &&
        status === "submitted" && (
          <Button asChild variant="secondary">
            <Link href="/console/sportelli">Stampa il QR dello sportello</Link>
          </Button>
        )
      }
    >
      {filtered
        ? "Prova a togliere un filtro o a cercare un altro nome."
        : status === "submitted"
          ? "Quando un cittadino invia il suo fascicolo, compare qui."
          : CASE_STATUS[status].hint + "."}
    </EmptyState>
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
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Starts loading older cases a screen before the end of the list, so scrolling rarely meets a
 * wait. Fires once per page (remounted with each cursor); the button stays for keyboards.
 */
function LoadMoreSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const latest = useRef(onVisible);
  useEffect(() => {
    latest.current = onVisible;
  });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        latest.current();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} aria-hidden />;
}
