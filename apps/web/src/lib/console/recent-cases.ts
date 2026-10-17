"use client";

import { useSyncExternalStore } from "react";

export type RecentCase = {
  /** Whose list this is: another operator signing in on the same browser never sees it. */
  operatorId: string;
  id: string;
  reference: string;
  name: string | null;
  practice: string | null;
};

// sessionStorage, not localStorage: on a desk computer shared between operators the list goes
// away with the browser session and is cleared at logout, so names do not linger.
const KEY = "avanti:recent-cases";
const MAX = 6;
const listeners = new Set<() => void>();
let cache: RecentCase[] | null = null;

function read(): RecentCase[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? (parsed as RecentCase[]).slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: RecentCase[]) {
  cache = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or storage full: the list simply lasts until reload.
  }
  for (const listener of listeners) listener();
}

export function rememberCase(entry: RecentCase) {
  const mine = read().filter((c) => c.operatorId === entry.operatorId && c.id !== entry.id);
  write([entry, ...mine].slice(0, MAX));
}

/** A case that no longer exists (deleted, erased with its family) leaves the list. */
export function forgetCase(id: string) {
  const all = read();
  if (all.some((c) => c.id === id)) write(all.filter((c) => c.id !== id));
}

export function forgetRecentCases() {
  write([]);
  try {
    sessionStorage.removeItem(QUEUE_KEY);
  } catch {
    // Nothing stored.
  }
}

// The queue the operator last looked at (tab, filters, search), so «← Pratiche» on a dossier
// goes back to it instead of the default tab. Same storage and lifetime as the list above.
const QUEUE_KEY = "avanti:queue";
// One-off notices the queue shows after a deletion: never worth showing again.
const TRANSIENT = ["eliminata", "famiglia"];

export function rememberQueue(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const key of TRANSIENT) next.delete(key);
  try {
    sessionStorage.setItem(QUEUE_KEY, next.toString());
  } catch {
    // Without storage the link goes to the default queue, as before.
  }
}

const noQueue = () => () => {};
const readQueue = () => {
  try {
    return sessionStorage.getItem(QUEUE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Where «← Pratiche» leads: the queue as the operator left it. */
export function useQueueHref() {
  const search = useSyncExternalStore(noQueue, readQueue, () => "");
  return search ? `/console?${search}` : "/console";
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const empty: RecentCase[] = [];

export function useRecentCases(operatorId: string) {
  const all = useSyncExternalStore(subscribe, read, () => empty);
  return all.filter((entry) => entry.operatorId === operatorId);
}
