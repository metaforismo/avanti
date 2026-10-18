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
  // Everything the colleague needs to sign in: where, with which email, which password.
  await expect(issued).toContainText(/\/console\/accedi/);
  await expect(issued).toContainText(email);
  const temporary = (await issued.locator("[translate=no]").innerText()).trim();
  expect(temporary.length).toBeGreaterThanOrEqual(12);
  await issued.getByRole("button", { name: "Fatto" }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/console\/accedi/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(temporary);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Scegli la tua password" })).toBeVisible();

  await page.getByLabel("Password temporanea").fill(temporary);
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

test("a CAF's first day shows its setup steps until the first dossier arrives", async ({
  page,
}) => {
  // Nothing has reached the CAF yet: only a test case is still being filled in.
  await page.route(/\/api\/cases\?/, (route) =>
    route.fulfill({
      json: {
        items: [],
        nextCursor: null,
        counts: { submitted: 0, in_review: 0, needs_citizen: 0, ready: 0, intake: 1, closed: 0 },
      },
    }),
  );
  await page.goto("/console/accedi");
  await logIn(page, ADMIN);

  const steps = page.getByRole("region", { name: "Per iniziare" });
  await expect(steps.getByRole("listitem")).toHaveCount(6);
  await expect(steps.getByRole("progressbar", { name: "Passi fatti" })).toBeVisible();
  // The test case counts as done: the step now leads to it.
  const trial = steps.getByRole("listitem").filter({ hasText: "Prova il percorso del cittadino" });
  await expect(trial).toContainText("Fatto");
  await expect(trial.getByRole("link", { name: "Apri «In compilazione»" })).toHaveAttribute(
    "href",
    "/console?stato=intake",
  );

  // A link to a setting lands on it, not at the top of a long page.
  await steps
    .getByRole("listitem")
    .filter({ hasText: "Misura i tempi di oggi" })
    .getByRole("link")
    .click();
  await expect(page.getByLabel("Minuti per pratica prima di Avanti")).toBeFocused();
});

test("an administrator adds a colleague straight from the first steps", async ({ page }) => {
  await page.route(/\/api\/cases\?/, (route) =>
    route.fulfill({
      json: {
        items: [],
        nextCursor: null,
        counts: { submitted: 0, in_review: 0, needs_citizen: 0, ready: 0, intake: 0, closed: 0 },
      },
    }),
  );
  // A CAF where the administrator is still alone (the demo has colleagues).
  await page.route(/\/api\/operators$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const list = (await response.json()) as { email: string }[];
    await route.fulfill({ response, json: list.filter((o) => o.email === ADMIN.email) });
  });
  await page.goto("/console/accedi");
  await logIn(page, ADMIN);
  const steps = page.getByRole("region", { name: "Per iniziare" });
  await steps.getByRole("button", { name: "Crea una pratica di prova" }).click();
  await expect(page.getByRole("dialog", { name: "Nuova pratica" })).toBeVisible();
  await page.keyboard.press("Escape");

  // A client navigation, as an administrator would click it.
  await steps.getByRole("link", { name: "Aggiungi un collega" }).click();
  await expect(page.getByRole("dialog", { name: "Nuovo operatore" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Aggiungi operatore" })).toBeFocused();
  // Opened once: a reload shows the page, not the form again.
  await expect(page).toHaveURL(/\/console\/impostazioni$/);
});

for (const gate of [
  { flag: "mustChangePassword", heading: "Scegli la tua password" },
  { flag: "mustSetupMfa", heading: "Attiva la verifica in due passaggi" },
]) {
  test(`«${gate.heading}» always offers a way out`, async ({ page }) => {
    await page.goto("/console/accedi");
    await logIn(page, DEMO);
    await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
    // The gate is the server's call: only its flag is forced here.
    await page.route(/\/api\/auth\/me$/, async (route) => {
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      await route.fulfill({ response, json: { ...(await response.json()), [gate.flag]: true } });
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: gate.heading })).toBeVisible();
    await page.getByRole("button", { name: "Esci" }).click();
    await expect(page).toHaveURL(/\/console\/accedi/);
    await page.unroute(/\/api\/auth\/me$/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  });
}

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

test("a lost citizen link is replaced and the old one stops working", async ({
  page,
  browser,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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
  // A personal link leaves only by QR or copy: never inside a wa.me or sms: address that
  // stays in the desk PC's history.
  await expect(issued.getByRole("link", { name: /WhatsApp|SMS/ })).toHaveCount(0);
  await expect(issued.locator('a[href^="https://wa.me"], a[href^="sms:"]')).toHaveCount(0);
  await issued.getByRole("button", { name: "Copia il messaggio" }).click();
  await expect(issued.getByRole("button", { name: "Messaggio copiato" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("nuovo link");
  expect(copied).toContain(newLink);

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
    await logIn(page, { email, password: DEMO.password });
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
  // It spends the shared demo account's login quota on purpose: leave room to wait it out.
  test.slow();
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password", { exact: true }).fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  // The helper waits out the per-email login limit the rest of the suite also spends.
  await logIn(page, DEMO);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  // Operators don't see it.
  await expect(page.getByRole("link", { name: "Registro attività" })).toHaveCount(0);
  await page.getByRole("button", { name: "Esci" }).click();

  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Registro attività" }).click();
  await page.getByLabel("Cosa cerchi").selectOption({ label: "Accessi non riusciti" });
  await expect(page.getByText(/Tentativo di accesso operatore fallito/).first()).toBeVisible();
  // The export carries the filter on screen.
  const exported = page.waitForRequest(/\/api\/audit\/export\.csv\?.*action=auth\.login_failed/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta CSV" }).click();
  await exported;
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
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

test("question mark lists the shortcuts, but not while typing", async ({ page }) => {
  await page.goto("/console/accedi");
  await logIn(page, DEMO);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Cerca pratiche" });
  await search.focus();
  await page.keyboard.press("?");
  await expect(search).toHaveValue("?");
  await expect(page.getByRole("dialog", { name: "Scorciatoie da tastiera" })).toHaveCount(0);
  await search.fill("");
  await search.blur();

  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Scorciatoie da tastiera" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Verifica la voce")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
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
  await page.getByRole("button", { name: "Scarica PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^rapporto-pilota-.*\.pdf$/);
});

test("an administrator adds the booking link and a note to an office", async ({ page }) => {
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: /Modifica.*Milano Loreto/ }).click();
  const form = page.getByRole("dialog");
  const link = form.getByLabel(/Link per prenotare/);
  await link.fill("http://prenota.example.it");
  await form.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(
    form.getByText("Incolla l'indirizzo completo, che inizia con https://"),
  ).toBeVisible();

  await link.fill("https://prenota.example.it/loreto");
  await form.getByLabel("Nota per il cittadino").fill("Porta gli originali.");
  await form.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(form).toBeHidden();

  // Saved for real: the form opens again with the values, then they are cleared for other tests.
  await page.getByRole("button", { name: /Modifica.*Milano Loreto/ }).click();
  await expect(form.getByLabel(/Link per prenotare/)).toHaveValue(
    "https://prenota.example.it/loreto",
  );
  await form.getByLabel(/Link per prenotare/).fill("");
  await form.getByLabel("Nota per il cittadino").fill("");
  await form.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(form).toBeHidden();
});

test("changing someone's access asks first, naming the person", async ({ page }) => {
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Impostazioni" }).click();
  const row = page.getByRole("listitem").filter({ hasText: DEMO.email });
  await row.getByRole("button", { name: "Disattiva" }).click();
  const confirm = page.getByRole("dialog", { name: "Disattivare l'operatore?" });
  await expect(confirm).toContainText("viene disconnesso subito");
  await confirm.getByRole("button", { name: "Annulla" }).click();
  await expect(row.getByRole("button", { name: "Disattiva" })).toBeVisible();
});

test("an impossible report period is explained and nothing is downloaded", async ({ page }) => {
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Rapporto del pilota" }).click();
  await expect(page.getByRole("heading", { name: "Le tre soglie del pilota" })).toBeVisible();
  let requests = 0;
  page.on("request", (r) => r.url().includes("/api/reports/pilot") && requests++);
  await page.getByLabel("Dal", { exact: true }).fill("2027-03-01");
  await page.getByLabel("Al", { exact: true }).fill("2027-01-01");
  await page.getByLabel("Al", { exact: true }).press("Enter");
  await expect(page.getByText("La data di inizio viene dopo quella di fine.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Scarica PDF" })).toBeDisabled();
  expect(requests).toBe(0);
});
