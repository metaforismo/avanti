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

/**
 * Signs in through the form. The demo accounts sign in many times a minute across the suite and
 * the API allows 10 attempts per email per minute: on a 429 it waits the server's Retry-After.
 */
export async function logIn(page: Page, account: { email: string; password: string }) {
  if (!new URL(page.url()).pathname.startsWith("/console/accedi")) {
    await page.goto("/console/accedi");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    const response = page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
    await page.getByRole("button", { name: "Accedi" }).click();
    const result = await response;
    if (result.status() !== 429) return;
    const seconds = Number(result.headers()["retry-after"] ?? "60");
    await page.waitForTimeout(seconds * 1000 + 250);
  }
}
