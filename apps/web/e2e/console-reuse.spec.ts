import { expect, test } from "@playwright/test";
import { logIn, openCase, submittedCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

test("a returning family starts next year's practice from the previous one", async ({ page }) => {
  await logIn(page, ADMIN);
  // Its own family: a new practice for a demo family would move it out of the renewals to send.
  const { id } = await submittedCase(
    page,
    { firstName: "Famiglia", lastName: "Ritorno" },
    { files: 0 },
  );
  await openCase(page, id);
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

test("the new practice can be created before the list of practices arrives", async ({ page }) => {
  // The list is held back until after the click: an empty choice used to send no practice.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/practices\?lang=it$/, async (route) => {
    await held;
    await route.fallback();
  });
  await logIn(page, ADMIN);
  // Its own family, as in the test above.
  const { id } = await submittedCase(
    page,
    { firstName: "Famiglia", lastName: "Senza elenco" },
    { files: 0 },
  );
  await openCase(page, id);
  await page.getByRole("button", { name: /Altro/ }).click();
  await page.getByRole("menuitem", { name: "Nuova pratica per questa famiglia…" }).click();

  const dialog = page.getByRole("dialog", { name: "Nuova pratica per questa famiglia" });
  await dialog.getByLabel(/Ho verificato con il cittadino/).check();
  await dialog.getByRole("button", { name: "Crea la nuova pratica" }).click();
  await expect(
    page.getByRole("dialog", { name: "Pratica creata" }).getByRole("img", { name: /QR code/ }),
  ).toBeVisible();
  release();
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
