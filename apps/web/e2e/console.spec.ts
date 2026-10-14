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

test("marking a case ready with missing documents asks first", async ({ page }) => {
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.getByRole("link", { name: /Persona Esempio 8/ }).click();
  await expect(page.getByText(/Mancano \d+ documenti obbligatori/).first()).toBeVisible();

  await page.getByRole("button", { name: "Segna come pronta" }).click();
  const confirm = page.getByRole("dialog", { name: /Segnare come pronta/ });
  await expect(confirm).toContainText(/Mancano \d+ documenti obbligatori/);
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  // Nothing happened: the case is still waiting for review.
  await expect(page.getByText("Da revisionare", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Segna come pronta" })).toBeFocused();
});

test("a CAF's first day shows how to get the first dossier", async ({ page }) => {
  // An empty queue in every state, as right after the CAF is set up.
  await page.route(/\/api\/cases\?/, (route) =>
    route.fulfill({
      json: {
        items: [],
        nextCursor: null,
        counts: { submitted: 0, in_review: 0, needs_citizen: 0, ready: 0, intake: 0, closed: 0 },
      },
    }),
  );
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Accedi" }).click();

  const steps = page.getByRole("region", { name: "Per iniziare" });
  await expect(steps.getByRole("listitem")).toHaveCount(5);
  await steps.getByRole("button", { name: "Crea una pratica di prova" }).click();
  await expect(page.getByRole("dialog", { name: "Nuova pratica" })).toBeVisible();
});

test("a ready case opens the DSU sheet, ready to copy into the CAF's software", async ({
  page,
}) => {
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.getByRole("button", { name: /^Pronte/ }).click();
  await page.waitForURL(/stato=ready/);
  await page.locator('a[href^="/console/pratiche/"]').first().click();

  const sheet = page.locator("details", { hasText: "Prospetto DSU" });
  await expect(sheet.getByRole("region", { name: "Quadro A" }).first()).toBeVisible();
  await sheet.getByRole("button", { name: "Da copiare" }).click();
  await expect(sheet.getByRole("button", { name: /^Copia Nome$/ }).first()).toBeVisible();
  await expect(sheet.getByText("Manca", { exact: true })).toHaveCount(0);
});

test("a lost citizen link is replaced and the old one stops working", async ({ page, browser }) => {
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.getByRole("button", { name: "Nuova pratica" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Crea/ }).click();
  const oldLink = (await page.getByRole("dialog").locator("[translate=no]").innerText()).trim();
  await page.getByRole("link", { name: "Apri il fascicolo" }).click();

  await page.getByRole("button", { name: "Altro" }).click();
  await page.getByRole("menuitem", { name: "Nuovo link per il cittadino…" }).click();
  await page.getByRole("button", { name: "Crea il nuovo link" }).click();
  const issued = page.getByRole("dialog", { name: "Nuovo link creato" });
  const newLink = (await issued.locator("[translate=no]").innerText()).trim();
  expect(newLink).not.toBe(oldLink);
  await expect(issued.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    /nuovo%20link/,
  );

  const citizen = await (await browser.newContext({ locale: "it-IT" })).newPage();
  await citizen.goto(oldLink);
  await expect(citizen.getByRole("heading", { level: 1 })).toContainText(/non valido|scadut/i);
  await citizen.goto(newLink);
  await expect(citizen.getByRole("heading", { name: "Cosa devi fare?" })).toBeVisible();
});
