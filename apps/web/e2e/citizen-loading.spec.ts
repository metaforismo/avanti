import { expect, test } from "@playwright/test";
import { startCase } from "./helpers";

// The page preloads the case for the app (app/pratica/[token]/page.tsx). If the preload and the
// app's fetch stop matching (URL, mode, credentials), the browser silently downloads it twice;
// Chrome only says so in the console, a few seconds after the page has loaded.
test("opening a case uses the case the page preloaded", async ({ page }) => {
  const unused: string[] = [];
  page.on("console", (message) => {
    if (/preloaded using link preload but not used/.test(message.text()))
      unused.push(message.text());
  });
  const token = await startCase(page);
  await page.goto(`/pratica/${token}`);
  await expect(page.getByLabel("Cosa devi fare?")).toBeVisible();
  await expect(page.locator(`link[rel="preload"][href="/api/c/${token}"]`)).toHaveCount(1);
  await page.waitForTimeout(4_000);
  expect(unused).toEqual([]);
});
