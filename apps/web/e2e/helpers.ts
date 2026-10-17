import { expect, test, type Page } from "@playwright/test";
import type { Language } from "@avanti/contracts";

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
    page.getByRole("status").filter({ hasText: new RegExp(`pratic(?:a|he): ${tab.label}`) }),
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
  // Two workers share the demo accounts: keep waiting out the per-email window a few times.
  for (let attempt = 0; attempt < 6; attempt++) {
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

/** Browsers send Origin on every POST and production requires it; Playwright's API client doesn't. */
export function origin() {
  return { Origin: new URL(test.info().project.use.baseURL!).origin };
}

/** Answers the remaining interview through the API: the UI for each kind is covered elsewhere. */
export async function finishInterview(page: Page, token: string) {
  for (let i = 0; i < 40; i++) {
    const data = await (await page.request.get(`/api/c/${token}`)).json();
    const q = data.nextQuestion;
    if (!q) return;
    const value =
      q.kind === "yes_no"
        ? false
        : q.kind === "single_choice"
          ? q.options[0].value
          : q.kind === "multi_choice"
            ? [q.options[0].value]
            : q.kind === "number"
              ? Math.max(q.min ?? 1, 1)
              : q.kind === "members"
                ? [{ role: "richiedente", firstName: "Prova" }]
                : q.kind === "date"
                  ? "2025-06-01"
                  : "Prova";
    const response = await page.request.post(`/api/c/${token}/turn`, {
      headers: origin(),
      data: { type: "answer", questionId: q.id, value },
    });
    expect(response.ok(), `answer ${q.id}: ${await response.text()}`).toBeTruthy();
  }
  throw new Error("Interview did not finish");
}

/** Opens a case at the demo office, optionally with a first story, without the UI. */
export async function startCase(page: Page, story?: string, language: Language = "it") {
  const started = await page.request.post("/api/intake", {
    headers: origin(),
    data: { officeSlug: "demo-milano-centro", language, privacyAccepted: true },
  });
  const { token } = (await started.json()) as { token: string };
  if (story) {
    const told = await page.request.post(`/api/c/${token}/turn`, {
      headers: origin(),
      data: { type: "text", text: story },
    });
    expect(told.ok(), `story: ${await told.text()}`).toBeTruthy();
  }
  return token;
}
