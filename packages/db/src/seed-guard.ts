export function demoSeedAllowed(env: Readonly<Record<string, string | undefined>>): boolean {
  // Demo files live on local disk; never provision demo credentials into a remote database.
  return (
    env.NODE_ENV !== "production" && !env.VERCEL && !env.VERCEL_ENV && !env.DATABASE_URL?.trim()
  );
}
export function assertDemoSeedAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!demoSeedAllowed(env))
    throw new Error(
      "Demo seed is disabled in production or with DATABASE_URL; use local PGlite only",
    );
}
