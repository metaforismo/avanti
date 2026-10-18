import { expect, test, type Page } from "@playwright/test";
import { finishInterview, logIn, openFirstCaseInReview, origin, startCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** A submitted case of its own with two files: these tests never change the demo cases. */
async function caseWithTwoFiles(
  page: Page,
  lastName: string,
  names = ["documento-1.png", "documento-2.png"],
) {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo.");
  await finishInterview(page, token);
  const citizen = await (await page.request.get(`/api/c/${token}`)).json();
  for (const [index, item] of (citizen.checklist as { id: string }[]).slice(0, 2).entries()) {
    const uploaded = await page.request.post(`/api/c/${token}/documents`, {
      headers: origin(),
      multipart: {
        file: { name: names[index]!, mimeType: "image/png", buffer: PNG },
        checklistItemId: item.id,
      },
    });
    expect(uploaded.ok(), await uploaded.text()).toBeTruthy();
  }
  await expect(async () => {
    const sent = await page.request.post(`/api/c/${token}/submit`, {
      headers: origin(),
      data: { contact: { firstName: "Fascicolo", lastName }, confirmed: true },
    });
    expect(sent.ok(), await sent.text()).toBeTruthy();
  }).toPass({ timeout: 30_000 });
  const found = await (
    await page.request.get(`/api/cases?q=${citizen.reference}&status=submitted`)
  ).json();
  await page.goto(`/console/pratiche/${found.items[0].id}`);
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
}

const backToQueue = (page: Page) =>
  page.getByRole("main").getByRole("link", { name: "Pratiche", exact: true });

test("«← Pratiche» goes back to the queue tab the case was opened from", async ({ page }) => {
  await logIn(page, DEMO);
  await openFirstCaseInReview(page);
  await backToQueue(page).click();
  await expect(page).toHaveURL(/\/console\?(.*&)?stato=in_review/);
  await expect(page.getByRole("button", { name: /^In revisione/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the person is the title and the actions stay in reach down the dossier", async ({ page }) => {
  await logIn(page, DEMO);
  await caseWithTwoFiles(page, "Titolo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fascicolo Titolo");

  await page.getByRole("heading", { name: "Documenti", exact: true }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 600);
  await expect(page.getByRole("heading", { level: 1 })).not.toBeInViewport();
  await expect(page.getByRole("button", { name: "Chiedi integrazione" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Segna come pronta" })).toBeInViewport();
});

test("at 1024px the action bar stays on one row and in reach", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await logIn(page, DEMO);
  await caseWithTwoFiles(page, "Stretto");

  const take = page.getByRole("button", { name: "Prendi in carico" });
  const ready = page.getByRole("button", { name: "Segna come pronta" });
  const back = backToQueue(page);
  const [takeBox, readyBox, backBox] = await Promise.all([
    take.boundingBox(),
    ready.boundingBox(),
    back.boundingBox(),
  ]);
  // One row: the back link and every action share the same vertical band.
  for (const box of [takeBox!, readyBox!]) {
    expect(Math.abs(box.y + box.height / 2 - (backBox!.y + backBox!.height / 2))).toBeLessThan(4);
  }

  await page.getByRole("heading", { name: "Documenti", exact: true }).scrollIntoViewIfNeeded();
  await expect(ready).toBeInViewport();
  const after = (await ready.boundingBox())!;
  expect(after.y).toBeLessThan(40);
});

test("a type guessed without AI has an Italian label and says where it comes from", async ({
  page,
}) => {
  await logIn(page, DEMO);
  // Without AI the type is guessed from the file name: the id behind it never shows.
  await caseWithTwoFiles(page, "Etichetta", ["identity.png", "documento-2.png"]);
  const checklist = page.locator("#checklist-section");
  const chip = checklist.getByRole("button", { name: /^Documento d’identità\s*dal nome file/ });
  await expect(chip).toBeVisible();
  await expect(checklist.getByRole("button", { name: /^identity/ })).toHaveCount(0);
  // A chip that only shows the file name claims nothing to qualify.
  await expect(checklist.getByRole("button", { name: "documento-2.png" })).toBeVisible();

  await chip.click();
  const viewer = page.getByRole("dialog");
  await expect(
    viewer.getByRole("heading", { name: "Documento d’identità", exact: true }),
  ).toBeVisible();
  await expect(viewer.getByText("Da controllare a vista")).toBeVisible();
  await expect(viewer.getByText("Poco leggibile")).toHaveCount(0);
});

test("a decision and its undo read as one unit at every width", async ({ page }) => {
  await logIn(page, DEMO);
  await caseWithTwoFiles(page, "Decisione");
  const row = page
    .locator("#checklist-section li")
    .filter({ has: page.getByText("Documento d’identità", { exact: true }) });
  await row.getByRole("button", { name: "Verifica" }).click();
  const pill = row.getByText("Verificato", { exact: true });
  const undo = row.getByRole("button", { name: /^Annulla la decisione su Documento d’identità/ });
  // The keyboard follows the swap of controls instead of falling back to <body>.
  await expect(undo).toBeFocused();
  const missing = page.locator("#checklist-section li").getByText("Mancante", { exact: true });

  for (const width of [1024, 1280, 1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await undo.scrollIntoViewIfNeeded();
    const [status, button] = [(await pill.boundingBox())!, (await undo.boundingBox())!];
    const gap = button.x - (status.x + status.width);
    expect(gap, `${width}px: undo right after the status`).toBeGreaterThanOrEqual(0);
    expect(gap, `${width}px: undo right after the status`).toBeLessThan(12);
    expect(Math.abs(button.y + button.height / 2 - (status.y + status.height / 2))).toBeLessThan(2);
    // The 32px icon answers clicks over a 44px area.
    const hit = await undo.evaluate(
      (el, at) => {
        const target = document.elementFromPoint(at.x, at.y);
        return target === el || el.contains(target);
      },
      { x: button.x - 4, y: button.y + button.height / 2 },
    );
    expect(hit, `${width}px: 44px target`).toBe(true);
    // Statuses still line up as a column from sm.
    if (width >= 640)
      expect(Math.abs((await missing.first().boundingBox())!.x - status.x)).toBeLessThan(1);
  }

  await undo.click();
  await expect(row.getByRole("button", { name: "Verifica" })).toBeFocused();
});

test("checking the files one by one ends back on the dossier, from the keyboard", async ({
  page,
}) => {
  await logIn(page, DEMO);
  await caseWithTwoFiles(page, "Sequenza");

  await page.getByRole("button", { name: "Controlla uno per uno" }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer.getByText("1 / 2")).toBeVisible();
  await page.keyboard.press("v");
  await expect(viewer.getByText("2 / 2")).toBeVisible();
  await page.keyboard.press("v");

  const back = viewer.getByRole("button", { name: "Torna al fascicolo" });
  await expect(
    viewer.getByText("Nessun altro documento da controllare.", { exact: true }),
  ).toBeVisible();
  await expect(back).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(viewer).toBeHidden();
  await expect(page).not.toHaveURL(/documento=/);
  // The button that opened the viewer is gone: the keyboard lands on the documents, not <body>.
  await expect(page.locator("#checklist-section")).toBeFocused();
  await expect(page.getByText("Verificato", { exact: true })).toHaveCount(2);
  // Nothing left to check: the shortcut into the viewer goes away.
  await expect(page.getByRole("button", { name: "Controlla uno per uno" })).toHaveCount(0);
});

test("an ended session shows a bar above the page, not over it", async ({ page }) => {
  await logIn(page, DEMO);
  await caseWithTwoFiles(page, "Sessione");
  const ended = await page.request.post("/api/auth/logout", { headers: origin() });
  expect(ended.ok()).toBeTruthy();

  await page.getByRole("button", { name: "Verifica", exact: true }).first().click();
  const expired = page.getByRole("alert").filter({ hasText: "La sessione è scaduta" });
  await expect(expired).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const bar = (await expired.boundingBox())!;
  const back = (await backToQueue(page).boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(back.y);
});
