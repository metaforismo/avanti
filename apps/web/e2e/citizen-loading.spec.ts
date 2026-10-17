import { expect, test, type Page } from "@playwright/test";
import { startCase } from "./helpers";

// The page preloads the case for the app (app/pratica/[token]/page.tsx). If the preload and the
// app's fetch stop matching (URL, mode, credentials), the browser silently downloads it twice;
// Chrome only says so in the console, a few seconds after the page has loaded.
function watchUnusedPreloads(page: Page) {
  const unused: string[] = [];
  page.on("console", (message) => {
    if (/preloaded using link preload but not used/.test(message.text()))
      unused.push(message.text());
  });
  return unused;
}

test("opening a case uses the case the page preloaded", async ({ page }) => {
  const unused = watchUnusedPreloads(page);
  const token = await startCase(page);
  await page.goto(`/pratica/${token}`);
  await expect(page.getByLabel("Cosa devi fare?")).toBeVisible();
  await expect(page.locator(`link[rel="preload"][href="/api/c/${token}"]`)).toHaveCount(1);
  await page.waitForTimeout(4_000);
  expect(unused).toEqual([]);
});

test("starting from the office QR reads the new case once", async ({ page }) => {
  const unused = watchUnusedPreloads(page);
  const reads: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && /^\/api\/c\/[^/]+$/.test(path)) reads.push(path);
  });
  await page.goto("/s/demo-milano-centro");
  await page.getByLabel("Ho letto l'informativa e voglio iniziare").check();
  await page.getByRole("button", { name: "Inizia" }).click();
  await page.waitForURL(/\/pratica\//);
  await expect(page.getByLabel("Cosa devi fare?")).toBeVisible();
  await page.waitForTimeout(4_000);
  const token = page.url().split("/pratica/")[1]!;
  // In development React runs the first effect twice, and the second run reads again.
  const development = await page.evaluate(() => document.querySelector("nextjs-portal") !== null);
  expect(reads.filter((path) => path === `/api/c/${token}`)).toHaveLength(development ? 2 : 1);
  expect(unused).toEqual([]);
});

test("a first load lost on the way is tried again without asking", async ({ page }) => {
  const token = await startCase(page);
  let attempts = 0;
  await page.route(new RegExp(`/api/c/${token}$`), async (route) => {
    attempts += 1;
    if (attempts === 1) return route.abort("internetdisconnected");
    await route.fallback();
  });
  await page.goto(`/pratica/${token}`);
  await expect(page.getByLabel("Cosa devi fare?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Riprova" })).toHaveCount(0);
});
