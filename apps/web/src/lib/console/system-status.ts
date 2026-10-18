import type { SystemStatus } from "@avanti/contracts";

// Nothing broken, just nothing happened yet: the daily jobs haven't had their first run, no
// citizen has used the AI. On a CAF's first day the page would otherwise read as a fault.
const NOT_STARTED = new Set<string>(["never_run", "no_observations"]);

/** True when every warning on the page only says "not started yet". */
export function onlyNotStarted(data: SystemStatus) {
  if (data.status !== "attention") return false;
  const warnings = Object.values(data.components).filter((c) => c.status !== "ok");
  const countersOk = Object.values(data.counters).every((c) => c.status === "ok");
  return countersOk && warnings.length > 0 && warnings.every((c) => NOT_STARTED.has(c.code));
}
