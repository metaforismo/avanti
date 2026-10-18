import { expect, test } from "@playwright/test";
import { logIn, openCase, submittedCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("in the document viewer, V verifies the item and moves to the next file to check", async ({
  page,
}) => {
  await logIn(page, DEMO);
  // Two files on two items, both still to decide.
  const { id } = await submittedCase(page, { firstName: "Visore", lastName: "Verifica" });
  await openCase(page, id);

  // Rows of the checklist only: the copilot's points also cite item titles.
  const checklist = page.locator("section", {
    has: page.getByRole("heading", { name: "Documenti", exact: true }),
  });
  await checklist.getByRole("button", { name: /^documento-1\.png/ }).click();
  const viewer = page.getByRole("dialog");
  const decision = viewer.getByRole("region", { name: "Decisione sulla voce" });
  await expect(decision).toBeVisible();
  const itemTitle = (await decision.locator("p.font-semibold").innerText()).split(" · ")[0]!;
  const position = viewer.getByText(/^\d+ \/ 2$/);
  const before = await position.innerText();

  await page.keyboard.press("v");
  // The other file is still to check: the viewer moves on to it.
  await expect(position).not.toHaveText(before);

  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  const row = checklist.getByRole("listitem").filter({ hasText: itemTitle }).first();
  await expect(
    row.getByRole("button", {
      name: new RegExp(`^Annulla la decisione su ${escapeRegExp(itemTitle)}`),
    }),
  ).toBeVisible();
});
