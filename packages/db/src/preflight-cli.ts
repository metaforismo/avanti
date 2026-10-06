import { preflight } from "./preflight";

const args = process.argv.slice(2);
if (
  args.some((arg) => !["--local", "--production"].includes(arg)) ||
  (args.includes("--local") && args.includes("--production"))
) {
  console.error("FAIL: usa pnpm preflight [--production | --local].");
  process.exitCode = 1;
} else {
  const production =
    !args.includes("--local") ||
    process.env.NODE_ENV === "production" ||
    !!process.env.VERCEL ||
    !!process.env.VERCEL_ENV;
  const issues = preflight(process.env, production);
  for (const issue of issues)
    console.info(
      `${{ error: "FAIL", warning: "AVVISO", ok: "PASS" }[issue.level]}: ${issue.message}`,
    );
  const failed = issues.some((issue) => issue.level === "error");
  console.info(
    failed
      ? "FAIL: configurazione incompleta; rilascio bloccato."
      : `PASS: preflight ${production ? "produzione" : "locale"} completato. Risorse e backup richiedono prove sul provider.`,
  );
  process.exitCode = failed ? 1 : 0;
}
