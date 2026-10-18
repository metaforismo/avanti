import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Cookie, type Page } from "@playwright/test";
import { logIn, openFirstReadyCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

const PAGES = [
  { path: "/console/rinnovi", heading: "Rinnovi ISEE" },
  { path: "/console/metriche", heading: "Metriche" },
  { path: "/console/stato", heading: "Stato del sistema" },
  { path: "/console/rapporto", heading: "Rapporto del pilota" },
  { path: "/console/sportelli", heading: "Sportelli e QR" },
  { path: "/console/impostazioni", heading: "Impostazioni" },
  { path: "/console/account", heading: "Account" },
  { path: "/console/aiuto", heading: "Aiuto" },
  { path: "/console/registro", heading: "Registro attività" },
] as const;

async function seriousViolations(page: Page) {
  // Measure the settled page, not a fade-in (see accessibility.spec.ts).
  await page.emulateMedia({ reducedMotion: "reduce" });
  // And settled data: axe reads the DOM over several ticks, and a button that stops loading
  // halfway through is reported as unnamed although it never is.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${page.url()} ${v.id}: ${v.nodes.length} × ${v.help}`);
}

// One sign-in for the file: a test per page and palette would spend the admin's login quota
// (10 a minute, shared with the other spec files) and wait it out over and over.
let session: Cookie[] = [];
test.beforeAll(async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const page = await context.newPage();
  await logIn(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  session = await context.cookies();
  await context.close();
});

// The console follows the system theme: both palettes must keep their contrast. One test per
// page, so a slow page has its own time budget and a failure names the page.
for (const colorScheme of ["light", "dark"] as const) {
  for (const target of [{ path: null, heading: "Fascicolo" }, ...PAGES]) {
    test(`${target.heading} is accessible (${colorScheme})`, async ({ page }) => {
      await page.context().addCookies(session);
      await page.emulateMedia({ colorScheme });
      if (target.path) {
        await page.goto(target.path);
        await expect(
          page.getByRole("heading", { level: 1, name: target.heading, exact: true }),
        ).toBeVisible();
      } else {
        await page.goto("/console");
        await openFirstReadyCase(page);
      }
      // Guard against a silent pass: the palette under test must really be the one applied.
      const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const [r = 0, g = 0, b = 0] = background.match(/\d+/g)?.map(Number) ?? [];
      expect((r + g + b) / 3 < 128).toBe(colorScheme === "dark");
      const found = await seriousViolations(page);
      expect(found, found.join("\n")).toEqual([]);
    });
  }
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
