import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openFirstReadyCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

const PAGES = [
  { path: "/console/metriche", heading: "Metriche" },
  { path: "/console/stato", heading: "Stato del sistema" },
  { path: "/console/sportelli", heading: "Sportelli e QR" },
  { path: "/console/impostazioni", heading: "Impostazioni" },
  { path: "/console/account", heading: "Account" },
  { path: "/console/aiuto", heading: "Aiuto" },
] as const;

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${page.url()} ${v.id}: ${v.nodes.length} × ${v.help}`);
}

async function logIn(page: Page) {
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
}

// The console follows the system theme: both palettes must keep their contrast.
for (const colorScheme of ["light", "dark"] as const) {
  test(`console pages are accessible (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await logIn(page);
    // Guard against a silent pass: the palette under test must really be the one applied.
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r = 0, g = 0, b = 0] = background.match(/\d+/g)?.map(Number) ?? [];
    expect((r + g + b) / 3 < 128).toBe(colorScheme === "dark");
    const found: string[] = [];

    await openFirstReadyCase(page);
    found.push(...(await seriousViolations(page)));

    for (const { path, heading } of PAGES) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading, exact: true }),
      ).toBeVisible();
      found.push(...(await seriousViolations(page)));
    }
    expect(found, found.join("\n")).toEqual([]);
  });
}

// Right-to-left layout and non-Latin scripts are where contrast and labelling slip first.
for (const locale of ["ar", "bn"] as const) {
  test(`citizen first step is accessible in ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto("/s/demo-milano-centro");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const found = await seriousViolations(page);
    expect(found, found.join("\n")).toEqual([]);
    await context.close();
  });
}
