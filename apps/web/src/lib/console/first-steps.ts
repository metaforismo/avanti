"use client";

import { useSyncExternalStore } from "react";
import type { CaseStatus, Office } from "@avanti/contracts";

export type FirstStepKey =
  "office" | "poster" | "trial" | "colleagues" | "baseline" | "mfa" | "guide";

/** What the console knows about a new CAF's setup; `undefined` means not loaded yet. */
export type SetupFacts = {
  admin: boolean;
  offices: Pick<Office, "openingHours">[];
  mfaEnabled: boolean;
  counts: Partial<Record<CaseStatus, number>>;
  operators: number | undefined;
  baselineSet: boolean | undefined;
  /** Steps that leave no trace on the server (a printed sign, a guide read), from this browser. */
  marked: ReadonlySet<FirstStepKey>;
};

export type FirstStepState = { key: FirstStepKey; done: boolean };

const ADMIN_STEPS: FirstStepKey[] = ["office", "poster", "trial", "colleagues", "baseline", "mfa"];
const OPERATOR_STEPS: FirstStepKey[] = ["guide", "trial", "poster", "mfa"];

/**
 * The first day lasts until the first dossier reaches the CAF: a test case the team creates (and
 * leaves in «In compilazione») must not hide the steps still to do.
 */
export function isFirstDay(counts: Partial<Record<CaseStatus, number>> | undefined) {
  if (!counts) return false;
  const reached = (["submitted", "in_review", "needs_citizen", "ready", "closed"] as const).reduce(
    (sum, status) => sum + (counts[status] ?? 0),
    0,
  );
  return reached === 0;
}

export function firstSteps(facts: SetupFacts): {
  steps: FirstStepState[];
  done: number;
  /** False while a fact is still loading: the count would jump. */
  known: boolean;
} {
  const doneBy: Record<FirstStepKey, boolean | undefined> = {
    office: facts.offices.length > 0 && facts.offices.every((office) => !!office.openingHours),
    poster: facts.marked.has("poster"),
    trial: Object.values(facts.counts).some((n) => (n ?? 0) > 0),
    colleagues: facts.operators === undefined ? undefined : facts.operators > 1,
    baseline: facts.baselineSet,
    mfa: facts.mfaEnabled,
    guide: facts.marked.has("guide"),
  };
  const keys = facts.admin ? ADMIN_STEPS : OPERATOR_STEPS;
  const steps = keys.map((key) => ({ key, done: doneBy[key] === true }));
  return {
    steps,
    done: steps.filter((step) => step.done).length,
    known: keys.every((key) => doneBy[key] !== undefined),
  };
}

// localStorage: these marks hold no personal data and should survive until the next morning.
const KEY = "avanti:first-steps";
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<FirstStepKey> = new Set();
let cache: { raw: string | null; byOperator: Record<string, FirstStepKey[]> } | null = null;
const snapshots = new Map<string, ReadonlySet<FirstStepKey>>();

function readAll(): Record<string, FirstStepKey[]> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: the marks last until reload.
  }
  if (cache && cache.raw === raw) return cache.byOperator;
  let byOperator: Record<string, FirstStepKey[]> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      byOperator = parsed as Record<string, FirstStepKey[]>;
  } catch {
    // A damaged value starts over.
  }
  cache = { raw, byOperator };
  snapshots.clear();
  return byOperator;
}

export function markFirstStep(operatorId: string, key: FirstStepKey) {
  const all = readAll();
  const mine = all[operatorId] ?? [];
  if (mine.includes(key)) return;
  const next = { ...all, [operatorId]: [...mine, key] };
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // Private mode: keep the mark in memory.
  }
  cache = { raw, byOperator: next };
  snapshots.clear();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useMarkedFirstSteps(operatorId: string): ReadonlySet<FirstStepKey> {
  return useSyncExternalStore(
    subscribe,
    () => {
      const list = readAll()[operatorId];
      if (!Array.isArray(list)) return EMPTY;
      let snapshot = snapshots.get(operatorId);
      if (!snapshot) {
        snapshot = new Set(list);
        snapshots.set(operatorId, snapshot);
      }
      return snapshot;
    },
    () => EMPTY,
  );
}
