import { expect, test } from "@playwright/test";
import { logIn, openFirstCaseInReview } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

test("in the document viewer, V verifies the item and moves to the next file to check", async ({
  page,
}) => {
  await logIn(page, DEMO);
  await openFirstCaseInReview(page);

  // Open the first document of an item that still needs a decision.
  const undecided = page
    .locator("section", { has: page.getByRole("heading", { name: "Documenti", exact: true }) })
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Verifica", exact: true }) })
    .first();
  await undecided.locator("button", { hasText: /\S/ }).first().click();
  const viewer = page.getByRole("dialog");
  const decision = viewer.getByRole("region", { name: "Decisione sulla voce" });
  await expect(decision).toBeVisible();
  const itemTitle = (await decision.locator("p.font-semibold").innerText()).split(" · ")[0]!;
  const position = viewer.getByText(/^\d+ \/ \d+$/);
  const before = await position.innerText();

  await page.keyboard.press("v");
  // The viewer moves on to another file, or stays on the last one with the decision recorded.
  await expect(async () => {
    const moved = (await position.innerText()) !== before;
    const verified = (await decision.innerText()).includes("Verificato");
    expect(moved || verified).toBe(true);
  }).toPass();

  // Undo, so the demo case is left as the seed made it.
  await page.keyboard.press("Escape");
  // Rows of the checklist only: the copilot's points also cite item titles.
  const checklist = page.locator("section", {
    has: page.getByRole("heading", { name: "Documenti", exact: true }),
  });
  const row = checklist.getByRole("listitem").filter({ hasText: itemTitle }).first();
  await row
    .getByRole("button", { name: new RegExp(`^Annulla la decisione su ${itemTitle}`) })
    .click();
  await expect(row.getByRole("button", { name: "Verifica", exact: true })).toBeVisible();
});
