import { expect, test, type Page } from "@playwright/test";
import { logIn, openCase, submittedCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const OPERATOR = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

/** A surname no other test uses: the queue filtered on it holds only this test's cases. */
const unique = (label: string) => `${label}${Date.now().toString(36)}`;

const nextButton = (page: Page) => page.getByRole("button", { name: "Prossima pratica" });
const title = (page: Page) => page.getByRole("heading", { level: 1 });

/**
 * V in the viewer, then wait until it has moved on: the next file (or the end of the pass) is
 * what takes the next key, not the item just verified.
 */
async function verifyWithKeyboard(page: Page) {
  const viewer = page.getByRole("dialog");
  const shown = viewer.getByRole("heading", { level: 2 });
  const file = await shown.textContent();
  const reviewed = page.waitForResponse((r) => r.url().includes("/review") && r.ok());
  await page.keyboard.press("v");
  await reviewed;
  const back = viewer.getByRole("button", { name: "Torna al fascicolo" });
  await expect
    .poll(async () => (await back.isVisible()) || (await shown.textContent()) !== file)
    .toBe(true);
  // The next file's «Verifica» takes the keyboard once its panel is in place.
  if (!(await back.isVisible()))
    await expect(viewer.locator('[data-viewer-primary="true"]')).toBeFocused();
}

test("an operator goes through a filtered queue from case to case without the list", async ({
  page,
}) => {
  const surname = unique("Coda");
  // Oldest first: the order the queue shows with «In attesa da più tempo».
  for (const first of ["Anna", "Bruno", "Carla"])
    await submittedCase(page, { firstName: first, lastName: surname });
  await logIn(page, OPERATOR);
  await page.goto(`/console?q=${surname}&ordina=attesa`);
  const rows = page.getByRole("main").locator('a[href^="/console/pratiche/"]');
  await expect(rows).toHaveCount(3);
  await rows.first().click();
  await expect(title(page)).toHaveText(`Anna ${surname}`);

  // The whole check from the keyboard: V opens the pass, V verifies, Enter goes back.
  await page.keyboard.press("v");
  const viewer = page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  for (let i = 0; i < 2; i++) await verifyWithKeyboard(page);
  await expect(viewer.getByRole("button", { name: "Torna al fascicolo" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(viewer).toBeHidden();

  // I asks the citizen for the rest; then the next case is the main way on.
  await page.keyboard.press("i");
  const request = page.getByRole("dialog", { name: "Chiedi un'integrazione" });
  await request.getByRole("button", { name: "Invia al cittadino" }).click();
  await expect(request).toBeHidden();
  // No email: the console offers the WhatsApp/SMS message first.
  const notice = page.getByRole("dialog", { name: "Avvisa il cittadino" });
  await notice.getByRole("button", { name: "Chiudi" }).first().click();
  await expect(notice).toBeHidden();
  await expect(page.getByText("Attesa cittadino").first()).toBeVisible();

  await page.keyboard.press("n");
  await expect(title(page)).toHaveText(`Bruno ${surname}`);
  // Skipping a case moves forward, never back to it.
  await nextButton(page).click();
  await expect(title(page)).toHaveText(`Carla ${surname}`);
  await nextButton(page).click();
  await expect(
    page
      .getByRole("status")
      .getByText(`Nessun'altra pratica con questi filtri in «da revisionare».`),
  ).toBeVisible();
  await expect(title(page)).toHaveText(`Carla ${surname}`);

  // Back on the queue the case already sent to the citizen is gone at once, not after a refresh.
  await page.getByRole("main").getByRole("link", { name: "Pratiche", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=${surname}`));
  await expect(rows.filter({ hasText: `Anna ${surname}` })).toHaveCount(0);
  await expect(rows).toHaveCount(2);
});

test("ready, then closed from the bar, and the keyboard lands on the next case", async ({
  page,
}) => {
  const surname = unique("Chiusa");
  const { id } = await submittedCase(page, { firstName: "Dario", lastName: surname }, { files: 7 });
  await logIn(page, OPERATOR);
  await openCase(page, id);

  await page.keyboard.press("v");
  const viewer = page.getByRole("dialog");
  const back = viewer.getByRole("button", { name: "Torna al fascicolo" });
  while (!(await back.isVisible())) await verifyWithKeyboard(page);
  await page.keyboard.press("Enter");
  await expect(viewer).toBeHidden();

  await page.keyboard.press("p");
  const close = page.getByRole("button", { name: "Chiudi e archivia" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("dialog", { name: "Chiudere e archiviare la pratica?" });
  await confirm.getByRole("button", { name: "Chiudi e archivia" }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByText("Chiuse").first()).toBeVisible();
  await expect(nextButton(page)).toBeFocused();

  // The shortcuts are listed where every other one is.
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Scorciatoie da tastiera" });
  await expect(help.getByText("Prossima pratica della coda, con gli stessi filtri")).toBeVisible();
});

test("notes that failed to save are not left behind by «Prossima pratica»", async ({ page }) => {
  const surname = unique("Note");
  const { id } = await submittedCase(page, { firstName: "Elena", lastName: surname });
  await logIn(page, OPERATOR);
  await openCase(page, id);

  await page.route(`**/api/cases/${id}`, (route) =>
    route.request().method() === "PATCH" ? route.abort("internetdisconnected") : route.fallback(),
  );
  const notes = page.getByLabel("Note interne");
  await notes.fill("Richiamare dopo le 15");
  await notes.blur();
  await expect(page.getByText("Note non salvate.")).toBeVisible();

  let asked = "";
  page.once("dialog", (dialog) => {
    asked = dialog.message();
    void dialog.dismiss();
  });
  await nextButton(page).click();
  expect(asked).toContain("Le note interne non sono salvate");
  await expect(page).toHaveURL(new RegExp(`/console/pratiche/${id}`));
  await expect(notes).toHaveValue("Richiamare dopo le 15");
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
