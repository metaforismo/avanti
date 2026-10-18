import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { animationsSettled, logIn } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

async function expectNoSeriousViolations(page: Page) {
  // Contrast is a property of the settled page: with motion on, axe can sample a section that
  // is fading in (content-visibility reveals it only when axe reaches it).
  await page.emulateMedia({ reducedMotion: "reduce" });
  // And settled data: axe reads the DOM over several ticks, and a button that stops loading
  // halfway through is reported as unnamed although it never is.
  // A dev server under load can take longer than an assertion's 15 s to answer (the system
  // status runs its checks): what is measured is the settled page, however long it takes.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 45_000 });
  await animationsSettled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const summary = serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

test("landing has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("citizen entry and first step are accessible", async ({ page }) => {
  await page.goto("/s/demo-milano-centro");
  await expect(page.getByRole("banner").getByText("CAF Demo Milano")).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.getByLabel("Ho letto l'informativa e voglio iniziare").check();
  await page.getByRole("button", { name: "Inizia" }).click();
  await page.waitForURL(/\/pratica\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("operator login and queue are accessible", async ({ page }) => {
  await page.goto("/console/accedi");
  await expect(page.getByRole("heading", { name: "Accedi alla console" })).toBeVisible();
  await expectNoSeriousViolations(page);

  await logIn(page, DEMO);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  await expectNoSeriousViolations(page);
});
