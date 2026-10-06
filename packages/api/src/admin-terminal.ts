import { createInterface } from "node:readline/promises";
import { StringDecoder } from "node:string_decoder";
import { openSync, closeSync, writeSync } from "node:fs";
import { createDatabase, checkDatabase } from "@avanti/db";
import { AdminCommandFailure } from "./admin-bootstrap";

export function requireAdminTerminal() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY)
    throw new AdminCommandFailure(
      "Serve un terminale interattivo privato, senza redirect o log di sessione.",
    );
}
export function requireProductionDatabase(env: Readonly<Record<string, string | undefined>>) {
  if (env.NODE_ENV !== "production")
    throw new AdminCommandFailure(
      "Imposta NODE_ENV=production. Il comando non usa dati demo né fallback locale.",
    );
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2 ||
      !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")
    )
      throw new Error();
  } catch {
    throw new AdminCommandFailure(
      "DATABASE_URL Postgres con TLS obbligatoria. Caricala dal gestore segreti.",
    );
  }
}
export async function adminDatabase() {
  requireProductionDatabase(process.env);
  const database = await createDatabase({ url: process.env.DATABASE_URL, migrate: false });
  try {
    await checkDatabase(database.db);
    return database;
  } catch {
    await database.close();
    throw new AdminCommandFailure(
      "Database non pronto: esegui db:migrate e db:check sul database corretto.",
    );
  }
}
export async function prompt(question: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await readline.question(question);
  } finally {
    readline.close();
  }
}
export async function passwordPrompt(): Promise<string> {
  process.stdout.write("Password admin (input nascosto): ");
  const input = process.stdin;
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();
  try {
    return await new Promise<string>((resolve, reject) => {
      let value = "";
      const decoder = new StringDecoder("utf8");
      const onData = (bytes: Buffer) => {
        for (const character of decoder.write(bytes)) {
          if (character === "\u0003" || character === "\u0004") {
            finish();
            reject(new AdminCommandFailure("Operazione annullata."));
            return;
          }
          if (character === "\r" || character === "\n") {
            finish();
            resolve(value);
            return;
          }
          if (character === "\u007f" || character === "\b")
            value = Array.from(value).slice(0, -1).join("");
          else if (character >= " " && value.length < 200) value += character;
        }
      };
      const finish = () => input.off("data", onData);
      input.on("data", onData);
    });
  } finally {
    input.setRawMode(wasRaw);
    input.pause();
    process.stdout.write("\n");
  }
}
export function openTemporaryPasswordDisplay() {
  // Open before provisioning: a missing controlling terminal must not leave an inaccessible admin.
  const fd = openSync("/dev/tty", "w");
  let shown = false;
  return {
    show(value: string) {
      if (shown) throw new AdminCommandFailure("La password temporanea è già stata mostrata.");
      shown = true;
      writeSync(fd, `Password temporanea (mostrata una sola volta): ${value}\n`);
    },
    close() {
      closeSync(fd);
    },
  };
}
export function reportAdminFailure(error: unknown) {
  console.error(
    error instanceof AdminCommandFailure
      ? error.message
      : "FAIL: operazione non riuscita. Controlla configurazione, permessi e connessione; nessun dettaglio del database è stato stampato.",
  );
  process.exitCode = 1;
}
