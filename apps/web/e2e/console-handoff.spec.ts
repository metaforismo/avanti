import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { finishInterview, logIn, origin, startCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const OPERATOR = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

async function seriousViolations(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`);
}

/** A citizen who wrote in Arabic and left only a phone number: email never reaches them. */
async function phoneOnlyCase(page: Page) {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo", "ar");
  await finishInterview(page, token);
  const sent = await page.request.post(`/api/c/${token}/submit`, {
    headers: origin(),
    data: {
      contact: { firstName: "Amina", lastName: "Esempio", phone: "3330000000" },
      confirmed: true,
    },
  });
  expect(sent.ok(), await sent.text()).toBeTruthy();
  const data = (await (await page.request.get(`/api/c/${token}`)).json()) as {
    id: string;
    reference: string;
  };
  return data;
}

test("after a request, the operator tells a phone-only citizen in their language", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { id, reference } = await phoneOnlyCase(page);
  await logIn(page, OPERATOR);
  await page.goto(`/console/pratiche/${id}`);
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Chiedi integrazione" }).first().click();
  await page
    .getByRole("dialog", { name: "Chiedi un'integrazione" })
    .getByRole("button", { name: "Invia al cittadino" })
    .click();

  // No email: the message is offered right away, Arabic first, Italian under it.
  const notice = page.getByRole("dialog", { name: "Avvisa il cittadino" });
  await expect(notice).toBeVisible();
  const preview = notice.getByRole("region", { name: "Anteprima del messaggio" });
  await expect(preview.locator('p[lang="ar"]')).toContainText(reference);
  await expect(preview.locator('p[lang="it"]')).toContainText("lo sportello ti chiede ancora");
  const whatsapp = notice.getByRole("link", { name: "WhatsApp a +393330000000" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/393330000000\?text=/);
  await expect(whatsapp).toHaveAttribute("rel", /noreferrer/);
  // A desk PC has no SMS app.
  await expect(notice.getByRole("link", { name: "SMS" })).toHaveCount(0);

  const inDialog = await seriousViolations(page);
  expect(inDialog, inDialog.join("\n")).toEqual([]);

  const recorded = page.waitForResponse(
    (r) => r.url().endsWith(`/api/cases/${id}/citizen-handoff/events`) && r.status() === 204,
  );
  await notice.getByRole("button", { name: "Copia il messaggio" }).click();
  await recorded;
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(reference);
  expect(copied).not.toContain("Amina");

  await notice.getByRole("button", { name: "Chiudi" }).click();
  await expect(page.getByText(/^Messaggio copiato da Operatore Demo/)).toBeVisible();
  await expect(page.getByText("Avviso al cittadino copiato")).toBeVisible();

  // Lost link: the new one goes out by copy only, once, and survives closing the dialog.
  await page.getByRole("button", { name: "Avvisa il cittadino" }).click();
  await notice.getByRole("button", { name: /ha perso il link/ }).click();
  await notice.getByRole("button", { name: "Crea il nuovo link" }).click();
  await expect(notice.getByText("Nuovo link nel messaggio: si invia copiandolo")).toBeVisible();
  await expect(notice.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  const withLink = (await preview.textContent()) ?? "";
  const links = withLink.match(/https?:\/\/\S+\/pratica\/[\w-]+/g) ?? [];
  expect(links).toHaveLength(1);
  await notice.getByRole("button", { name: "Chiudi" }).click();
  await page.getByRole("button", { name: "Avvisa il cittadino" }).click();
  await expect(preview).toContainText(links[0]!);
});

test("a citizen without a smartphone leaves with the list on paper", async ({ page }) => {
  const { id, reference } = await phoneOnlyCase(page);
  await logIn(page, OPERATOR);
  // The desk asks for something: its message is printed once, not under every item.
  const read = async () =>
    (await (await page.request.get(`/api/cases/${id}`)).json()) as { updatedAt: string };
  const started = await page.request.patch(`/api/cases/${id}`, {
    headers: origin(),
    data: { status: "in_review", expectedUpdatedAt: (await read()).updatedAt },
  });
  expect(started.ok(), await started.text()).toBeTruthy();
  const handoff = (await (await page.request.get(`/api/cases/${id}/citizen-handoff`)).json()) as {
    items: { id: string }[];
  };
  const asked = await page.request.post(`/api/cases/${id}/requests`, {
    headers: origin(),
    data: {
      expectedUpdatedAt: (await read()).updatedAt,
      checklistItemIds: handoff.items.slice(0, 2).map((item) => item.id),
      message: "Serve anche il retro del documento.",
    },
  });
  expect(asked.ok(), await asked.text()).toBeTruthy();
  await page.goto(`/console/stampa/${id}`);

  const sheet = page.locator("article");
  await expect(sheet).toHaveAttribute("lang", "ar");
  await expect(sheet).toHaveAttribute("dir", "rtl");
  await expect(sheet.getByRole("heading", { level: 1 })).toHaveText(
    "الوثائق التي يجب إحضارها إلى شباك الخدمة",
  );
  await expect(sheet.getByText("Documenti da portare allo sportello")).toBeVisible();
  await expect(sheet.getByText(reference)).toBeVisible();
  await expect(sheet.getByText(/^Documento d.identità$/)).toBeVisible();
  await expect(sheet.getByText("Serve anche il retro del documento.")).toHaveCount(1);

  const onSheet = await seriousViolations(page);
  expect(onSheet, onSheet.join("\n")).toEqual([]);

  // Printing from the button or with Ctrl+P is recorded once.
  const recorded = page.waitForResponse(
    (r) => r.url().endsWith(`/api/cases/${id}/citizen-handoff/events`) && r.status() === 204,
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("beforeprint"));
  });
  await recorded;

  await page.getByRole("link", { name: `Fascicolo ${reference}` }).click();
  await expect(page.getByText("Elenco dei documenti stampato per il cittadino")).toHaveCount(1);
});

test("the print page sends a signed-out operator to sign in and back", async ({ page }) => {
  await page.goto("/console/stampa/non-esiste");
  await expect(page.getByText("La sessione è scaduta.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Accedi di nuovo" })).toHaveAttribute(
    "href",
    "/console/accedi?motivo=sessione&next=%2Fconsole%2Fstampa%2Fnon-esiste",
  );
});

test("«Esci» in the console blanks the print sheet left open in another tab", async ({
  page,
  context,
}) => {
  const { id, reference } = await phoneOnlyCase(page);
  await logIn(page, OPERATOR);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  const sheet = await context.newPage();
  await sheet.goto(`/console/stampa/${id}`);
  await expect(sheet.locator("article").getByText(reference)).toBeVisible();

  await page.getByRole("button", { name: "Esci" }).click();
  await page.waitForURL(/\/console\/accedi/);
  await expect(sheet.getByText("Sessione chiusa")).toBeVisible();
  await expect(sheet.locator("article")).toHaveCount(0);
  await expect(sheet.getByText(reference)).toHaveCount(0);
  await expect(sheet.getByRole("link", { name: "Accedi di nuovo" })).toHaveAttribute(
    "href",
    `/console/accedi?next=${encodeURIComponent(`/console/stampa/${id}`)}`,
  );
});

test("without BroadcastChannel the sign-out still reaches the print tab", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => Reflect.deleteProperty(window, "BroadcastChannel"));
  const { id, reference } = await phoneOnlyCase(page);
  await logIn(page, OPERATOR);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  const sheet = await context.newPage();
  await sheet.goto(`/console/stampa/${id}`);
  await expect(sheet.locator("article").getByText(reference)).toBeVisible();
  expect(await sheet.evaluate(() => "BroadcastChannel" in window)).toBe(false);
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(sheet.getByText("Sessione chiusa")).toBeVisible();
  await expect(sheet.locator("article")).toHaveCount(0);
});

test("a print sheet shown again after the session ended elsewhere is blanked", async ({
  page,
  context,
}) => {
  const { id, reference } = await phoneOnlyCase(page);
  await logIn(page, OPERATOR);
  await page.goto(`/console/stampa/${id}`);
  await expect(page.locator("article").getByText(reference)).toBeVisible();
  // The session ends without this tab hearing it (another browser window, expiry, an admin).
  const out = await context.request.post("/api/auth/logout", { headers: origin() });
  expect(out.ok()).toBeTruthy();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText("Sessione chiusa")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});
