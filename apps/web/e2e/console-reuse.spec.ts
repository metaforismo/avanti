import { expect, test } from "@playwright/test";
import { logIn, openFirstReadyCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

test("a returning family starts next year's practice from the previous one", async ({ page }) => {
  await logIn(page, ADMIN);
  await openFirstReadyCase(page);
  await page.getByRole("button", { name: /Altro/ }).click();
  await page.getByRole("menuitem", { name: "Nuova pratica per questa famiglia…" }).click();

  const dialog = page.getByRole("dialog", { name: "Nuova pratica per questa famiglia" });
  await expect(dialog.getByText("Chi vive ancora nel nucleo")).toBeVisible();
  // The applicant cannot be dropped; nothing is created before the household is confirmed.
  await expect(dialog.getByRole("checkbox").first()).toBeDisabled();
  await dialog.getByRole("button", { name: "Crea la nuova pratica" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Conferma di aver verificato il nucleo");

  await dialog.getByLabel(/Ho verificato con il cittadino/).check();
  await dialog.getByRole("button", { name: "Crea la nuova pratica" }).click();
  const created = page.getByRole("dialog", { name: "Pratica creata" });
  await expect(created.getByRole("img", { name: /QR code/ })).toBeVisible();
  await created.getByRole("link", { name: "Apri la nuova pratica" }).click();
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
});

test("family search asks for a full identity and says when nobody matches", async ({ page }) => {
  await logIn(page, ADMIN);
  await page.getByRole("button", { name: "Nuova pratica" }).click();
  await page.getByRole("button", { name: /Famiglia già seguita/ }).click();
  await page.getByRole("textbox", { name: "Nome" }).first().fill("Persona");
  await page.getByRole("button", { name: "Cerca" }).click();
  await expect(page.getByText("Scrivi un codice fiscale completo")).toBeVisible();
  await page.getByLabel("Codice fiscale del richiedente").fill("AAAAAA80B10A000A");
  await page.getByRole("button", { name: "Cerca" }).click();
  await expect(page.getByText(/Nessuna pratica per questa persona/)).toBeVisible();
});
