import { expect, request, test, type Page } from "@playwright/test";
import type { Language } from "@avanti/contracts";
import { LANGUAGES } from "@avanti/contracts/constants";
import { messagesFor } from "../src/lib/citizen/messages";

/** Browsers send Origin on every POST and production requires it; Playwright's API client doesn't. */
function origin() {
  return { Origin: new URL(test.info().project.use.baseURL!).origin };
}

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
      headers: origin(),
      data: { type: "answer", questionId: q.id, value },
    });
    expect(response.ok(), `answer ${q.id}: ${await response.text()}`).toBeTruthy();
  }
  throw new Error("Interview did not finish");
}

/** Opens a case at the demo office, optionally with a first story, without the UI. */
async function startCase(page: Page, story?: string, language: Language = "it") {
  const started = await page.request.post("/api/intake", {
    headers: origin(),
    data: { officeSlug: "demo-milano-centro", language, privacyAccepted: true },
  });
  const { token } = (await started.json()) as { token: string };
  if (story) {
    const told = await page.request.post(`/api/c/${token}/turn`, {
      headers: origin(),
      data: { type: "text", text: story },
    });
    expect(told.ok(), `story: ${await told.text()}`).toBeTruthy();
  }
  return token;
}

/** Sets the demo office's booking link and note as its admin would, in a separate session. */
async function setOfficeNextSteps(bookingUrl: string | null, citizenNote: string | null) {
  const baseURL = test.info().project.use.baseURL!;
  const admin = await request.newContext({ baseURL, extraHTTPHeaders: origin() });
  const login = await admin.post("/api/auth/login", {
    data: { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const office = (await (await admin.get("/api/offices/demo-milano-centro")).json()) as {
    office: { id: string };
  };
  const updated = await admin.patch(`/api/offices/${office.office.id}`, {
    data: { bookingUrl, citizenNote },
  });
  expect(updated.ok(), await updated.text()).toBeTruthy();
  await admin.dispose();
}

test("a citizen goes from the office QR to a submitted dossier", async ({ page }) => {
  await setOfficeNextSteps("https://prenota.example.it/milano", "Porta gli originali.");
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
  // Files are served as downloads: the photo opens in a preview instead.
  await page.getByRole("button", { name: /Anteprima: documento\.png/ }).click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByRole("img")).toBeVisible();
  await preview.getByRole("button", { name: "Chiudi" }).click();
  await expect(preview).toBeHidden();

  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await expect(page.getByRole("heading", { name: "Controlla e invia" })).toBeVisible();
  await page.getByLabel("Cognome").fill("Esempio");
  await page.getByRole("button", { name: "Invia allo sportello" }).click();
  await expect(page.getByText("Scrivi almeno un telefono o un'email.")).toBeVisible();

  await page.getByLabel("Telefono").fill("3330000000");
  // Next year's renewal reminder is opt-in.
  await expect(page.getByLabel(/Avvisami via email/)).not.toBeChecked();
  await page.getByLabel(/Confermo che le informazioni sono vere/).check();
  await page.getByRole("button", { name: "Invia allo sportello" }).click();
  await expect(
    page.getByRole("heading", { name: "Fatto. La pratica è allo sportello." }),
  ).toBeVisible();
  await expect(page.getByText(/AV-\d{4}-\d{6}/)).toBeVisible();
  // Uploads stop once sent: what is still missing is listed to bring to the desk.
  await expect(
    page.getByRole("heading", { name: "Porta anche questi documenti allo sportello" }),
  ).toBeVisible();
  // The renewal reminder can be turned on (and off again) after sending.
  const reminder = page.getByLabel(/Avvisami via email/);
  await expect(reminder).not.toBeChecked();
  await reminder.check();
  await expect(page.getByText("Scelta salvata")).toBeVisible();
  await expect(reminder).toBeChecked();
  // What to do next: the office's own booking site, opened without a referrer, and its note.
  const book = page.getByRole("link", { name: /Prenota l'appuntamento/ });
  await expect(book).toHaveAttribute("href", "https://prenota.example.it/milano");
  await expect(book).toHaveAttribute("rel", /noreferrer/);
  await expect(page.getByText("Porta gli originali.")).toBeVisible();
  await setOfficeNextSteps(null, null);
});

test("an invalid link explains what to do", async ({ page }) => {
  await page.goto("/pratica/link-non-valido");
  await expect(page.getByRole("heading", { name: "Link non valido" })).toBeVisible();
});

test("an unknown office says the QR is wrong", async ({ page }) => {
  await page.goto("/s/sportello-inesistente");
  await expect(page.getByRole("heading", { name: "Sportello non trovato" })).toBeVisible();
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

test("each script is drawn with its own font", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "asks Chrome which font actually rendered the text");
  // A generated fallback face once drew Arabic in Arial, and listing the script fonts
  // globally drew Latin headings in Noto Sans Bengali.
  for (const [locale, heading, body] of [
    ["it", /Bricolage Grotesque/, /Atkinson Hyperlegible Next/],
    ["ar", /Noto Sans Arabic/, /Noto Sans Arabic/],
    ["bn", /Noto Sans Bengali/, /Noto Sans Bengali/],
  ] as const) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto("/s/demo-milano-centro");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.evaluate(() => document.fonts.ready);
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const fontOf = async (selector: string) => {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      return fonts.map((font) => font.familyName).join(", ");
    };
    await expect.poll(() => fontOf("h1"), { message: `${locale} heading` }).toMatch(heading);
    await expect.poll(() => fontOf("main p"), { message: `${locale} body` }).toMatch(body);
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
  await page.setViewportSize({ width: 320, height: 640 });
  // One case, shown in each language: eight interviews would only exercise the rate limits.
  const token = await startCase(page, "Devo fare l'ISEE, vivo con mia moglie");
  await finishInterview(page, token);
  for (const language of LANGUAGES) {
    const m = messagesFor(language);
    const switched = await page.request.put(`/api/c/${token}/language`, {
      headers: origin(),
      data: { language },
    });
    expect(switched.ok(), language).toBeTruthy();
    await page.goto(`/pratica/${token}`);
    await page.getByRole("button", { name: m.docs.toReview }).click();
    await expect(page.getByRole("heading", { level: 1, name: m.review.title })).toBeVisible();
    expect(await layoutProblems(page), language).toEqual([]);
  }
});

test("a failed upload can be retried without choosing the photo again", async ({ page }) => {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo");
  await finishInterview(page, token);
  await page.goto(`/pratica/${token}`);
  await expect(page.getByRole("heading", { name: "I documenti da preparare" })).toBeVisible();

  // The waiting-room Wi-Fi drops during the first attempt.
  let attempts = 0;
  await page.route(/\/documents$/, (route) =>
    route.request().method() === "POST" && ++attempts === 1 ? route.abort() : route.fallback(),
  );
  await page
    .locator('input[type="file"][multiple]')
    .first()
    .setInputFiles({
      name: "documento.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByText(/1 di \d+ pronti/)).toBeVisible();
  expect(attempts).toBe(2);
});
