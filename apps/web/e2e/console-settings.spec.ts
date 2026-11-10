import { expect, test, type Page } from "@playwright/test";
import { logIn } from "./helpers";

// Demo credentials created by `pnpm db:seed`; never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

async function openSettings(page: Page) {
  await page.goto("/console/accedi");
  await logIn(page, ADMIN);
  // The menu is closed on a phone: go straight there.
  await page.goto("/console/impostazioni");
  await expect(page.getByRole("heading", { name: "Parametri" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Validità dei link per i cittadini" }),
  ).toBeVisible();
}

test("numeric settings take only whole numbers in their range, and say so", async ({ page }) => {
  await openSettings(page);
  const links = page.getByRole("textbox", { name: "Validità dei link per i cittadini" });
  const baseline = page.getByRole("textbox", { name: "Minuti per pratica prima di Avanti" });
  await expect(links).toHaveAttribute("inputmode", "numeric");

  // Letters, signs and decimals never reach the field, typed or pasted.
  await baseline.fill("");
  await baseline.pressSequentially("5 modificato");
  await expect(baseline).toHaveValue("5");
  await links.fill("");
  await links.pressSequentially("-1.5e");
  await expect(links).toHaveValue("15");
  await links.fill("");
  await links.pressSequentially("9999");
  await expect(links).toHaveValue("999");

  // Out of range: the reason is on the row as soon as the field is left, and a save is refused.
  let patches = 0;
  page.on(
    "request",
    (r) => r.url().endsWith("/api/settings") && r.method() === "PATCH" && patches++,
  );
  await links.fill("0");
  await baseline.focus();
  await expect(
    page.getByRole("alert").filter({ hasText: "Inserisci un numero intero tra 1 e 365 giorni." }),
  ).toBeVisible();
  await expect(links).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Salva parametri" }).click();
  await expect(links).toBeFocused();
  expect(patches).toBe(0);

  // Fixing the value clears the error.
  await links.fill("30");
  await expect(page.getByRole("alert").filter({ hasText: "Inserisci un numero" })).toHaveCount(0);
  await expect(links).not.toHaveAttribute("aria-invalid", "true");

  // The percentage fields have their own range.
  const critical = page.getByRole("textbox", { name: "Soglia di lettura, dati critici" });
  await critical.fill("50");
  await baseline.focus();
  await expect(
    page.getByRole("alert").filter({ hasText: "Inserisci una percentuale tra 80 e 100." }),
  ).toBeVisible();

  // The optional baseline may stay empty.
  await critical.fill("98");
  await baseline.fill("");
  await links.focus();
  await expect(page.getByRole("alert").filter({ hasText: "Inserisci" })).toHaveCount(0);
});

for (const viewport of [
  { name: "1280", width: 1280, height: 720 },
  { name: "390", width: 390, height: 844 },
]) {
  test(`the unsaved-changes bar never covers a setting at ${viewport.name} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openSettings(page);
    const links = page.getByRole("textbox", { name: "Validità dei link per i cittadini" });
    await links.fill("31");
    const bar = page.getByRole("status").filter({ hasText: "Modifiche non ancora salvate" });
    await expect(bar).toBeVisible();

    // A strip at the top of the page, never an overlay fixed over what is scrolled below it.
    const strip = page.locator("#settings-strip");
    expect(await strip.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");

    const controls = page
      .locator("#settings-form")
      .locator("input:not([type=hidden]):enabled, select:enabled");
    const count = await controls.count();
    expect(count).toBeGreaterThan(10);
    const covered: string[] = [];
    for (let i = 0; i < count; i++) {
      const control = controls.nth(i);
      // Keyboard focus is how a field is reached from the bar's side: the browser scrolls it in.
      await control.focus();
      await page.waitForTimeout(30);
      const box = await control.boundingBox();
      const bar = await strip.boundingBox();
      const label = (await control.getAttribute("name")) ?? `#${i}`;
      if (!box || !bar) covered.push(`${label}: no box`);
      else if (box.y < bar.y + bar.height - 0.5 || box.y + box.height > viewport.height + 0.5)
        covered.push(
          `${label}: field ${box.y}-${box.y + box.height}, bar ends ${bar.y + bar.height}`,
        );
    }
    expect(covered).toEqual([]);

    // At the very end of the page the last row is clear too, and the bar is still within reach.
    await page.keyboard.press("End");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = controls.last();
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(viewport.height);
    await expect(bar).toBeInViewport();

    // It sits in the content column, not across the window.
    const column = (await page.locator("#settings-form").boundingBox())!;
    const strip2 = (await strip.boundingBox())!;
    expect(strip2.x).toBeGreaterThanOrEqual(column.x - 1);
    expect(strip2.x + strip2.width).toBeLessThanOrEqual(column.x + column.width + 1);

    // Nothing in the page is fixed over the content, apart from the shell's own app bar.
    const fixedOverContent = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main *")]
        .filter((el) => getComputedStyle(el).position === "fixed")
        .map((el) => el.tagName),
    );
    expect(fixedOverContent).toEqual([]);
  });
}

test("the section index follows the page and its segments jump to the sections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSettings(page);
  const index = page.getByRole("navigation", { name: "Sezioni" });
  const current = index.locator("[aria-current]");
  await expect(current).toHaveText("Operatori");

  await index.getByRole("link", { name: "Parametri" }).click();
  await expect(current).toHaveText("Parametri");
  // The heading lands below the strip, not under it.
  const heading = page.getByRole("heading", { name: "Parametri" });
  await expect(heading).toBeInViewport();
  const strip = (await page.locator("#settings-strip").boundingBox())!;
  expect((await heading.boundingBox())!.y).toBeGreaterThan(strip.y + strip.height);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(current).toHaveText("Operatori");
  await index.getByRole("link", { name: "Sportelli" }).click();
  await expect(current).toHaveText("Sportelli");
});
