import { expect, test } from "@playwright/test";
import { startCase } from "./helpers";

// The page preloads the case for the app (app/pratica/[token]/page.tsx). If the preload and the
// app's fetch stop matching (URL, mode, credentials), the browser silently downloads it twice.
test("opening a case reads it once", async ({ page }) => {
  const token = await startCase(page);
  let reads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/api/c/${token}`) reads += 1;
  });
  await page.goto(`/pratica/${token}`);
  await expect(page.getByLabel("Cosa devi fare?")).toBeVisible();
  await expect(page.locator(`link[rel="preload"][href="/api/c/${token}"]`)).toHaveCount(1);
  expect(reads).toBe(1);
});
