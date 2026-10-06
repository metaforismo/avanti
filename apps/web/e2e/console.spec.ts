import { expect, test } from "@playwright/test";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };
const ADMIN = { email: "admin@demo.avanti.local", password: DEMO.password };

test("an operator logs in, opens a dossier and sees what to check", async ({ page }) => {
  await page.goto("/console");
  await page.waitForURL(/\/console\/accedi/);

  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();

  await page.getByRole("button", { name: /^Pronte/ }).click();
  await page.locator('a[href^="/console/pratiche/"]').first().click();
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
  await expect(page.getByText("Cronologia")).toBeVisible();
});

test("the console redirects to login and back after the session expires", async ({ page }) => {
  await page.goto("/console/metriche");
  await expect(page).toHaveURL(/next=%2Fconsole%2Fmetriche/);
});

test("an admin adds an operator, who must choose a password at first login", async ({ page }) => {
  const email = `e2e.${Date.now()}@demo.avanti.local`;
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();

  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Aggiungi operatore" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome e cognome").fill("Operatrice E2E");
  await form.getByLabel("Email di lavoro").fill(email);
  await form.getByRole("button", { name: /Crea/ }).click();

  const issued = page.getByRole("dialog", { name: "Password temporanea" });
  const temporary = (await issued.locator("[translate=no]").innerText()).trim();
  expect(temporary.length).toBeGreaterThanOrEqual(12);
  await issued.getByRole("button", { name: "Fatto" }).click();
  await page.getByRole("button", { name: "Esci" }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(temporary);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Scegli la tua password" })).toBeVisible();

  await page.getByLabel("Password attuale").fill(temporary);
  await page.getByLabel("Nuova password", { exact: true }).fill("una frase lunga per e2e");
  await page.getByLabel("Ripeti la nuova password").fill("una frase lunga per e2e");
  await page.getByRole("button", { name: "Salva ed entra" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  // Operators don't administer the CAF.
  await expect(page.getByRole("link", { name: "Impostazioni" })).toHaveCount(0);
});
