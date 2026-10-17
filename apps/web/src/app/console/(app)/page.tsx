"use client";

import {
  AlertOctagon,
  AlertTriangle,
  CheckCheck,
  Clock,
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
import type {
  AssignCasesResponse,
  CaseListItem,
  CaseListResponse,
  CaseStatus,
} from "@avanti/contracts";
import { ASSIGN_CASES_MAX, PRACTICE_IDS } from "@avanti/contracts/constants";
import { FirstSteps } from "@/components/console/first-steps";
import { casesLabel, QueueAssign } from "@/components/console/queue-assign";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
import { useOperator } from "@/lib/console/operator-context";
import { rememberQueue } from "@/lib/console/recent-cases";
import { QUEUE_SEARCH_MAX, readQueueParams, uniqueById } from "@/lib/console/queue-params";
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
  const {
    status,
    practice,
    assignee,
    priority,
    longestWaiting,
    q: initialSearch,
  } = readQueueParams(params);
  const operator = useOperator();
  const admin = operator.role === "admin";
  // Set by the dossier after a permanent deletion, which leaves nothing else to show.
  const deleted = params.get("eliminata");
  // Only a count: anything else typed into the URL is not ours to show.
  const erasedParam = params.get("famiglia");
  const familyErased = erasedParam && /^\d+$/.test(erasedParam) ? erasedParam : null;
  const [search, setSearch] = useState(initialSearch);
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
    if (priority) q.set("ai", priority);
    if (deferredSearch) q.set("q", deferredSearch);
    if (longestWaiting) q.set("sort", "waiting");
    return `/api/cases?${q.toString()}`;
  }, [status, practice, assignee, priority, deferredSearch, longestWaiting]);

  const list = useResource<CaseListResponse>(query);
  const [extra, setExtra] = useState<{
    query: string;
    items: CaseListItem[];
    cursor: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // Tied to the query: changing tab or filter drops a selection the admin can no longer see.
  const [selection, setSelection] = useState<{ query: string; ids: Set<string> }>({
    query: "",
    ids: new Set(),
  });
  const selectedIds = selection.query === query ? selection.ids : EMPTY;
  const [assigned, setAssigned] = useState<{ text: string; partial: boolean } | null>(null);

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

  useEffect(() => rememberQueue(params), [params]);

  const appended = extra?.query === query ? extra : null;
  const items = uniqueById([...(list.data?.items ?? []), ...(appended?.items ?? [])]);
  const nextCursor = appended ? appended.cursor : (list.data?.nextCursor ?? null);
  const counts = list.data?.counts;
  const filtered = Boolean(practice || assignee || priority || deferredSearch);
  const visibleById = new Map(items.map((item) => [item.id, item]));
  const selected = [...selectedIds].flatMap((id) => visibleById.get(id) ?? []);
  const selectable = items.slice(0, ASSIGN_CASES_MAX);
  const allSelected = selectable.length > 0 && selectable.every((item) => selectedIds.has(item.id));
  const overdue = list.data?.waitingOverdue ?? 0;

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else if (next.size < ASSIGN_CASES_MAX) next.add(id);
    setSelection({ query, ids: next });
  }

  function assignmentDone(response: AssignCasesResponse) {
    const by = (outcome: string) => response.results.filter((r) => r.outcome === outcome);
    const done = by("assigned").length + by("unchanged").length;
    const conflicts = by("conflict");
    const missing = by("not_found").length;
    const parts = [
      response.assignee
        ? `${casesLabel(done)} ${done === 1 ? "assegnata" : "assegnate"} a ${response.assignee.name}.`
        : `${casesLabel(done)} ${done === 1 ? "è" : "sono"} di nuovo senza assegnazione.`,
    ];
    if (conflicts.length)
      parts.push(
        `${casesLabel(conflicts.length)} ${conflicts.length === 1 ? "è cambiata" : "sono cambiate"} nel frattempo e non ${conflicts.length === 1 ? "è stata toccata" : "sono state toccate"}: ${conflicts.length === 1 ? "resta selezionata" : "restano selezionate"}, ricontrolla e riprova.`,
      );
    if (missing)
      parts.push(`${casesLabel(missing)} non ${missing === 1 ? "esiste" : "esistono"} più.`);
    setAssigned({ text: parts.join(" "), partial: conflicts.length + missing > 0 });
    setSelection({ query, ids: new Set(conflicts.map((r) => r.id)) });
    setExtra(null);
    void list.reload();
  }

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
    <PageContainer width="6xl" className={cn(selected.length > 0 && "pb-28")}>
      <PageHeader title="Pratiche" />

      {/* The live region stays mounted so the confirmation is announced when it appears. */}
      <div role="status">
        {assigned && (
          <Notice
            tone={assigned.partial ? "warn" : "ok"}
            role="none"
            className="mt-4"
            onDismiss={() => setAssigned(null)}
            dismissLabel="Chiudi avviso"
          >
            {assigned.text}
          </Notice>
        )}
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

      <div
        role="group"
        aria-label="Stato"
        className="-mx-1 mt-5 flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
      >
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
        <div className="relative min-w-64 flex-[2_1_18rem]">
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
            maxLength={QUEUE_SEARCH_MAX}
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
        {/* The three filters wrap together under the search, never one alone on a line. */}
        <div className="grid flex-[3_1_32rem] gap-2 sm:grid-cols-3">
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
      </div>

      {status === "submitted" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p
            className={cn(
              "flex items-center gap-2 text-sm",
              overdue > 0 ? "text-warn" : "text-ink-3",
            )}
          >
            <Clock className="size-4 shrink-0" aria-hidden />
            {overdue > 0
              ? `${casesLabel(overdue)} non ${overdue === 1 ? "assegnata aspetta" : "assegnate aspettano"} da più di 2 giorni lavorativi.`
              : "Nessuna pratica aspetta da più di 2 giorni lavorativi."}
          </p>
          <SegmentedControl
            label="Ordina le pratiche inviate"
            value={longestWaiting ? "attesa" : "recenti"}
            options={[
              { value: "recenti", label: "Più recenti" },
              { value: "attesa", label: "In attesa da più tempo" },
            ]}
            onChange={(value) => setParam("ordina", value === "attesa" ? value : "")}
          />
        </div>
      )}

      <p role="status" className="sr-only">
        {list.status === "ready"
          ? `${casesLabel(items.length)}: ${CASE_STATUS[status].label.toLowerCase()}`
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
            <EmptyQueue
              status={status}
              filtered={filtered}
              onClearFilters={() => {
                setSearch("");
                router.replace(
                  (status === "submitted" ? "/console" : `/console?stato=${status}`) as Route,
                  { scroll: false },
                );
              }}
            />
          )
        ) : (
          <>
            <div className={cn("flex items-center text-xs text-ink-3 md:pb-2", admin && "pb-2")}>
              {admin && (
                <SelectAll
                  checked={allSelected}
                  mixed={!allSelected && selected.length > 0}
                  count={selectable.length}
                  onChange={() =>
                    setSelection({
                      query,
                      ids: allSelected ? new Set() : new Set(selectable.map((item) => item.id)),
                    })
                  }
                />
              )}
              <div
                className={cn(
                  "hidden flex-1 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8rem_7rem_6rem] gap-4 px-4 md:grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_9rem_7rem_7rem]",
                  admin && "ps-1",
                )}
              >
                <span>Cittadino</span>
                <span>Pratica</span>
                <span>Documenti</span>
                <span>Problemi</span>
                <span className="text-end">Aggiornata</span>
              </div>
              {admin && (
                <span className="ps-1 md:hidden">
                  {allSelected ? "Deseleziona tutte" : "Seleziona tutte le visibili"}
                </span>
              )}
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              {items.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  selection={
                    admin
                      ? {
                          checked: selectedIds.has(item.id),
                          disabled:
                            !selectedIds.has(item.id) && selectedIds.size >= ASSIGN_CASES_MAX,
                          onToggle: () => toggle(item.id),
                        }
                      : null
                  }
                />
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

      {admin && selected.length > 0 && (
        <QueueAssign
          selected={selected}
          currentOperatorId={operator.id}
          onClear={() => setSelection({ query, ids: new Set() })}
          onDone={assignmentDone}
        />
      )}
    </PageContainer>
  );
}

const EMPTY: ReadonlySet<string> = new Set();

function SelectAll({
  checked,
  mixed,
  count,
  onChange,
}: {
  checked: boolean;
  mixed: boolean;
  count: number;
  onChange: () => void;
}) {
  return (
    <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
      <input
        type="checkbox"
        checked={checked}
        ref={(node) => {
          if (node) node.indeterminate = mixed;
        }}
        onChange={onChange}
        aria-label={
          checked
            ? count === 1
              ? "Deseleziona la pratica"
              : "Deseleziona tutte le pratiche"
            : count === 1
              ? "Seleziona l'unica pratica visibile"
              : `Seleziona tutte le ${count} pratiche visibili`
        }
        className="size-4.5 accent-stamp"
      />
    </label>
  );
}

function QueueRow({
  item,
  selection,
}: {
  item: CaseListItem;
  selection: { checked: boolean; disabled: boolean; onToggle: () => void } | null;
}) {
  const router = useRouter();
  const { documentsDone, documentsRequired } = item.progress;
  const docPercent = documentsRequired ? (documentsDone / documentsRequired) * 100 : 0;
  const href = `/console/pratiche/${item.id}` as Route;
  // Prefetch on intent, not on sight: scrolling hundreds of cases must not fire hundreds of
  // requests. Only the route's code is fetched; opening the case itself is what gets audited.
  const prefetch = () => router.prefetch(href);
  return (
    // Rows off screen skip layout and paint: long queues scroll as lightly as short ones.
    <li
      // Hover and selection colour the whole row, checkbox cell included.
      className={cn(
        "flex transition-colors [contain-intrinsic-size:auto_4.5rem] [content-visibility:auto]",
        selection?.checked
          ? "bg-stamp-wash"
          : "has-[a:focus-visible]:bg-paper [@media(hover:hover)]:has-[a:hover]:bg-paper",
      )}
    >
      {selection && (
        // Outside the link: a checkbox inside an anchor would open the case on every tick.
        // On phones the row is tall: the checkbox sits by the name, not adrift in the middle.
        <label className="grid w-11 shrink-0 cursor-pointer justify-items-center self-stretch pt-4 has-[:disabled]:cursor-not-allowed md:place-items-center md:pt-0">
          <input
            type="checkbox"
            checked={selection.checked}
            disabled={selection.disabled}
            onChange={selection.onToggle}
            aria-label={`Seleziona ${item.citizenName ?? "pratica"} ${item.reference}`}
            className="size-4.5 accent-stamp disabled:opacity-40"
          />
        </label>
      )}
      <Link
        href={href}
        prefetch={false}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        className={cn(
          "grid min-w-0 flex-1 gap-x-4 gap-y-2 px-4 py-3.5 focus-visible:outline-offset-[-2px] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8rem_7rem_6rem] md:items-center xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_9rem_7rem_7rem]",
          selection && "ps-1",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold" title={item.citizenName ?? undefined}>
            {item.citizenName ?? "Cittadino senza nome"}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-3">
            <span className="font-mono text-xs whitespace-nowrap" translate="no">
              {item.reference}
            </span>
            {item.language !== "it" && (
              <span className="rounded-xs bg-folder px-1.5 text-xs text-ink-2">
                {LANGUAGE_IT[item.language]}
              </span>
            )}
            {/* No "·" separator: when the line wraps it would start the next one. */}
            {item.waiting && !item.waiting.overdue && (
              <span className="whitespace-nowrap">in attesa {waitingSince(item.waiting.days)}</span>
            )}
          </span>
          {item.waiting?.overdue && (
            <span title="Nessuno l'ha presa in carico da più di 2 giorni lavorativi">
              <Pill tone="warn" className="mt-1 w-fit">
                <Clock aria-hidden />
                In attesa {waitingSince(item.waiting.days)}
              </Pill>
            </span>
          )}
          {item.aiPriority && <PriorityBadge item={item} />}
        </span>
        <span className="min-w-0 text-body-sm">
          <span className="sr-only">Pratica: </span>
          {/* Two lines, not one: at 13" the column is narrow and the end tells practices apart. */}
          <span className="line-clamp-2">
            {item.practice ? PRACTICE_SHORT[item.practice.id] : "Da capire"}
          </span>
          <span
            className="block truncate text-sm text-ink-3"
            title={item.assignee ? item.assignee.name : item.office?.name}
          >
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
          <span className="tabular text-sm whitespace-nowrap text-ink-2">
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
                <AlertOctagon aria-hidden />
                {item.blockers}
                <span className="sr-only">bloccanti</span>
              </Pill>
            </span>
          )}
          {item.warnings > 0 && (
            <span title={item.warnings === 1 ? "1 avviso" : `${item.warnings} avvisi`}>
              <Pill tone="warn" size="sm" className="py-0.5">
                <AlertTriangle aria-hidden />
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

const waitingSince = (days: number) =>
  days === 0 ? "da oggi" : days === 1 ? "da ieri" : `da ${days} giorni`;

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

function EmptyQueue({
  status,
  filtered,
  onClearFilters,
}: {
  status: CaseStatus;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  return (
    <EmptyState
      icon={Inbox}
      title={
        filtered
          ? "Nessuna pratica con questi filtri"
          : `Nessuna pratica: ${CASE_STATUS[status].label.toLowerCase()}`
      }
      action={
        filtered ? (
          <Button variant="secondary" onClick={onClearFilters}>
            <X className="size-4" aria-hidden />
            Togli i filtri
          </Button>
        ) : (
          status === "submitted" && (
            <Button asChild variant="secondary">
              <Link href="/console/sportelli">Stampa il QR dello sportello</Link>
            </Button>
          )
        )
      }
    >
      {filtered
        ? "Nessun risultato in questa scheda: prova le altre o cerca un altro nome."
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
