import { bootstrapOrganization } from "./admin-bootstrap";
import {
  adminDatabase,
  prompt,
  reportAdminFailure,
  requireAdminTerminal,
  openTemporaryPasswordDisplay,
} from "./admin-terminal";

async function main() {
  requireAdminTerminal();
  if (process.argv.length !== 2) throw new Error("Unexpected arguments");
  const display = openTemporaryPasswordDisplay();
  try {
    const database = await adminDatabase();
    try {
      const input = {
        organization: {
          name: await prompt("Nome organizzazione: "),
          kind: await prompt("Tipo (caf/patronato/studio): "),
        },
        office: {
          name: await prompt("Nome sportello: "),
          slug: await prompt("Slug sportello (es. caf-roma-centro): "),
          address: await prompt("Indirizzo: "),
          city: await prompt("Città: "),
        },
        admin: {
          name: await prompt("Nome amministratore: "),
          email: await prompt("Email amministratore: "),
        },
        confirmation: await prompt("Per creare il primo CAF scrivi CREA CAF PILOTA: "),
      };
      const result = await bootstrapOrganization(database.db, input, new Date());
      console.info(
        `PASS: CAF creato. organizationId: ${result.organizationId}. Al primo accesso è obbligatorio cambiare password.`,
      );
      display.show(result.temporaryPassword);
    } finally {
      await database.close();
    }
  } finally {
    display.close();
  }
}
main().catch(reportAdminFailure);
