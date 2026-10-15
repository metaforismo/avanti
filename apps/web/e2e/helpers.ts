import { expect, type Page } from "@playwright/test";

/**
 * Opens the first case of a queue tab. The URL and the response arrive before the list is
 * rendered: clicking earlier opens a case from the previous tab, and acting on it changes demo
 * data other tests rely on. The screen-reader count names the tab once the list is shown.
 */
export async function openFirstCaseIn(
  page: Page,
  tab: { button: RegExp; status: string; label: string },
) {
  const filtered = page.waitForResponse(
    (response) =>
      new RegExp(`/api/cases\\?.*status=${tab.status}`).test(response.url()) && response.ok(),
  );
  await page.getByRole("button", { name: tab.button }).click();
  await filtered;
  await expect(
    page.getByRole("status").filter({ hasText: new RegExp(`pratiche: ${tab.label}`) }),
  ).toBeAttached();
  await page.locator('a[href^="/console/pratiche/"]').first().click();
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
}

export const openFirstReadyCase = (page: Page) =>
  openFirstCaseIn(page, { button: /^Pronte/, status: "ready", label: "pronte" });

export const openFirstCaseInReview = (page: Page) =>
  openFirstCaseIn(page, { button: /^In revisione/, status: "in_review", label: "in revisione" });

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
