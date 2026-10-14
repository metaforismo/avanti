import { expect, test } from "@playwright/test";
import { logIn, openFirstReadyCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };
const ADMIN = { email: "admin@demo.avanti.local", password: DEMO.password };

test("an operator logs in, opens a dossier and sees what to check", async ({ page }) => {
  await page.goto("/console");
  await page.waitForURL(/\/console\/accedi/);

  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password", { exact: true }).fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();

  await openFirstReadyCase(page);
  await expect(page.getByText("Cronologia")).toBeVisible();
});

test("the console redirects to login and back after the session expires", async ({ page }) => {
  await page.goto("/console/metriche");
  await expect(page).toHaveURL(/next=%2Fconsole%2Fmetriche/);
});

test("an admin adds an operator, who must choose a password at first login", async ({ page }) => {
  const email = `e2e.${Date.now()}@demo.avanti.local`;
  await page.goto("/console/accedi");
  await logIn(page, ADMIN);
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
  await expect(page).toHaveURL(/\/console\/accedi/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(temporary);
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
  await logIn(page, DEMO);
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
  await logIn(page, ADMIN);

  const steps = page.getByRole("region", { name: "Per iniziare" });
  await expect(steps.getByRole("listitem")).toHaveCount(5);
  await steps.getByRole("button", { name: "Crea una pratica di prova" }).click();
  await expect(page.getByRole("dialog", { name: "Nuova pratica" })).toBeVisible();
});

test("a ready case opens the DSU sheet, ready to copy into the CAF's software", async ({
  page,
}) => {
  await page.goto("/console/accedi");
  await logIn(page, DEMO);
  await openFirstReadyCase(page);

  const sheet = page.locator("details", { hasText: "Prospetto DSU" });
  await expect(sheet.getByRole("region", { name: "Quadro A" }).first()).toBeVisible();
  await sheet.getByRole("button", { name: "Da copiare" }).click();
  await expect(sheet.getByRole("button", { name: /^Copia Nome$/ }).first()).toBeVisible();
  await expect(sheet.getByText("Manca", { exact: true })).toHaveCount(0);
});

test("a lost citizen link is replaced and the old one stops working", async ({ page, browser }) => {
  await page.goto("/console/accedi");
  await logIn(page, DEMO);
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

test("two operators on the same case: the second one sees the change instead of overwriting it", async ({
  browser,
}) => {
  const login = async (email: string) => {
    const page = await (await browser.newContext({ locale: "it-IT" })).newPage();
    await page.goto("/console/accedi");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(DEMO.password);
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
    return page;
  };
  const first = await login(DEMO.email);
  const second = await login(ADMIN.email);

  // Both open the same case.
  await first.getByRole("link", { name: /Persona Esempio 8/ }).click();
  await expect(first.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
  await second.goto(first.url());
  await expect(second.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();

  // The first operator verifies an item; the second still has the old version on screen.
  await first.getByRole("button", { name: "Verifica", exact: true }).first().click();
  await expect(first.getByRole("button", { name: /^Annulla la decisione/ }).first()).toBeVisible();

  await second.getByRole("button", { name: "Verifica", exact: true }).first().click();
  await expect(
    second.getByRole("alert").filter({ hasText: "La pratica è cambiata" }),
  ).toBeVisible();
  // …and now sees what the colleague did.
  await expect(second.getByRole("button", { name: /^Annulla la decisione/ }).first()).toBeVisible();
});

test("the activity log shows a failed login to the administrator only", async ({ page }) => {
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password", { exact: true }).fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  // Operators don't see it.
  await expect(page.getByRole("link", { name: "Registro attività" })).toHaveCount(0);
  await page.getByRole("button", { name: "Esci" }).click();

  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Registro attività" }).click();
  await page.getByLabel("Cosa cerchi").selectOption({ label: "Accessi non riusciti" });
  await expect(page.getByText(/Tentativo di accesso operatore fallito/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Esporta CSV" })).toHaveAttribute(
    "href",
    /action=auth\.login_failed/,
  );
});

test("slash jumps to the queue search and Escape clears it", async ({ page }) => {
  await page.goto("/console/accedi");
  await logIn(page, DEMO);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Cerca pratiche" });
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await page.keyboard.type("Persona");
  await expect(search).toHaveValue("Persona");
  await page.keyboard.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).not.toBeFocused();
});

test("email notices are off by default and an administrator's choice survives a reload", async ({
  page,
}) => {
  await page.goto("/console/accedi");
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Impostazioni" }).click();

  const digest = page.getByRole("checkbox", { name: /Riepilogo giornaliero agli operatori/ });
  const ready = page.getByRole("checkbox", { name: /Avvisa il cittadino/ });
  await expect(digest).not.toBeChecked();
  await expect(ready).not.toBeChecked();

  await digest.check();
  await page.getByRole("button", { name: "Salva parametri" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Salvati" })).toBeVisible();
  await page.reload();
  await expect(digest).toBeChecked();
  await expect(ready).not.toBeChecked();

  // Leave the demo data as the seed made it for the other tests.
  await digest.uncheck();
  await page.getByRole("button", { name: "Salva parametri" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Salvati" })).toBeVisible();
});

test("system status is for administrators: operators get a plain refusal", async ({ page }) => {
  await page.goto("/console/accedi");
  await logIn(page, DEMO);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stato del sistema" })).toHaveCount(0);
  await page.goto("/console/stato");
  await expect(page.getByRole("heading", { name: "Stato riservato" })).toBeVisible();
  await page.getByRole("button", { name: "Esci" }).click();

  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Stato del sistema" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stato del sistema" })).toBeVisible();
  const components = page.getByRole("region", { name: "Componenti" });
  await expect(components.getByText("Database", { exact: true })).toBeVisible();
  await expect(components.getByText("Archivio documenti", { exact: true })).toBeVisible();
});

test("the pilot report is for administrators and downloads as a PDF", async ({ page }) => {
  await page.goto("/console/accedi");
  await logIn(page, DEMO);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rapporto del pilota" })).toHaveCount(0);
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/console\/accedi/);

  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Rapporto del pilota" }).click();
  await expect(page.getByRole("heading", { name: "Le tre soglie del pilota" })).toBeVisible();
  // Ten demo cases are far from the 50 the protocol requires: no threshold may claim an outcome.
  await expect(page.getByText("Dati insufficienti")).toHaveCount(3);

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Scarica PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^rapporto-pilota-.*\.pdf$/);
});
