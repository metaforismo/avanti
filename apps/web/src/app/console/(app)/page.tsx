"use client";

import {
  AlertOctagon,
  AlertTriangle,
  CheckCheck,
  Clock,
  Inbox,
  MessageCircleQuestion,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
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
import { NewCaseDialog } from "@/components/console/new-case-dialog";
import { casesLabel, QueueAssign } from "@/components/console/queue-assign";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { erasureDeadline, formatDeadline } from "@/lib/console/erasure-deadline";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tooltip } from "@/components/ui/tooltip";
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
import { queueIsIdle } from "@/lib/console/first-steps";
import { useOperator } from "@/lib/console/operator-context";
import { rememberQueue } from "@/lib/console/recent-cases";
import {
  QUEUE_SEARCH_MAX,
  queueApiPath,
  readQueueParams,
  uniqueById,
} from "@/lib/console/queue-params";
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
    erasure,
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    // Choosing a status tab leaves the erasure requests for the ordinary queue.
    if (key === "stato") next.delete("cancellazioni");
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/console?${next.toString()}` as Route, { scroll: false });
  };

  const query = useMemo(
    () =>
      queueApiPath({
        status,
        practice,
        assignee,
        priority,
        longestWaiting,
        erasure,
        q: deferredSearch,
      }),
    [status, practice, assignee, priority, deferredSearch, longestWaiting, erasure],
  );

  const list = useResource<CaseListResponse>(query);
  const [extra, setExtra] = useState<{
    query: string;
    items: CaseListItem[];
    cursor: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Owned here, not by the first steps: the panel may give way while the dialog is open.
  const [creatingTrial, setCreatingTrial] = useState(false);
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
  const erasureRequests = list.data?.erasureRequests ?? 0;

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

  const emptyQueue = (
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
  );

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

  const activeFilters = [practice, assignee, priority].filter(Boolean).length;
  const filterFields = (
    <>
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
    </>
  );
  const sortControl = (className?: string) => (
    <SegmentedControl
      label="Ordina le pratiche inviate"
      value={longestWaiting ? "attesa" : "recenti"}
      options={[
        { value: "recenti", label: "Più recenti" },
        { value: "attesa", label: "In attesa da più tempo" },
      ]}
      onChange={(value) => setParam("ordina", value === "attesa" ? value : "")}
      className={className}
    />
  );

  return (
    <PageContainer width="wide" className={cn(selected.length > 0 && "pb-28")}>
      <PageHeader title="Pratiche" />

      {/* The live region stays mounted so the confirmation is announced when it appears. */}
      <div role="status">
        {assigned && (
          <Notice
            tone={assigned.partial ? "warn" : "ok"}
            role="none"
            className="console-arrive mt-4"
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

      {erasure ? (
        <Notice
          tone="danger"
          role="none"
          className="mt-4"
          title="Richieste di cancellazione aperte"
          action={
            <Button variant="secondary" onClick={() => setParam("cancellazioni", "")}>
              Torna alle pratiche
            </Button>
          }
        >
          In ogni stato, dalla scadenza più vicina. La risposta al cittadino va data entro un mese
          dalla richiesta: cancella la pratica o, se va conservata, spiegagli perché.
        </Notice>
      ) : (
        erasureRequests > 0 && (
          <Notice
            tone="danger"
            role="none"
            className="mt-4"
            title={
              erasureRequests === 1
                ? "Un cittadino chiede la cancellazione dei suoi dati"
                : `${erasureRequests} cittadini chiedono la cancellazione dei loro dati`
            }
            action={
              <Button variant="secondary" onClick={() => setParam("cancellazioni", "1")}>
                Vedi le richieste
              </Button>
            }
          >
            Va data una risposta entro un mese dalla richiesta, in qualunque stato sia la pratica.
          </Notice>
        )
      )}

      {/* On a phone the tabs scroll sideways; the fade at the end says there is more. */}
      <div className="relative mt-5 max-sm:-me-4">
        <div
          role="group"
          aria-label="Stato"
          className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto pb-1 max-sm:pe-6 sm:flex-wrap sm:overflow-visible"
        >
          {STATUS_ORDER.map((key) => {
            const active = !erasure && key === status;
            const count = counts?.[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                title={CASE_STATUS[key].hint}
                onClick={() => setParam("stato", key === "submitted" ? "" : key)}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-sm px-3 text-sm transition-colors duration-100",
                  active
                    ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgb(20_27_45/0.08)] ring-1 ring-line"
                    : "text-ink-2 hover:bg-sunk hover:text-ink",
                )}
              >
                {CASE_STATUS[key].label}
                {count !== undefined && (
                  <span
                    className={cn(
                      "tabular min-w-5 rounded-full px-1.5 text-center text-xs font-medium",
                      key === "submitted" && count > 0
                        ? "bg-stamp text-on-stamp"
                        : active
                          ? "bg-sunk text-ink-2"
                          : "text-ink-3",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 w-6 bg-linear-to-l from-paper sm:hidden"
        />
      </div>

      <div className={cn("mt-4 flex flex-wrap items-center gap-2", erasure && "hidden")}>
        <div className="relative min-w-0 flex-[1_1_0%] md:min-w-64 md:flex-[2_1_18rem]">
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
        {/* The three filters wrap together under the search, never one alone on a line. On a
            phone they take the first screen: there they wait behind one button, in a sheet. */}
        {/* Chosen by CSS, not by script: the first paint on a phone is already the phone's. */}
        <div className="grid flex-[3_1_32rem] gap-2 max-md:hidden sm:grid-cols-3">
          {filterFields}
        </div>
        <Button
          variant="secondary"
          className="md:hidden"
          onClick={() => setFiltersOpen(true)}
          aria-label={
            activeFilters > 0 ? `Filtri, ${activeFilters} attivi` : "Filtri e ordinamento"
          }
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtri
          {activeFilters > 0 && (
            <span className="tabular min-w-5 rounded-full bg-stamp px-1.5 text-center text-xs text-on-stamp">
              {activeFilters}
            </span>
          )}
        </Button>
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} title="Filtri">
        <div className="grid gap-3">
          {filterFields}
          {status === "submitted" && sortControl("w-full [&>button]:flex-1")}
        </div>
        <div className="mt-5 flex gap-2">
          {activeFilters > 0 && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                const next = new URLSearchParams(params);
                for (const key of ["pratica", "assegnatario", "priorita"]) next.delete(key);
                router.replace(`/console?${next.toString()}` as Route, { scroll: false });
              }}
            >
              Togli i filtri
            </Button>
          )}
          <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
            Mostra i risultati
          </Button>
        </div>
      </Dialog>

      {status === "submitted" && !erasure && (
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
          {sortControl("max-md:hidden")}
        </div>
      )}

      <p role="status" className="sr-only">
        {list.status === "ready"
          ? `${casesLabel(items.length)}: ${erasure ? "richieste di cancellazione" : CASE_STATUS[status].label.toLowerCase()}`
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
          erasure ? (
            <Notice tone="ok" size="page" title="Nessuna richiesta di cancellazione aperta." />
          ) : queueIsIdle(counts) && counts && !filtered ? (
            <FirstSteps
              counts={counts}
              onNewCase={() => setCreatingTrial(true)}
              fallback={emptyQueue}
            />
          ) : (
            emptyQueue
          )
        ) : (
          <>
            {/* One table: the column heads sit in the card's top band, over their columns. */}
            <div className="overflow-hidden rounded-md bg-surface ring-1 ring-line">
              <div
                className={cn(
                  "flex items-center border-b border-line bg-paper/70 text-xs font-medium text-ink-3",
                  !admin && "max-md:hidden",
                )}
              >
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
                    "hidden h-9 flex-1 items-center gap-4 px-4 md:grid",
                    COLUMNS,
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
              <ul className="divide-y divide-line">
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
            </div>
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
      <NewCaseDialog open={creatingTrial} onOpenChange={setCreatingTrial} />
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
    <label className="grid h-9 w-11 shrink-0 cursor-pointer place-items-center max-md:h-11">
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

/** The queue's columns, shared by the head band, the rows and the skeleton. */
const COLUMNS =
  "md:grid-cols-[minmax(13.75rem,1.6fr)_minmax(0,1fr)_8rem_8rem_6rem] xl:grid-cols-[minmax(13.75rem,1.6fr)_minmax(0,1fr)_9rem_8.5rem_7rem]";

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
  const name = item.citizenName ?? "Cittadino senza nome";
  const documents = (
    <span className="tabular text-sm whitespace-nowrap text-ink-2">
      <span className="sr-only">Documenti pronti: </span>
      {documentsDone}/{documentsRequired}
    </span>
  );
  return (
    // Rows off screen skip layout and paint: long queues scroll as lightly as short ones.
    <li
      // Hover and selection colour the whole row, checkbox cell included.
      className={cn(
        "flex transition-colors duration-100 [contain-intrinsic-size:auto_4.5rem] [content-visibility:auto] md:[contain-intrinsic-size:auto_3.5rem]",
        selection?.checked
          ? "bg-stamp-wash"
          : "has-[a:focus-visible]:bg-paper [@media(hover:hover)]:has-[a:hover]:bg-paper",
      )}
    >
      {selection && (
        // Outside the link: a checkbox inside an anchor would open the case on every tick.
        <label className="grid w-11 shrink-0 cursor-pointer place-items-center self-stretch has-[:disabled]:cursor-not-allowed">
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
          "grid min-h-18 min-w-0 flex-1 content-center gap-x-4 gap-y-1 px-4 py-2 focus-visible:outline-offset-[-2px] md:min-h-14 md:items-center",
          COLUMNS,
          selection && "ps-1",
        )}
      >
        {/* Two lines on every screen: who and what is wrong, then where the case stands. One
            height for every row, whatever the wait or the flags. */}
        <span className="grid min-w-0 gap-0.5">
          <span className="flex min-w-0 items-center gap-3">
            <span
              dir="auto"
              className="min-w-0 flex-1 truncate text-[0.9375rem] leading-5 font-semibold"
              title={name}
            >
              {name}
            </span>
            <span className="shrink-0 md:hidden">
              <Problems item={item} />
            </span>
          </span>
          <span className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-hidden text-[0.8125rem] leading-[1.125rem] text-ink-3">
            <span className="shrink-0 font-mono text-xs" translate="no">
              {item.reference}
            </span>
            {item.language !== "it" && (
              <span className="shrink-0 rounded-xs bg-folder px-1.5 text-xs text-ink-2">
                {LANGUAGE_IT[item.language]}
              </span>
            )}
            {item.waiting && <Waiting waiting={item.waiting} />}
            {item.erasureRequestedAt && (
              <span
                className="inline-flex min-w-0 items-center gap-1 font-medium text-danger"
                title="Il cittadino chiede la cancellazione dei suoi dati"
              >
                <Trash2 className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  Chiede la cancellazione · entro il{" "}
                  {formatDeadline(erasureDeadline(item.erasureRequestedAt))}
                </span>
              </span>
            )}
            <span className="ms-auto shrink-0 md:hidden">{documents}</span>
          </span>
        </span>
        <span className="min-w-0 max-md:hidden">
          <span className="sr-only">Pratica: </span>
          <span className="block truncate text-sm" title={practiceName(item)}>
            {practiceName(item)}
          </span>
          <span
            className="block truncate text-[0.8125rem] text-ink-3"
            title={item.assignee ? item.assignee.name : item.office?.name}
          >
            {item.assignee ? item.assignee.name : item.office?.name}
          </span>
        </span>
        <span className="flex items-center gap-2 max-md:hidden">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-sunk">
            {/* scaleX, not width: a refresh that moves the bar stays on the compositor. */}
            <span
              className={cn(
                "block h-full origin-left rounded-full transition-transform duration-200 ease-(--ease-out) rtl:origin-right",
                docPercent >= 100 ? "bg-ok" : "bg-stamp",
              )}
              style={{ transform: `scaleX(${Math.min(100, docPercent) / 100})` }}
            />
          </span>
          {documents}
        </span>
        <span className="max-md:hidden">
          <Problems item={item} />
        </span>
        <span className="text-sm text-ink-3 max-md:hidden md:text-end">
          <time dateTime={item.updatedAt}>{timeAgo(item.updatedAt)}</time>
        </span>
      </Link>
    </li>
  );
}

const practiceName = (item: CaseListItem) =>
  item.practice ? PRACTICE_SHORT[item.practice.id] : "Da capire";

/**
 * How long the case has waited. A long wait nobody took is a warn clock and «9 g», not a pill
 * that pushes the row onto a third line.
 */
function Waiting({ waiting }: { waiting: NonNullable<CaseListItem["waiting"]> }) {
  if (waiting.overdue)
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 font-medium text-warn"
        title={`In attesa da ${waiting.days} giorni: nessuno l’ha presa in carico da più di 2 giorni lavorativi`}
      >
        <Clock className="size-3.5" aria-hidden />
        <span aria-hidden>{waiting.days} g</span>
        <span className="sr-only">
          in attesa da {waiting.days} giorni, oltre i 2 giorni lavorativi
        </span>
      </span>
    );
  return <span className="truncate whitespace-nowrap">{waitingSince(waiting.days)}</span>;
}

/**
 * What needs a look, as coloured numbers with an icon (no pills): blockers, warnings, then the
 * AI's own points and suggestions. Each one says in a tooltip where its count comes from.
 */
function Problems({ item }: { item: CaseListItem }) {
  const ai = item.aiPriority;
  const aiPoints = ai === "attention" && item.aiAttention ? item.aiAttention : 0;
  const nothing = item.blockers === 0 && item.warnings === 0 && !ai;
  return (
    <span className="flex items-center gap-3 text-sm">
      {item.blockers > 0 && (
        <Indicator
          icon={AlertOctagon}
          className="text-danger"
          count={item.blockers}
          label={
            item.blockers === 1 ? "1 problema bloccante" : `${item.blockers} problemi bloccanti`
          }
        />
      )}
      {item.warnings > 0 && (
        <Indicator
          icon={AlertTriangle}
          className="text-warn"
          count={item.warnings}
          label={item.warnings === 1 ? "1 avviso" : `${item.warnings} avvisi`}
        />
      )}
      {ai === "attention" && (
        <Indicator
          icon={Sparkles}
          className="text-stamp"
          count={aiPoints || null}
          label={
            aiPoints === 1
              ? "1 punto da guardare secondo il controllo incrociato dell’AI tra dichiarazioni e documenti: può coincidere con un problema già contato"
              : `${aiPoints || "Alcuni"} punti da guardare secondo il controllo incrociato dell’AI tra dichiarazioni e documenti: possono coincidere con problemi già contati`
          }
        />
      )}
      {ai && ai !== "attention" && (
        <Indicator
          icon={ai === "citizen_question" ? MessageCircleQuestion : CheckCheck}
          className={ai === "citizen_question" ? "text-stamp" : "text-ok"}
          count={null}
          label={`Suggerimento dell’AI: ${PRIORITY[ai].badge.toLowerCase()}`}
        />
      )}
      {nothing && <span className="text-ok">Nessuno</span>}
    </span>
  );
}

function Indicator({
  icon: Icon,
  className,
  count,
  label,
}: {
  icon: typeof AlertOctagon;
  className: string;
  count: number | null;
  label: string;
}) {
  return (
    <Tooltip label={label}>
      <span className={cn("tabular inline-flex items-center gap-1 font-medium", className)}>
        <Icon className="size-3.5" aria-hidden />
        {count}
        <span className="sr-only">{label}</span>
      </span>
    </Tooltip>
  );
}

const waitingSince = (days: number) =>
  days === 0 ? "arrivata oggi" : days === 1 ? "arrivata ieri" : `in attesa da ${days} giorni`;

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

// Said as a sentence: «Nessuna pratica: chiuse» read like a form field.
const EMPTY_TITLE: Record<CaseStatus, string> = {
  submitted: "Nessuna pratica da revisionare",
  in_review: "Nessuna pratica in revisione",
  needs_citizen: "Nessuna pratica in attesa del cittadino",
  ready: "Nessuna pratica pronta",
  intake: "Nessuna pratica in compilazione",
  closed: "Nessuna pratica chiusa",
};

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
      title={filtered ? "Nessuna pratica con questi filtri" : EMPTY_TITLE[status]}
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
  // The table as it will be: same band, same columns, same row height, so nothing jumps.
  return (
    <>
      <p role="status" className="sr-only">
        Caricamento delle pratiche…
      </p>
      <div className="overflow-hidden rounded-md bg-surface ring-1 ring-line" aria-hidden>
        <div className="h-9 border-b border-line bg-paper/70 max-md:hidden" />
        <div className="divide-y divide-line">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "grid min-h-18 items-center gap-x-4 gap-y-2 px-4 py-2 md:min-h-14",
                COLUMNS,
              )}
            >
              <div className="grid gap-2">
                <Skeleton className={cn("h-4", i % 2 ? "w-2/5" : "w-1/2")} />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="grid gap-2 max-md:hidden">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-1 max-md:hidden" />
              <Skeleton className="h-3 w-10 max-md:hidden" />
              <Skeleton className="h-3 w-14 justify-self-end max-md:hidden" />
            </div>
          ))}
        </div>
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
