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
  const whatsapp = notice.getByRole("link", { name: "WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/393330000000\?text=/);
  await expect(whatsapp).toHaveAttribute("rel", /noreferrer/);
  await expect(notice.getByRole("link", { name: "SMS" })).toHaveAttribute(
    "href",
    /^sms:3330000000\?&body=/,
  );

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
  await expect(page.getByText(/Avvisato con il messaggio copiato/)).toBeVisible();
  await expect(page.getByText("Avviso al cittadino copiato")).toBeVisible();
});

test("a citizen without a smartphone leaves with the list on paper", async ({ page }) => {
  const { id, reference } = await phoneOnlyCase(page);
  await logIn(page, OPERATOR);
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
    "/console/accedi?next=%2Fconsole%2Fstampa%2Fnon-esiste",
  );
});
