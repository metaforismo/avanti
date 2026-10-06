import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

async function expectNoSeriousViolations(page: Page) {
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

  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  await expectNoSeriousViolations(page);
});
