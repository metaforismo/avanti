import { expect, test } from "@playwright/test";
import { logIn, openFirstCaseInReview } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

test("an operator prepares an ISEE renewal and gets its link once", async ({ page }) => {
  await logIn(page, DEMO);
  await page.getByRole("link", { name: "Rinnovi ISEE" }).click();
  await expect(page.getByRole("heading", { name: "Rinnovi ISEE" })).toBeVisible();

  const toInvite = page.getByRole("button", { name: /^Da invitare/ });
  await expect(toInvite).toHaveAttribute("aria-pressed", "true");
  const first = page.getByRole("checkbox", { name: /^Seleziona Persona/ }).first();
  await first.check();
  await expect(page.getByText("1 famiglia selezionata")).toBeVisible();
  await page.getByRole("button", { name: "Prepara il rinnovo" }).click();

  const done = page.getByRole("dialog", { name: "Rinnovo preparato" });
  await expect(done.getByText(/copiali adesso, dopo non si vedono più/)).toBeVisible();
  await expect(done.getByRole("button", { name: "Copia link" })).toBeVisible();
  await done.getByRole("button", { name: "Fatto" }).click();

  await page.getByRole("button", { name: /^Invitati/ }).click();
  await expect(page.getByRole("link", { name: "Apri il rinnovo" }).first()).toBeVisible();
  await expect(page.getByText(/^Link del /).first()).toBeVisible();
});

test("a new link for an invited family asks first", async ({ page }) => {
  await logIn(page, DEMO);
  await page.goto("/console/rinnovi");
  await page.getByRole("button", { name: /^Invitati/ }).click();
  // The list is rendered once the screen-reader count names the tab.
  await expect(
    page.getByRole("status").filter({ hasText: /famigli(?:a|e): Invitati/ }),
  ).toBeAttached();
  const invited = page.getByRole("checkbox", { name: /^Seleziona Persona/ });
  test.skip((await invited.count()) === 0, "Needs the previous test's renewal.");
  await invited.first().check();
  await page.getByRole("button", { name: "Nuovo link" }).click();
  const ask = page.getByRole("dialog", { name: "Generare nuovi link?" });
  await expect(ask.getByText(/smettono di funzionare subito/)).toBeVisible();
  await ask.getByRole("button", { name: "Annulla" }).click();
  await expect(ask).toHaveCount(0);
});

test("the desk withdraws a family's renewal reminder from the dossier", async ({ page }) => {
  await logIn(page, DEMO);
  await openFirstCaseInReview(page);
  await page.getByRole("button", { name: /Altro/ }).click();
  await page.getByRole("menuitem", { name: "Revoca l'avviso di rinnovo…" }).click();
  const ask = page.getByRole("dialog", { name: "Revocare l'avviso di rinnovo?" });
  await ask.getByRole("button", { name: "Revoca l'avviso" }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.getByText(/Avviso di rinnovo revocato/)).toBeVisible();
});
