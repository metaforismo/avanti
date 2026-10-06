import { mkdir, open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { repoRoot } from "@avanti/db";
import { exportOrganization } from "./organization-export";
import { AdminCommandFailure } from "./admin-bootstrap";
import {
  adminDatabase,
  passwordPrompt,
  prompt,
  reportAdminFailure,
  requireAdminTerminal,
} from "./admin-terminal";

async function main() {
  requireAdminTerminal();
  if (process.argv.length !== 2)
    throw new AdminCommandFailure(
      "Usa pnpm admin:export senza argomenti: credenziali solo nel terminale.",
    );
  const database = await adminDatabase();
  try {
    const organizationId = await prompt("organizationId del CAF: ");
    const email = await prompt("Email amministratore: ");
    const password = await passwordPrompt();
    const data = await exportOrganization(
      database.db,
      { organizationId, login: { email, password } },
      new Date(),
      process.env.RATE_LIMIT_SECRET ?? "",
    );
    const directory = resolve(repoRoot, ".data/exports");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = resolve(directory, `organization-${crypto.randomUUID()}.json`);
    const file = await open(path, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(data, null, 2) + "\n", "utf8");
      await file.sync();
    } catch (error) {
      await unlink(path);
      throw error;
    } finally {
      await file.close();
    }
    console.info(
      `PASS: export JSON salvato in ${path}. File riservato: trasferiscilo cifrato e applica la retention delle copie.`,
    );
  } finally {
    await database.close();
  }
}
main().catch(reportAdminFailure);
