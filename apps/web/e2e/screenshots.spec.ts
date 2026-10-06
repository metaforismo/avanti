import { expect, test, type Page } from "@playwright/test";

/**
 * Regenerates the README screenshots: `pnpm --filter @avanti/web screenshots`.
 * Skipped in the normal e2e run. Uses the demo seed only (fictitious people).
 */
test.skip(!process.env.SCREENSHOTS, "Run with SCREENSHOTS=1");

const OUT = "../../docs/screenshots";
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

async function finishInterview(page: Page, token: string) {
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
              ? Math.max(q.min ?? 1, 2)
              : q.kind === "members"
                ? [
                    { role: "richiedente", firstName: "Mario" },
                    { role: "genitore", firstName: "Anna" },
                  ]
                : "Prova";
    await page.request.post(`/api/c/${token}/turn`, {
      // Production requires Origin on mutations; Playwright's API client doesn't send it.
      headers: { Origin: new URL(test.info().project.use.baseURL!).origin },
      data: { type: "answer", questionId: q.id, value },
    });
  }
}

test("landing", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(4500); // let the intake demo finish
  await page.screenshot({ path: `${OUT}/landing.png` });
});

test("citizen flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/demo-milano-centro");
  await page.getByLabel("Ho letto l'informativa e voglio iniziare").check();
  await page.screenshot({ path: `${OUT}/cittadino-ingresso.png` });
  await page.getByRole("button", { name: "Inizia" }).click();
  await page.waitForURL(/\/pratica\//);
  const token = page.url().split("/pratica/")[1]!;
  await page
    .getByLabel("Cosa devi fare?")
    .fill("Devo fare l'ISEE, vivo con mia madre, ho un conto Fineco e una macchina");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ISEE ordinario" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/cittadino-domande.png` });
  await finishInterview(page, token);
  await page.reload();
  await expect(page.getByRole("heading", { name: "I documenti da preparare" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/cittadino-documenti.png` });
});

test("console", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto("/console/accedi");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/console-coda.png` });
  // A seeded demo case (fictitious "Persona Esempio"), more representative than test leftovers.
  await page.goto("/console?stato=in_review");
  await page
    .getByRole("link", { name: /Persona Esempio/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
  await page.screenshot({ path: `${OUT}/console-fascicolo.png` });
});
