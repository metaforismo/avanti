import { expect, test } from "@playwright/test";
import { logIn, origin, startCase, submittedCase } from "./helpers";

test("the QR page explains the data in the chosen language before anything is kept", async ({
  page,
}) => {
  await page.goto("/s/demo-milano-centro");
  await page.getByText("Română").click();
  await page.getByRole("link", { name: "Citește nota de informare" }).click();
  const sheet = page.getByRole("dialog", { name: "Datele tale" });
  await expect(sheet.getByText("CAF Demo Milano este operatorul de date")).toBeVisible();
  // Nothing exists yet: no copy to download, nothing to delete.
  await expect(sheet.getByRole("button", { name: "Descarcă copia" })).toHaveCount(0);
  await expect(
    sheet.getByRole("link", { name: "Informarea completă (în italiană)" }),
  ).toHaveAttribute("href", "/privacy");
});

test("a citizen downloads a copy and erases a practice never sent", async ({ page }) => {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo.");
  await page.goto(`/pratica/${token}`);
  await page.getByRole("button", { name: "I tuoi dati e la privacy" }).click();
  const sheet = page.getByRole("dialog", { name: "I tuoi dati" });
  await expect(sheet.getByText(/i dati restano ancora \d+ giorni/)).toBeVisible();
  await expect(sheet.getByText("Non hai ancora caricato documenti.")).toBeVisible();

  const download = page.waitForEvent("download");
  await sheet.getByRole("button", { name: "Scarica la copia" }).click();
  expect((await download).suggestedFilename()).toMatch(/^avanti-AV-\d{4}-\d{6}\.zip$/);

  await sheet.getByRole("button", { name: "Cancella la pratica…" }).click();
  const confirm = page.getByRole("dialog", { name: "Cancellare la pratica?" });
  await confirm.getByRole("button", { name: "Sì, cancella tutto" }).click();
  await expect(page.getByRole("heading", { name: "Pratica cancellata" })).toBeVisible();
  expect((await page.request.get(`/api/c/${token}`)).status()).toBe(404);
  // The QR page no longer offers to resume a practice that is gone.
  await page.goto("/s/demo-milano-centro");
  await expect(page.getByText("Riprendi la pratica iniziata")).toHaveCount(0);
});

test("after sending, the citizen asks the CAF to erase and sees the request", async ({ page }) => {
  const { token } = await submittedCase(
    page,
    { firstName: "Privacy", lastName: "Esempio" },
    { files: 0 },
  );
  await page.goto(`/pratica/${token}`);
  await page.getByRole("button", { name: "I tuoi dati e la privacy" }).click();
  const sheet = page.getByRole("dialog", { name: "I tuoi dati" });
  await expect(sheet.getByRole("button", { name: "Cancella la pratica…" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Chiedi la cancellazione…" }).click();
  await page
    .getByRole("dialog", { name: "Chiedere la cancellazione?" })
    .getByRole("button", { name: "Invia la richiesta" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "I tuoi dati" }).getByText(/^Richiesta inviata il/),
  ).toBeVisible();
  // A second request changes nothing: the desk sees one.
  const again = await page.request.post(`/api/c/${token}/erasure-request`, { headers: origin() });
  expect(again.ok()).toBeTruthy();
});

test("a link the desk replaced never claims the practice was deleted", async ({
  page,
  browser,
}) => {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo.");
  const { id } = (await (await page.request.get(`/api/c/${token}`)).json()) as { id: string };
  await page.goto(`/pratica/${token}`);
  await page.getByRole("button", { name: "I tuoi dati e la privacy" }).click();
  await page
    .getByRole("dialog", { name: "I tuoi dati" })
    .getByRole("button", { name: "Cancella la pratica…" })
    .click();

  // Meanwhile the desk gives the citizen a new link: the open page still holds the old one.
  const desk = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const deskPage = await desk.newPage();
    await logIn(deskPage, { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" });
    const rotated = await deskPage.request.post(`/api/cases/${id}/link`, { headers: origin() });
    expect(rotated.ok(), await rotated.text()).toBeTruthy();
  } finally {
    await desk.close();
  }

  const confirm = page.getByRole("dialog", { name: "Cancellare la pratica?" });
  await confirm.getByRole("button", { name: "Sì, cancella tutto" }).click();
  await expect(confirm.getByText(/^Questo link non è più valido\./)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pratica cancellata" })).toHaveCount(0);
});
