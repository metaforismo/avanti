import { expect, test, type Page } from "@playwright/test";
import { logIn, openCase, openFirstCaseInReview, origin, submittedCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

/** A submitted case of its own with two files, opened: these tests never change the demo cases. */
async function caseWithTwoFiles(page: Page, lastName: string, fileNames?: string[]) {
  const { id } = await submittedCase(page, { firstName: "Fascicolo", lastName }, { fileNames });
  await openCase(page, id);
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

  const request = page.getByRole("button", { name: "Chiedi integrazione" });
  const ready = page.getByRole("button", { name: "Segna come pronta" });
  const more = page.getByRole("button", { name: "Altro" });
  const back = backToQueue(page);
  const [requestBox, readyBox, moreBox, backBox] = await Promise.all([
    request.boundingBox(),
    ready.boundingBox(),
    more.boundingBox(),
    back.boundingBox(),
  ]);
  // One row of 32px controls: the back link and every action share the same vertical band.
  for (const box of [requestBox!, readyBox!, moreBox!]) {
    expect(Math.abs(box.y + box.height / 2 - (backBox!.y + backBox!.height / 2))).toBeLessThan(4);
    expect(box.height).toBe(32);
  }
  // Taking the case sits by the assignee, under the name, not in the bar.
  await expect(page.locator("header").getByRole("button", { name: "Assegna a me" })).toBeVisible();

  await page.getByRole("heading", { name: "Documenti", exact: true }).scrollIntoViewIfNeeded();
  await expect(ready).toBeInViewport();
  const after = (await ready.boundingBox())!;
  expect(after.y).toBeLessThan(40);
});

test("«Chiedi al fascicolo» never covers the dossier, on a desktop or a phone", async ({
  page,
}) => {
  await logIn(page, DEMO);
  await caseWithTwoFiles(page, "Copertura");

  // Desktop: a quiet action of the top bar, nothing floating over the page.
  await page.setViewportSize({ width: 1440, height: 900 });
  const ask = page.getByRole("button", { name: "Chiedi", exact: true });
  await expect(ask).toBeVisible();
  expect((await ask.boundingBox())!.y).toBeLessThan(40);
  const notes = page.getByRole("textbox", { name: /Note interne/ });
  for (const target of [page.getByRole("heading", { name: "Cronologia" }), notes]) {
    // At the bottom edge of the window, where a floating button would sit.
    await target.evaluate((el) => el.scrollIntoView({ block: "end" }));
    const box = (await target.boundingBox())!;
    const covered = await target.evaluate(
      (el, at) => {
        const hit = document.elementFromPoint(at.x, at.y);
        return !(hit === el || el.contains(hit));
      },
      { x: box.x + box.width - 4, y: Math.min(box.y + box.height - 4, 900 - 4) },
    );
    expect(covered, "the bottom-right corner of the aside is visible").toBe(false);
  }
  await ask.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  // ⌘J / Ctrl+J opens it from anywhere on the dossier.
  await page.keyboard.press("ControlOrMeta+j");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  // Phone: the actions are a bar under the thumb, and the page ends above it.
  await page.setViewportSize({ width: 390, height: 844 });
  const dock = page.getByRole("toolbar", { name: "Azioni sulla pratica" });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("button", { name: "Chiedi integrazione" })).toBeVisible();
  await page.mouse.wheel(0, 20_000);
  await page.waitForFunction(
    () => Math.abs(window.scrollY + window.innerHeight - document.body.scrollHeight) < 2,
  );
  const dockTop = (await dock.boundingBox())!.y;
  const lastBottom = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    let bottom = 0;
    for (const el of main.querySelectorAll("section, aside > *")) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) bottom = Math.max(bottom, rect.bottom);
    }
    return bottom;
  });
  expect(lastBottom, "the last section ends above the action bar").toBeLessThanOrEqual(dockTop);
  // «Chiedi al fascicolo» is in «Altro» there, with the steps the bar has no room for.
  await dock.getByRole("button", { name: "Altro" }).click();
  await page.getByRole("menuitem", { name: "Chiedi al fascicolo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
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
