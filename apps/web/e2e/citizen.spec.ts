import { expect, test, type Page } from "@playwright/test";
import type { Language } from "@avanti/contracts";
import { LANGUAGES } from "@avanti/contracts/constants";
import { messagesFor } from "../src/lib/citizen/messages";

/** Answers the remaining interview through the API: the UI for each kind is covered elsewhere. */
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
              ? Math.max(q.min ?? 1, 1)
              : q.kind === "members"
                ? [{ role: "richiedente", firstName: "Prova" }]
                : q.kind === "date"
                  ? "2025-06-01"
                  : "Prova";
    const response = await page.request.post(`/api/c/${token}/turn`, {
      data: { type: "answer", questionId: q.id, value },
    });
    expect(response.ok(), `answer ${q.id}`).toBeTruthy();
  }
  throw new Error("Interview did not finish");
}

/** Opens a case at the demo office, optionally with a first story, without the UI. */
async function startCase(page: Page, story?: string, language: Language = "it") {
  const started = await page.request.post("/api/intake", {
    data: { officeSlug: "demo-milano-centro", language, privacyAccepted: true },
  });
  const { token } = (await started.json()) as { token: string };
  if (story) {
    await page.request.post(`/api/c/${token}/turn`, { data: { type: "text", text: story } });
  }
  return token;
}

test("a citizen goes from the office QR to a submitted dossier", async ({ page }) => {
  await page.goto("/s/demo-milano-centro");
  await expect(page.getByRole("banner").getByText("CAF Demo Milano")).toBeVisible();
  await expect(page.getByText(/assistente automatico/)).toBeVisible();

  await page.getByRole("button", { name: "Inizia" }).click();
  await expect(page.getByText("Per iniziare devi accettare l'informativa.")).toBeVisible();
  await page.getByLabel("Ho letto l'informativa e voglio iniziare").check();
  await page.getByRole("button", { name: "Inizia" }).click();
  await page.waitForURL(/\/pratica\//);
  const token = page.url().split("/pratica/")[1]!;

  await page.getByLabel("Cosa devi fare?").fill("Devo fare l'ISEE, vivo da solo");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ISEE ordinario" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Documenti" })).toBeDisabled();

  await finishInterview(page, token);
  await page.reload();
  await expect(page.getByRole("heading", { name: "I documenti da preparare" })).toBeVisible();

  const firstFileInput = page.locator('input[type="file"][multiple]').first();
  await firstFileInput.setInputFiles({
    name: "documento.png",
    mimeType: "image/png",
    // 1×1 transparent PNG
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText(/1 di \d+ pronti/)).toBeVisible();

  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await expect(page.getByRole("heading", { name: "Controlla e invia" })).toBeVisible();
  await page.getByLabel("Cognome").fill("Esempio");
  await page.getByRole("button", { name: "Invia allo sportello" }).click();
  await expect(page.getByText("Scrivi almeno un telefono o un'email.")).toBeVisible();

  await page.getByLabel("Telefono").fill("3330000000");
  await page.getByLabel(/Confermo che le informazioni sono vere/).check();
  await page.getByRole("button", { name: "Invia allo sportello" }).click();
  await expect(
    page.getByRole("heading", { name: "Fatto. La pratica è allo sportello." }),
  ).toBeVisible();
  await expect(page.getByText(/AV-\d{4}-\d{6}/)).toBeVisible();
});

test("an invalid link explains what to do", async ({ page }) => {
  await page.goto("/pratica/link-non-valido");
  await expect(page.getByRole("heading", { name: "Link non valido" })).toBeVisible();
});

test("an unknown office says the QR is wrong", async ({ page }) => {
  await page.goto("/s/sportello-inesistente");
  await expect(
    page.getByText("Questo sportello non esiste o il link non è corretto."),
  ).toBeVisible();
});

test("the documents step fits a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const token = await startCase(page, "Devo fare l'ISEE, vivo con mia moglie e ho un conto Fineco");
  await finishInterview(page, token);

  await page.goto(`/pratica/${token}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "I documenti da preparare" }),
  ).toBeVisible();
  const overflowing = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const limit =
      main.getBoundingClientRect().right - parseFloat(getComputedStyle(main).paddingRight);
    return (
      Array.from(main.querySelectorAll("*"))
        // The bottom action bar is fixed and spans the screen on purpose.
        .filter((element) => !element.closest(".fixed"))
        .filter((element) => element.getBoundingClientRect().right > limit + 1)
        .map((element) => `${element.tagName} ${element.textContent?.slice(0, 40)}`)
    );
  });
  expect(overflowing).toEqual([]);
});

test("a story about a practice Avanti can't prepare yet offers the others", async ({ page }) => {
  const token = await startCase(page);
  await page.goto(`/pratica/${token}`);
  await page
    .getByLabel("Cosa devi fare?")
    .fill("Devo fare la domanda di NASpI, ho perso il lavoro");
  await page.getByRole("button", { name: "Continua" }).click();

  await expect(page.getByText(/non si può ancora preparare con Avanti/)).toBeVisible();
  // The list of practices opens by itself, and the citizen can pick one that works today.
  await expect(
    page.getByRole("button", { name: "Preferisco scegliere da un elenco" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /ISEE ordinario/ })).toBeEnabled();
});

test("Arabic and Bengali are drawn with their own fonts", async ({ browser }) => {
  for (const [locale, family] of [
    ["ar", "Noto Sans Arabic"],
    ["bn", "Noto Sans Bengali"],
  ] as const) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto("/s/demo-milano-centro");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    // A generated fallback face covering every code point once drew Arabic in Arial.
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => face.family.replace(/["']/g, ""));
    });
    expect(loaded).toContain(family);
    await context.close();
  }
});

/** Elements that leave the main column, and buttons whose label doesn't fit them. */
async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")!;
    const limit =
      main.getBoundingClientRect().right - parseFloat(getComputedStyle(main).paddingRight);
    const outside = Array.from(main.querySelectorAll("*"))
      .filter((element) => !element.closest(".fixed"))
      .filter((element) => element.getBoundingClientRect().right > limit + 1)
      .map((element) => `outside: ${element.tagName} ${element.textContent?.slice(0, 40)}`);
    const clipped = Array.from(document.querySelectorAll("button"))
      .filter((button) => button.scrollWidth > button.clientWidth + 1)
      .map((button) => `clipped: ${button.textContent?.slice(0, 40)}`);
    return [...outside, ...clipped];
  });
}

test("the review step fits a 320px phone in every language", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 640 });
  for (const language of LANGUAGES) {
    const m = messagesFor(language);
    const token = await startCase(page, "Devo fare l'ISEE, vivo con mia moglie", language);
    await finishInterview(page, token);
    await page.goto(`/pratica/${token}`);
    await page.getByRole("button", { name: m.docs.toReview }).click();
    await expect(page.getByRole("heading", { level: 1, name: m.review.title })).toBeVisible();
    expect(await layoutProblems(page), language).toEqual([]);
  }
});
