"use client";

import { useSyncExternalStore } from "react";
import type { CaseStatus, Office, OperatorSummary } from "@avanti/contracts";

export type FirstStepKey =
  "office" | "poster" | "trial" | "colleagues" | "baseline" | "mfa" | "guide";

const KEYS = new Set<string>([
  "office",
  "poster",
  "trial",
  "colleagues",
  "baseline",
  "mfa",
  "guide",
]);

type Counts = Partial<Record<CaseStatus, number>>;

/**
 * What the console knows about a new CAF's setup. For the admin lists, `undefined` means still
 * loading and `null` that loading failed: a failure counts as "not done" rather than hiding the
 * progress for good.
 */
export type SetupFacts = {
  admin: boolean;
  offices: Pick<Office, "openingHours">[];
  mfaEnabled: boolean;
  counts: Counts;
  operators: Pick<OperatorSummary, "active">[] | null | undefined;
  baselineSet: boolean | null | undefined;
  /** Steps that leave no trace on the server (a printed sign, a guide read), from this browser. */
  marked: ReadonlySet<FirstStepKey>;
};

/** `done` is undefined while its fact is loading: neither ticked nor offered as the next step. */
export type FirstStepState = { key: FirstStepKey; done: boolean | undefined };

// The trial case goes last: once the citizen side sends it, it lands in the queue and the panel
// gives way to it, so every other step should be behind it by then.
const ADMIN_STEPS: FirstStepKey[] = ["office", "poster", "colleagues", "baseline", "mfa", "trial"];
const OPERATOR_STEPS: FirstStepKey[] = ["guide", "poster", "mfa", "trial"];

export function firstSteps(facts: SetupFacts) {
  const doneBy: Record<FirstStepKey, boolean | undefined> = {
    office: facts.offices.length > 0 && facts.offices.every((office) => !!office.openingHours),
    poster: facts.marked.has("poster"),
    trial: Object.values(facts.counts).some((n) => (n ?? 0) > 0),
    // Only colleagues who can still sign in: a deactivated account doesn't staff the office.
    colleagues:
      facts.operators === undefined
        ? undefined
        : (facts.operators ?? []).filter((operator) => operator.active).length > 1,
    baseline: facts.baselineSet === undefined ? undefined : facts.baselineSet === true,
    mfa: facts.mfaEnabled,
    guide: facts.marked.has("guide"),
  };
  const steps: FirstStepState[] = (facts.admin ? ADMIN_STEPS : OPERATOR_STEPS).map((key) => ({
    key,
    done: doneBy[key],
  }));
  const known = steps.every((step) => step.done !== undefined);
  return {
    steps,
    done: steps.filter((step) => step.done).length,
    total: steps.length,
    /** False while a fact is loading: a count or a highlight that jumps reads as an error. */
    known,
    next: known ? steps.find((step) => !step.done)?.key : undefined,
  };
}

/** Dossiers that reached the CAF and are still being worked on. */
const openCases = (counts: Counts) =>
  (["submitted", "in_review", "needs_citizen", "ready"] as const).reduce(
    (sum, status) => sum + (counts[status] ?? 0),
    0,
  );

/** The queue page offers the first steps only while nothing is waiting for the CAF. */
export const queueIsIdle = (counts: Counts | undefined) => !!counts && openCases(counts) === 0;

/**
 * The first day ends with the first real dossier. A dossier still open takes the panel's place
 * anyway; one already archived counts only once the setup is complete, because the trial case is
 * usually sent and archived while setting up. A long-running CAF whose queue empties out keeps
 * the plain empty state unless its setup was never finished.
 */
export function showFirstSteps(counts: Counts, progress: ReturnType<typeof firstSteps>) {
  if (openCases(counts) > 0) return false;
  if (!counts.closed) return true;
  return progress.known && progress.done < progress.total;
}

// localStorage, not sessionStorage: a sign printed or a guide read today is still done
// tomorrow. The marks are step names only, no personal data.
const STORAGE_KEY = "avanti:first-steps";
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<FirstStepKey> = new Set();
let cache: { raw: string | null; byOperator: Record<string, FirstStepKey[]> } | null = null;
const snapshots = new Map<string, ReadonlySet<FirstStepKey>>();

function parse(raw: string | null): Record<string, FirstStepKey[]> {
  const byOperator: Record<string, FirstStepKey[]> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return byOperator;
    for (const [id, list] of Object.entries(parsed)) {
      if (Array.isArray(list))
        byOperator[id] = list.filter((key): key is FirstStepKey => KEYS.has(key));
    }
  } catch {
    // A damaged value starts over.
  }
  return byOperator;
}

function readAll(): Record<string, FirstStepKey[]> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the marks last until reload.
    if (cache) return cache.byOperator;
  }
  if (cache && cache.raw === raw) return cache.byOperator;
  cache = { raw, byOperator: parse(raw) };
  snapshots.clear();
  return cache.byOperator;
}

export function readMarks(operatorId: string): ReadonlySet<FirstStepKey> {
  const list = readAll()[operatorId];
  if (!list?.length) return EMPTY;
  let snapshot = snapshots.get(operatorId);
  if (!snapshot) {
    snapshot = new Set(list);
    snapshots.set(operatorId, snapshot);
  }
  return snapshot;
}

export function markFirstStep(operatorId: string, key: FirstStepKey) {
  const all = readAll();
  const mine = all[operatorId] ?? [];
  if (mine.includes(key)) return;
  const next = { ...all, [operatorId]: [...mine, key] };
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Private mode: keep the mark in memory.
  }
  cache = { raw, byOperator: next };
  snapshots.clear();
  for (const listener of listeners) listener();
}

/** Marks made here, and in another tab (the `storage` event), both refresh the panel. */
export function subscribeMarks(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useMarkedFirstSteps(operatorId: string): ReadonlySet<FirstStepKey> {
  return useSyncExternalStore(
    subscribeMarks,
    () => readMarks(operatorId),
    () => EMPTY,
  );
}
