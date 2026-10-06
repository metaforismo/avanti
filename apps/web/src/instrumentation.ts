/**
 * Clean database shutdown for a supervised Node deployment (not Vercel). Next handles signals
 * itself unless NEXT_MANUAL_SIG_HANDLE=1; the host or proxy must drain traffic first.
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL !== "1" &&
    process.env.NEXT_MANUAL_SIG_HANDLE === "1"
  ) {
    const { closeDatabaseOnSignals } = await import("./instrumentation-node");
    closeDatabaseOnSignals();
  }
}
