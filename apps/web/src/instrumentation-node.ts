import { closeRuntimeDatabase } from "@avanti/api";

/** Node only: imported by instrumentation.ts, never bundled for the Edge runtime. */
export function closeDatabaseOnSignals() {
  const key = Symbol.for("avanti.shutdown.handlers");
  const state = globalThis as Record<symbol, boolean | undefined>;
  if (state[key]) return;
  state[key] = true;

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    closeRuntimeDatabase().then(
      () => process.exit(0),
      () => {
        console.error(JSON.stringify({ event: "database_shutdown_failed" }));
        process.exit(1);
      },
    );
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
