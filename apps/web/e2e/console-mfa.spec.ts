import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };
const PASSWORD = "una frase lunga per la verifica";

/** RFC 6238 with the parameters Avanti uses: SHA-1, 6 digits, 30-second steps. */
function totp(base32: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32.replace(/\s+/g, "")) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** A fresh operator, so enabling two-step verification never touches the demo accounts. */
async function newOperator(page: Page, baseURL: string) {
  await logIn(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  const email = `mfa.${Date.now()}@demo.avanti.local`;
  const created = await page.request.post("/api/operators", {
    headers: { Origin: baseURL },
    data: { name: "Operatrice MFA", email, role: "operator" },
  });
  expect(created.ok()).toBe(true);
  const { temporaryPassword } = (await created.json()) as { temporaryPassword: string };
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/console\/accedi/);

  await logIn(page, { email, password: temporaryPassword });
  await page.getByLabel("Password attuale").fill(temporaryPassword);
  await page.getByLabel("Nuova password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Ripeti la nuova password").fill(PASSWORD);
  await page.getByRole("button", { name: "Salva ed entra" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  return email;
}

test("an operator turns on two-step verification and signs in with a recovery code", async ({
  page,
  baseURL,
}) => {
  test.slow();
  const email = await newOperator(page, baseURL!);

  await page.goto("/console/account");
  const section = page.getByRole("region", { name: "Verifica in due passaggi" });
  await section.getByRole("button", { name: "Attiva" }).click();
  await section.getByLabel("La tua password").fill(PASSWORD);
  await section.getByRole("button", { name: "Continua" }).click();
  await expect(section.getByRole("img", { name: /Codice QR/ })).toBeVisible();
  await section.getByText("Non puoi inquadrarlo?").click();
  const secret = (await section.locator("[translate=no]").first().innerText()).trim();

  await section.getByLabel("Codice dell'app").fill("000000");
  await section.getByRole("button", { name: "Attiva" }).click();
  await expect(section.getByRole("alert")).toContainText("non corrisponde");
  await section.getByLabel("Codice dell'app").fill(totp(secret));
  await section.getByRole("button", { name: "Attiva" }).click();

  const codes = section.getByRole("list", { name: "Codici di recupero" }).getByRole("listitem");
  await expect(codes).toHaveCount(10);
  const recovery = (await codes.first().innerText()).trim();
  const done = section.getByRole("button", { name: "Fatto" });
  await expect(done).toBeDisabled();
  await section.getByLabel("Ho salvato i codici in un posto sicuro").check();
  await done.click();
  await expect(section.getByText("Ti restano 10 codici di recupero.")).toBeVisible();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/console\/accedi/);
  await logIn(page, { email, password: PASSWORD });
  await expect(page.getByLabel("Codice dell'app")).toBeVisible();
  // The six digits just used for setup cannot be replayed; the recovery code works once.
  await page.getByRole("button", { name: /Usa un codice di recupero/ }).click();
  await page.getByLabel("Codice di recupero").fill(recovery.toUpperCase());
  await page.getByRole("button", { name: "Verifica ed entra" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();

  await page.goto("/console/account");
  await expect(page.getByText("Ti restano 9 codici di recupero.")).toBeVisible();
});

test("a reload between password and code asks for the code, and Annulla signs out", async ({
  page,
  baseURL,
}) => {
  test.slow();
  const email = await newOperator(page, baseURL!);
  await page.goto("/console/account");
  const section = page.getByRole("region", { name: "Verifica in due passaggi" });
  await section.getByRole("button", { name: "Attiva" }).click();
  await section.getByLabel("La tua password").fill(PASSWORD);
  await section.getByRole("button", { name: "Continua" }).click();
  await section.getByText("Non puoi inquadrarlo?").click();
  const secret = (await section.locator("[translate=no]").first().innerText()).trim();
  await section.getByLabel("Codice dell'app").fill(totp(secret));
  await section.getByRole("button", { name: "Attiva" }).click();
  await section.getByLabel("Ho salvato i codici in un posto sicuro").check();
  await section.getByRole("button", { name: "Fatto" }).click();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/console\/accedi/);
  await logIn(page, { email, password: PASSWORD });
  await expect(page.getByLabel("Codice dell'app")).toBeVisible();
  await page.goto("/console");
  await expect(page.getByRole("heading", { name: "Verifica in due passaggi" })).toBeVisible();
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(page).toHaveURL(/\/console\/accedi/);
});

test("an administrator without two-step verification cannot require it for everyone", async ({
  page,
}) => {
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Verifica in due passaggi obbligatoria/ }),
  ).toBeDisabled();
  await expect(page.getByText("Prima attivala per te dalla pagina Account")).toBeVisible();
});
