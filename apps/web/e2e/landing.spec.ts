import { expect, test } from "@playwright/test";
import { holdScripts } from "./helpers";

test("landing explains the product and validates the pilot form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Il fascicolo arriva pronto.");

  await page.locator("#pilota").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Candida il tuo sportello" }).click();
  await expect(page.getByText("Scrivi nome e cognome.")).toBeVisible();
  await expect(page.getByText("Serve il consenso per poterti ricontattare.")).toBeVisible();
});

test("a pilot request sent before the page is interactive arrives, its fields never in the URL", async ({
  page,
}) => {
  // Answered here: the test is about the form, not about storing a lead and emailing the team.
  await page.route(/\/api\/leads$/, (route) => route.fulfill({ status: 201, json: { ok: true } }));
  const release = await holdScripts(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Nome e cognome").fill("Prova Pilota");
  await page.getByLabel("CAF o patronato").fill("CAF di prova");
  await page.getByLabel("Email di lavoro").fill("pilota@example.invalid");
  await page.getByLabel(/Acconsento a essere ricontattato/).check();
  await page.getByRole("button", { name: "Candida il tuo sportello" }).click();

  const sent = page.waitForRequest((r) => r.url().endsWith("/api/leads"), { timeout: 30_000 });
  release();
  expect((await sent).postDataJSON()).toMatchObject({
    name: "Prova Pilota",
    organization: "CAF di prova",
    email: "pilota@example.invalid",
  });
  await expect(page.getByRole("heading", { name: "Richiesta ricevuta" })).toBeVisible();
  expect(page.url()).not.toContain("example.invalid");
});
