import { demoSeedAllowed } from "./seed-guard";

export type PreflightIssue = { level: "error" | "warning" | "ok"; message: string };

// This is a conservative strength check, not proof that a secret was randomly generated.
export function strongSecret(value: string): boolean {
  if (value !== value.trim() || value.length < 32 || /\s/.test(value)) return false;
  if (/^[a-f\d]+$/i.test(value) && value.length < 64) return false;
  for (let period = 1; period <= value.length / 2; period++) {
    if (
      value.length % period === 0 &&
      value.slice(0, period).repeat(value.length / period) === value
    )
      return false;
  }
  const counts = new Map<string, number>();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  const bits = [...counts.values()].reduce(
    (sum, count) => sum - count * Math.log2(count / value.length),
    0,
  );
  return (
    counts.size >= 12 && bits >= 192 && !/(demo|example|changeme|password|secret)/i.test(value)
  );
}

export function databaseRegion(hostname: string): string | null {
  if (hostname.endsWith(".neon.tech"))
    return (
      hostname
        .match(/(?:^|\.)(aws|azure)-([a-z]+-[a-z]+-\d+)(?:\.|$)/)?.[0]
        ?.replace(/^\.|\.$/g, "") ?? null
    );
  if (hostname.endsWith(".pooler.supabase.com"))
    return hostname.match(/(?:^|\.)aws-\d+-([a-z]+-[a-z]+-\d+)\./)?.[1] ?? null;
  return null;
}

export function preflight(
  env: Readonly<Record<string, string | undefined>>,
  production = true,
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const add = (level: PreflightIssue["level"], message: string) => issues.push({ level, message });
  const required = [
    "DATABASE_URL",
    "BLOB_READ_WRITE_TOKEN",
    "PUBLIC_APP_URL",
    "RATE_LIMIT_SECRET",
    "CRON_SECRET",
  ];
  for (const key of required)
    if (!env[key]?.trim())
      add(
        production ? "error" : "warning",
        `${key}: ${production ? "obbligatoria in produzione" : "assente, fallback locale disponibile"}.`,
      );
  if (env.DATABASE_URL?.trim()) {
    try {
      const db = new URL(env.DATABASE_URL);
      if (
        !["postgres:", "postgresql:"].includes(db.protocol) ||
        !db.hostname ||
        !db.username ||
        db.pathname.length < 2 ||
        db.hash
      )
        throw new Error();
      add("ok", "DATABASE_URL: formato Postgres valido (nessun tentativo di connessione).");
      if (
        production &&
        !["require", "verify-ca", "verify-full"].includes(db.searchParams.get("sslmode") ?? "")
      )
        add(
          "error",
          "DATABASE_URL: specifica TLS con sslmode=require o verify-full secondo il provider.",
        );
      const region = databaseRegion(db.hostname);
      if (region)
        add(
          region.endsWith("eu-central-1") ? "ok" : "warning",
          `Regione DB ricavata: ${region}. ${region.endsWith("eu-central-1") ? "Frankfurt." : "Verifica residenza UE e coerenza con Functions fra1."}`,
        );
      else
        add("warning", "Regione DB non ricavabile: verifica Frankfurt nel dashboard del provider.");
    } catch {
      add("error", "DATABASE_URL: URL Postgres non valida; controlla host, utente e database.");
    }
  }
  if (env.PUBLIC_APP_URL?.trim()) {
    try {
      const value = env.PUBLIC_APP_URL;
      const url = new URL(value);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        value.endsWith("/") ||
        value !== value.trim()
      )
        throw new Error();
      if (
        production &&
        (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      )
        throw new Error();
      add("ok", "PUBLIC_APP_URL: origine valida, senza slash finale.");
    } catch {
      add(
        "error",
        "PUBLIC_APP_URL: usa l'origine HTTPS pubblica, senza path, credenziali, query o slash finale.",
      );
    }
  }
  for (const key of ["RATE_LIMIT_SECRET", "CRON_SECRET"]) {
    const value = env[key];
    if (value?.trim() && !strongSecret(value))
      add(
        production ? "error" : "warning",
        `${key}: forza insufficiente; genera almeno 32 byte casuali (64 cifre esadecimali).`,
      );
  }
  if (env.RATE_LIMIT_SECRET && env.RATE_LIMIT_SECRET === env.CRON_SECRET)
    add("error", "RATE_LIMIT_SECRET e CRON_SECRET: usa due segreti diversi.");
  if (!env.AI_GATEWAY_API_KEY?.trim())
    add(
      "warning",
      "AI_GATEWAY_API_KEY: opzionale assente; analisi e intervista useranno il fallback euristico.",
    );
  if (production) {
    if (demoSeedAllowed(env))
      add(
        "error",
        "Seed demo eseguibile: configura DATABASE_URL e usa NODE_ENV=production per i comandi amministrativi.",
      );
    else add("ok", "Seed demo bloccato prima di aprire il database.");
    if (env.NEXT_PUBLIC_DEMO_OFFICE_SLUG?.trim())
      add("error", "NEXT_PUBLIC_DEMO_OFFICE_SLUG: rimuovi lo sportello demo dalla produzione.");
    if (env.VERCEL !== "1" && env.TRUST_PROXY !== "1")
      add(
        "warning",
        "Host Node: configura un proxy fidato o il trasporto socket; il runtime Fetch rifiuta IP non identificabili.",
      );
  }
  return issues;
}
