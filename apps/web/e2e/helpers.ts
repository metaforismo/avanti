import { expect, type Page } from "@playwright/test";

/**
 * Opens the first case in the "Pronte" tab. The URL changes before the list does, so it waits
 * for the filtered response: clicking earlier opens a case from the previous tab.
 */
export async function openFirstReadyCase(page: Page) {
  const filtered = page.waitForResponse(
    (response) => /\/api\/cases\?.*status=ready/.test(response.url()) && response.ok(),
  );
  await page.getByRole("button", { name: /^Pronte/ }).click();
  await filtered;
  await expect(page.getByRole("button", { name: /^Pronte/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('a[href^="/console/pratiche/"]').first().click();
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
}
