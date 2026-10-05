import { expect, test } from "@playwright/test";

test("landing explains the product and validates the pilot form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Il fascicolo arriva pronto.");

  await page.locator("#pilota").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Candida il tuo sportello" }).click();
  await expect(page.getByText("Scrivi nome e cognome.")).toBeVisible();
  await expect(page.getByText("Serve il consenso per poterti ricontattare.")).toBeVisible();
});
