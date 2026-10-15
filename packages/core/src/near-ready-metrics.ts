import type { NearReadyPilotGroup } from "@avanti/contracts";

// Invert binomial tails in log space. This is the exact binomial construction,
// not the normal approximation (including at zero observed failures).
function tail(n: number, k: number, p: number, upper: boolean): number {
  if (p <= 0) return upper ? Number(k <= 0) : 1;
  if (p >= 1) return upper ? 1 : Number(k >= n);
  let logProbability = n * Math.log1p(-p),
    sum = 0;
  for (let x = 0; x <= n; x++) {
    if (upper ? x >= k : x <= k) sum += Math.exp(logProbability);
    if (x < n) logProbability += Math.log(n - x) - Math.log(x + 1) + Math.log(p) - Math.log1p(-p);
  }
  return Math.min(1, sum);
}
function bound(n: number, k: number, alpha: number, lower: boolean) {
  if (lower && k === 0) return 0;
  if (!lower && k === n) return 1;
  let lo = 0,
    hi = 1;
  for (let j = 0; j < 65; j++) {
    const mid = (lo + hi) / 2;
    const probability = tail(n, k, mid, lower);
    if (lower ? probability > alpha : probability < alpha) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
export function clopperPearson(successes: number, trials: number) {
  if (
    !Number.isInteger(trials) ||
    !Number.isInteger(successes) ||
    trials < 0 ||
    successes < 0 ||
    successes > trials
  )
    throw new RangeError("Invalid binomial counts");
  if (!trials) return null;
  return {
    lower: bound(trials, successes, 0.025, true),
    upper: bound(trials, successes, 0.025, false),
    oneSidedLower95: bound(trials, successes, 0.05, true),
  };
}
export type PilotObservation = {
  caseId: string;
  language: string;
  reading: NearReadyPilotGroup["reading"];
  selected: boolean;
  ready: boolean | null;
  criticalError: boolean;
  durationMinutes: number | null;
};
function distribution(values: number[]) {
  const sorted = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length,
    medianMinutes: sorted.length
      ? sorted.length % 2
        ? sorted[middle]!
        : (sorted[middle - 1]! + sorted[middle]!) / 2
      : null,
    p95Minutes: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1]! : null,
  };
}
export function nearReadyPilotGroup(
  rows: PilotObservation[],
  language = "all",
  reading: NearReadyPilotGroup["reading"] = "mixed",
): NearReadyPilotGroup {
  const selected = rows.filter((r) => r.selected),
    reviewed = selected.filter((r) => r.ready !== null);
  const correct = reviewed.filter((r) => r.ready && !r.criticalError).length;
  const times = (select: boolean) =>
    rows
      .filter((r) => r.selected === select && r.ready !== null && r.durationMinutes !== null)
      .map((r) => r.durationMinutes!);
  return {
    language,
    reading,
    evaluated: rows.length,
    selected: selected.length,
    selectionRate: rows.length ? selected.length / rows.length : null,
    reviewedSelected: reviewed.length,
    correctSelected: correct,
    falseNearReady: reviewed.length - correct,
    criticalErrors: rows.filter((r) => r.criticalError).length,
    missedOpportunities: rows.filter((r) => !r.selected && r.ready === true).length,
    precision: reviewed.length ? correct / reviewed.length : null,
    precisionInterval: clopperPearson(correct, reviewed.length),
    suggestedReview: distribution(times(true)),
    ordinaryReview: distribution(times(false)),
  };
}
