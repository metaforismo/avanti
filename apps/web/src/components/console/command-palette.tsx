"use client";

import { CornerDownLeft, FileText, History, Plus, Search, type LucideIcon } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import type { CaseListResponse } from "@avanti/contracts";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { CASE_STATUS, PRACTICE_SHORT } from "@/lib/console/labels";
import { useRecentCases } from "@/lib/console/recent-cases";
import { cn } from "@/lib/cn";

export type PaletteLink = { href: Route; label: string; icon: LucideIcon };

type Item = {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon: LucideIcon;
  run: () => void;
};

/**
 * Jump to a case by name or code, or to any page, without the mouse: ⌘K / Ctrl+K anywhere in
 * the console. A combobox over a listbox, so screen readers follow the highlighted result.
 */
export function CommandPalette({
  open,
  onOpenChange,
  pages,
  onNewCase,
  operatorId,
}: {
  operatorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: PaletteLink[];
  onNewCase: () => void;
}) {
  const router = useRouter();
  const recent = useRecentCases(operatorId);
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<CaseListResponse["items"] | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const term = query.trim();

  // One request per pause in typing; only the latest answer counts.
  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      apiFetch<CaseListResponse>(`/api/cases?q=${encodeURIComponent(term)}&limit=6`)
        .then((page) => !cancelled && setCases(page.items))
        .catch(() => !cancelled && setCases([]))
        .finally(() => !cancelled && setSearching(false));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setCases(null);
    setActive(0);
  };
  const go = (href: Route) => {
    close();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const lower = term.toLowerCase();
    const list: Item[] = [];
    if (term.length >= 2)
      for (const c of cases ?? [])
        list.push({
          id: `case:${c.id}`,
          group: "Pratiche",
          label: c.citizenName ?? "Cittadino senza nome",
          detail: [
            c.reference,
            c.practice ? PRACTICE_SHORT[c.practice.id] : null,
            CASE_STATUS[c.status].label,
          ]
            .filter(Boolean)
            .join(" · "),
          icon: FileText,
          run: () => go(`/console/pratiche/${c.id}` as Route),
        });
    if (!term)
      for (const c of recent)
        list.push({
          id: `recent:${c.id}`,
          group: "Aperte di recente",
          label: c.name ?? "Cittadino senza nome",
          detail: [c.reference, c.practice].filter(Boolean).join(" · "),
          icon: History,
          run: () => go(`/console/pratiche/${c.id}` as Route),
        });
    if (!term || "nuova pratica".includes(lower))
      list.push({
        id: "action:new",
        group: "Azioni",
        label: "Nuova pratica",
        detail: "Crea un link per un cittadino allo sportello",
        icon: Plus,
        run: () => {
          close();
          onNewCase();
        },
      });
    for (const page of pages)
      if (!term || page.label.toLowerCase().includes(lower))
        list.push({
          id: `page:${page.href}`,
          group: "Vai a",
          label: page.label,
          icon: page.icon,
          run: () => go(page.href),
        });
    return list;
    // `go` and `close` only close over stable setters and the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, cases, recent, pages]);

  const current = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  let lastGroup = "";
  return (
    <Primitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim backdrop-blur-[2px]" />
        <Primitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-[12dvh] z-50 mx-auto max-w-xl animate-pop overflow-hidden rounded-xl bg-surface shadow-float ring-1 ring-line outline-none"
        >
          <Primitive.Title className="sr-only">Cerca nella console</Primitive.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            {searching ? (
              <Spinner className="size-5 text-ink-3" />
            ) : (
              <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
            )}
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={items[current] ? `${listId}-${current}` : undefined}
              aria-label="Cerca pratiche e pagine"
              value={query}
              placeholder="Cerca una pratica per nome o codice, o una pagina…"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                if (e.target.value.trim().length < 2) setCases(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  items[current]?.run();
                }
              }}
              className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
            />
            <kbd className="hidden rounded-xs px-1.5 font-mono text-xs text-ink-3 ring-1 ring-line-strong sm:block">
              Esc
            </kbd>
          </div>
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            aria-label="Risultati"
            className="max-h-[60dvh] overflow-y-auto p-2"
          >
            {items.length === 0 && (
              <li role="presentation" className="px-3 py-8 text-center text-ink-3">
                {searching ? "Cerco…" : "Nessun risultato. Prova con il cognome o il codice AV-…"}
              </li>
            )}
            {items.map((item, index) => {
              const heading = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <li key={item.id} role="presentation">
                  {heading && (
                    <p
                      role="presentation"
                      className="px-3 pt-3 pb-1.5 text-xs font-semibold text-ink-3"
                    >
                      {heading}
                    </p>
                  )}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === current}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={item.run}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5",
                      index === current ? "bg-stamp-wash" : "",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4.5 shrink-0",
                        index === current ? "text-stamp" : "text-ink-3",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.label}</span>
                      {item.detail && (
                        <span className="block truncate text-sm text-ink-3">{item.detail}</span>
                      )}
                    </span>
                    {index === current && (
                      <CornerDownLeft className="rtl-flip size-4 shrink-0 text-ink-3" aria-hidden />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
