export function demoSeedAllowed(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.NODE_ENV === "production" || env.VERCEL || env.VERCEL_ENV) return false;
  if (!env.DATABASE_URL?.trim()) return true;
  if (env.AVANTI_LOCAL_PG_SEED !== "1") return false;
  try {
    const url = new URL(env.DATABASE_URL);
    // Explicit opt-in only for disposable loopback DBs; query options can override host.
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname) &&
      /^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
export function assertDemoSeedAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!demoSeedAllowed(env))
    throw new Error(
      "Demo seed is disabled in production or remote databases; use local PGlite or opt in with AVANTI_LOCAL_PG_SEED=1 on a loopback *_test database",
    );
}
