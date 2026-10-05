import { expect, test, type Page } from "@playwright/test";

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
  await expect(page.getByText("ISEE ordinario")).toBeVisible();

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
