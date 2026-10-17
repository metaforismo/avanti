import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

async function showQueue(page: Page, assignee: string) {
  const loaded = page.waitForResponse(
    (response) => /\/api\/cases\?/.test(response.url()) && response.ok(),
  );
  await page.getByLabel("Filtra per operatore").selectOption(assignee);
  await loaded;
  await expect(
    page.getByRole("status").filter({ hasText: /pratiche: da revisionare/ }),
  ).toBeAttached();
}

test("l'amministratore assegna due pratiche a un operatore", async ({ page }) => {
  await logIn(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  await showQueue(page, "none");

  const boxes = page.getByRole("checkbox", { name: /^Seleziona .+ [A-Z]+-\d{4}-/ });
  await expect(boxes.nth(1)).toBeVisible();
  const labels = [
    await boxes.nth(0).getAttribute("aria-label"),
    await boxes.nth(1).getAttribute("aria-label"),
  ] as string[];
  await boxes.nth(0).check();
  // The keyboard works as well as the mouse.
  await boxes.nth(1).focus();
  await page.keyboard.press("Space");
  const bar = page.getByRole("region", { name: "Pratiche selezionate" });
  await expect(bar.getByText("2 pratiche selezionate")).toBeVisible();

  await bar.getByRole("button", { name: "Assegna a…" }).click();
  const dialog = page.getByRole("dialog", { name: "Assegna 2 pratiche" });
  await dialog.getByRole("radio", { name: "Operatore Demo", exact: true }).check();
  await expect(dialog.getByText("Assegnare 2 pratiche a Operatore Demo?")).toBeVisible();
  const assigned = page.waitForResponse((r) => r.url().endsWith("/api/cases/assign"));
  await dialog.getByRole("button", { name: "Assegna 2 pratiche a Operatore Demo" }).click();
  expect((await assigned).status()).toBe(200);

  await expect(page.getByText("2 pratiche assegnate a Operatore Demo.")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(bar).toBeHidden();
  // No longer unassigned: they left this view.
  for (const label of labels)
    await expect(page.getByRole("checkbox", { name: label })).toHaveCount(0);

  await showQueue(page, "");
  for (const label of labels) {
    const row = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("checkbox", { name: label }) });
    await expect(row.getByText("Operatore Demo", { exact: true })).toBeVisible();
    await row.getByRole("checkbox", { name: label }).check();
  }

  // Leave the demo data as it was for the other tests.
  await page.getByRole("button", { name: "Assegna a…" }).click();
  const undo = page.getByRole("dialog", { name: "Assegna 2 pratiche" });
  await undo.getByRole("radio", { name: /Nessuno/ }).check();
  await undo.getByRole("button", { name: "Togli l'assegnazione a 2 pratiche" }).click();
  await expect(page.getByText("2 pratiche sono di nuovo senza assegnazione.")).toBeVisible();
});
