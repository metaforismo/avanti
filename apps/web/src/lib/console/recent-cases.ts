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
