import { expect, test, type Page } from "@playwright/test";
import { logIn, submittedCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

/** The queue filtered to the test's own cases, by assignee; "" is everyone. */
async function showQueue(page: Page, assignee: string) {
  // The list of this filter, not a reload or the previous filter's answer still on its way:
  // both show the same two cases, and a box ticked on the old list is dropped with it.
  const loaded = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/cases" &&
      (url.searchParams.get("assignee") ?? "") === assignee &&
      response.ok()
    );
  });
  await page.getByLabel("Filtra per operatore").selectOption(assignee);
  await loaded;
  await expect(page).toHaveURL(
    assignee ? new RegExp(`[?&]assegnatario=${assignee}`) : /^(?!.*assegnatario=)/,
  );
  await expect(
    page.getByRole("status").filter({ hasText: /pratic(?:a|he): da revisionare/ }),
  ).toBeAttached();
}

test("l'amministratore assegna due pratiche a un operatore", async ({ page }) => {
  await logIn(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  // Two unassigned cases of the test's own: assigning demo cases, or another test's, would
  // change them under the tests reading them at the same time.
  const family = `Assegnate ${test.info().workerIndex}${Date.now().toString(36)}`;
  for (const firstName of ["Prima", "Seconda"]) {
    await submittedCase(page, { firstName, lastName: family }, { files: 0 });
  }
  await page.goto(`/console?q=${encodeURIComponent(family)}`);
  await showQueue(page, "none");

  const boxes = page.getByRole("checkbox", { name: /^Seleziona .+ [A-Z]+-\d{4}-/ });
  await expect(boxes).toHaveCount(2);
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

  // Taking the assignment back is the same dialog.
  await page.getByRole("button", { name: "Assegna a…" }).click();
  const undo = page.getByRole("dialog", { name: "Assegna 2 pratiche" });
  await undo.getByRole("radio", { name: /Nessuno/ }).check();
  await undo.getByRole("button", { name: "Togli l'assegnazione a 2 pratiche" }).click();
  await expect(page.getByText("2 pratiche sono di nuovo senza assegnazione.")).toBeVisible();
});
