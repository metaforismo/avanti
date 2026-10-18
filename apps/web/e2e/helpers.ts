import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";
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
 *
 * It types and clicks as soon as the form is visible, like an operator on a slow PC: the form
 * holds a submission made before hydration and sends it once the page is interactive (see
 * lib/early-submit), so no wait for readiness belongs here — one would hide that regressing.
 */
export async function logIn(page: Page, account: { email: string; password: string }) {
  if (!new URL(page.url()).pathname.startsWith("/console/accedi")) {
    await page.goto("/console/accedi");
  }
  // Two workers share the demo accounts: keep waiting out the per-email window a few times.
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Accedi" }).click();
    const result = await response;
    if (result.status() !== 429) return;
    await waitOutLoginLimit(page, result.headers()["retry-after"]);
  }
}

/** `logIn` without the UI, for an API context; it waits out the login limit the same way. */
export async function apiLogIn(
  api: APIRequestContext,
  account: { email: string; password: string },
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await api.post("/api/auth/login", { headers: origin(), data: account });
    if (result.status() !== 429) {
      expect(result.ok(), await result.text()).toBeTruthy();
      return;
    }
    await waitOutLoginLimit(null, result.headers()["retry-after"]);
  }
  throw new Error("Login limit not lifted");
}

async function waitOutLoginLimit(page: Page | null, retryAfter: string | undefined) {
  const wait = Number(retryAfter ?? "60") * 1000 + 250;
  // The other spec files spent the quota: the wait is the suite's, not this test's slowness,
  // and must not eat its time budget (a minute of a 90-second test).
  test.info().setTimeout(test.info().timeout + wait);
  if (page) await page.waitForTimeout(wait);
  else await new Promise((resolve) => setTimeout(resolve, wait));
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

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * A submitted case of the test's own. Spec files run in parallel against one database: a test
 * that verifies, assigns or otherwise changes a seeded demo case races every other test reading
 * it, and the next run finds it changed. `files` documents are attached to the first checklist
 * items, ready for «Verifica».
 */
export async function submittedCase(
  page: Page,
  contact: { firstName: string; lastName: string },
  {
    files = 2,
    language = "it",
    fileNames = [],
  }: { files?: number; language?: Language; fileNames?: string[] } = {},
) {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo.", language);
  await finishInterview(page, token);
  const citizen = (await (await page.request.get(`/api/c/${token}`)).json()) as {
    id: string;
    reference: string;
    checklist: { id: string }[];
  };
  for (const [index, item] of citizen.checklist.slice(0, files).entries()) {
    const uploaded = await page.request.post(`/api/c/${token}/documents`, {
      headers: origin(),
      multipart: {
        file: {
          name: fileNames[index] ?? `documento-${index + 1}.png`,
          mimeType: "image/png",
          buffer: PNG,
        },
        checklistItemId: item.id,
      },
    });
    expect(uploaded.ok(), await uploaded.text()).toBeTruthy();
  }
  // Submitting waits for the background analysis of the uploads.
  await expect(async () => {
    const sent = await page.request.post(`/api/c/${token}/submit`, {
      headers: origin(),
      data: { contact, confirmed: true },
    });
    expect(sent.ok(), await sent.text()).toBeTruthy();
  }).toPass({ timeout: 30_000 });
  return { id: citizen.id, reference: citizen.reference, token };
}

/** Opens a dossier by id, for an operator already signed in. */
export async function openCase(page: Page, id: string) {
  await page.goto(`/console/pratiche/${id}`);
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
}

/**
 * Holds the page's scripts until `release()`: the server-rendered page is on screen and React
 * isn't running yet, as on a slow phone or PC — deterministically, unlike CPU throttling. Use
 * `goto(…, { waitUntil: "domcontentloaded" })`: the load event waits for the held scripts.
 */
export async function holdScripts(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/_next\/static\/.+\.js(?:\?|$)/, async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

/** The server gets the request and answers, but the reply never reaches the page (Wi-Fi drop). */
export async function loseReply(route: Route) {
  try {
    await route.fetch();
  } catch (error) {
    // Playwright's client reused a keep-alive socket the dev server had just closed (seen on a
    // loaded machine): the request never reached the app, so it goes once more.
    if (!String(error).includes("ECONNRESET")) throw error;
    await route.fetch();
  }
  await route.abort("internetdisconnected");
}

/**
 * Waits until no finite animation is running. axe samples colours over several ticks: an element
 * fading in (a dialog's content once loaded) reads as low contrast although it never is.
 * Infinite ones (spinners) never settle and are left out; `[aria-busy]` covers those.
 */
export async function animationsSettled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
}
