import { expect, test, type Locator, type Page } from "@playwright/test";
import { finishInterview, origin, startCase, submittedCase } from "./helpers";
import { messagesFor } from "../src/lib/citizen/messages";

/** The element on top at the centre of `target` is the target itself (or inside it). */
async function onTop(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  return target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit !== null && element.contains(hit);
  });
}

/** The bottom of `target` is above the top of the composer pinned to the bottom. */
async function clearOfComposer(page: Page, target: Locator) {
  const button = await target.boundingBox();
  const dockTop = await page.evaluate(() => {
    const height = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--citizen-dock"),
    );
    return window.innerHeight - height;
  });
  return button !== null && button.y + button.height <= dockTop + 1;
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`the composer never covers the card's main key at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const token = await startCase(page);
    await page.goto(`/pratica/${token}`);
    await page
      .getByLabel("Cosa devi fare?")
      .fill("Devo fare l'ISEE, vivo con mia moglie e ho un conto Fineco");
    await page.getByRole("button", { name: "Continua" }).click();

    // Facts understood from the story wait in a card: its key must be reachable, not under the
    // composer, which waits as a pill meanwhile.
    const confirm = page.getByRole("button", { name: "Sì, è giusto" });
    await expect(confirm).toBeVisible();
    await expect(page.getByRole("button", { name: "Scrivi qui, con parole tue" })).toBeVisible();
    await expect.poll(() => clearOfComposer(page, confirm)).toBe(true);
    expect(await onTop(confirm)).toBe(true);
    // The assistant says it in one line; the facts are only in the card.
    await expect(page.getByText("Ecco cosa ho capito: controlla qui sotto.")).toBeVisible();

    // A number question: «Continua» clear of the composer too.
    await confirm.click();
    await expect(confirm).toBeHidden();
    await finishInterviewUntil(page, token, "number");
    await page.reload();
    const next = page.getByRole("button", { name: "Continua" });
    await expect(next).toBeVisible();
    expect(await onTop(next)).toBe(true);

    // The pill opens into the full composer with the cursor in, and folds back when left empty.
    await page.getByRole("button", { name: "Scrivi qui, con parole tue" }).click();
    const box = page.getByRole("textbox", { name: "Scrivi qui, con parole tue" });
    await expect(box).toBeFocused();
    await box.blur();
    await expect(page.getByRole("button", { name: "Scrivi qui, con parole tue" })).toBeVisible();
  });
}

/** Answers through the API until the next question is of `kind`. */
async function finishInterviewUntil(page: Page, token: string, kind: string) {
  for (let i = 0; i < 30; i++) {
    const data = await (await page.request.get(`/api/c/${token}`)).json();
    const q = data.nextQuestion;
    if (!q || q.kind === kind) return;
    const value =
      q.kind === "yes_no"
        ? false
        : q.kind === "single_choice"
          ? q.options[0].value
          : q.kind === "multi_choice"
            ? [q.options[0].value]
            : q.kind === "members"
              ? [{ role: "richiedente", firstName: "Prova" }]
              : "Prova";
    const answered = await page.request.post(`/api/c/${token}/turn`, {
      headers: origin(),
      data: { type: "answer", questionId: q.id, value },
    });
    expect(answered.ok(), await answered.text()).toBeTruthy();
  }
}

test("a story Avanti cannot place keeps the citizen's words and offers the practices it names", async ({
  page,
}) => {
  const token = await startCase(page);
  await page.goto(`/pratica/${token}`);
  const story = "ISEE per l'assegno unico, vivo con mia moglie e due figli";
  const field = page.getByLabel("Cosa devi fare?");
  await field.fill(story);
  await page.getByRole("button", { name: "Continua" }).click();

  // The words stay on screen as the citizen's bubble, and the box is free for the next ones.
  await expect(page.locator('li[data-from="citizen"]').filter({ hasText: story })).toBeVisible();
  await expect(field).toHaveValue("");
  const offered = page.getByRole("list", { name: "Preferisco scegliere da un elenco" });
  await expect(offered.getByRole("button")).toHaveText(["ISEE ordinario", "Assegno unico"]);
  await offered.getByRole("button", { name: "ISEE ordinario" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ISEE ordinario" })).toBeVisible();
});

test("the practice code stays on one line at 320 px in every script", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  // The language is fixed once the case is sent: one case per script.
  for (const language of ["it", "ar", "bn"] as const) {
    const { token } = await submittedCase(
      page,
      { firstName: "Biglietto", lastName: "Stretto" },
      { files: 0, language },
    );
    await page.goto(`/pratica/${token}`);
    const code = page.locator("dd", { hasText: /^AV-\d{4}-\d{6}$/ });
    await expect(code).toBeVisible();
    const lines = await code.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
    });
    expect(lines, language).toBe(1);
    const fits = await code.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(fits, language).toBe(true);
  }
});

test("in Arabic the Italian terms inside sentences stay whole and in order", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const m = messagesFor("ar");
  const token = await startCase(page, "Devo fare l'ISEE, vivo con mia moglie e ho un conto Fineco");
  // The quote of the citizen's words in the «understood» card: its own line, its own direction.
  const switched = await page.request.put(`/api/c/${token}/language`, {
    headers: origin(),
    data: { language: "ar" },
  });
  expect(switched.ok()).toBeTruthy();
  await page.goto(`/pratica/${token}`);
  const quote = page.locator("blockquote", { hasText: "Fineco" }).first();
  if ((await quote.count()) > 0) {
    await expect(quote).toHaveAttribute("dir", "auto");
    expect(await quote.evaluate((element) => getComputedStyle(element).display)).toBe("block");
  }

  await finishInterview(page, token);
  await page.goto(`/pratica/${token}`);
  await page.getByRole("button", { name: m.docs.toReview }).click();
  await expect(page.getByRole("heading", { level: 1, name: m.review.title })).toBeVisible();

  // Every bracketed Latin term in an Arabic line is isolated whole, brackets included.
  const loose = await page.locator("main").evaluate((main) => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const problems: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (!/[؀-ۿ]/.test(text)) continue;
      if (/\([^()]*[A-Za-z][^()]*\)/.test(text)) problems.push(text.trim());
    }
    return problems;
  });
  expect(loose).toEqual([]);
  await expect(page.locator("main bdi", { hasText: /^\(ISEE ordinario\)$/ }).first()).toBeVisible();
  await testInfo.attach("review-ar", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
