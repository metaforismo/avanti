import { expect, test, type Page } from "@playwright/test";
import { finishInterview, startCase } from "./helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const box = (tag: string, ...content: Buffer[]) => {
  const body = Buffer.concat(content);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(8 + body.length);
  return Buffer.concat([size, Buffer.from(tag), body]);
};
/** The smallest HEIF the server accepts: its type and a 10×10 size, as iPhones write them. */
const HEIF = Buffer.concat([
  box("ftyp", Buffer.from("mif1"), Buffer.alloc(4), Buffer.from("mif1heic")),
  box(
    "meta",
    Buffer.alloc(4),
    box("iprp", box("ipco", box("ispe", Buffer.alloc(4), Buffer.from([0, 0, 0, 10, 0, 0, 0, 10])))),
  ),
]);

/** A one-page PDF, written by pdf-lib. */
const PDF = Buffer.from(
  "JVBERi0xLjcKJYGBgYEKCjEgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgMyAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKCjIgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDEgMCBSCj4+CmVuZG9iagoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMCAwIDEwMCAxMDAgXQo+PgplbmRvYmoKCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNiAwMDAwMCBuIAowMDAwMDAwMDc2IDAwMDAwIG4gCjAwMDAwMDAxMjYgMDAwMDAgbiAKCnRyYWlsZXIKPDwKL1NpemUgNAovUm9vdCAyIDAgUgo+PgoKc3RhcnR4cmVmCjIxNwolJUVPRg==",
  "base64",
);

async function openDocuments(page: Page) {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo");
  await finishInterview(page, token);
  await page.goto(`/pratica/${token}`);
  await expect(page.getByRole("heading", { name: "I documenti da preparare" })).toBeVisible();
  return token;
}

async function sendCase(page: Page) {
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await page.getByLabel("Cognome").fill("D'Angelo");
  await page.getByLabel("Telefono").fill("3330000000");
  await page.getByLabel(/Confermo che le informazioni sono vere/).check();
  await page.getByRole("button", { name: "Invia allo sportello" }).click();
}

const SENT = { name: "Fatto. La pratica è allo sportello." };

test("a second tab still open after sending shows the sent case instead of failing", async ({
  page,
  context,
}) => {
  const token = await openDocuments(page);
  const other = await context.newPage();
  await other.goto(`/pratica/${token}`);
  await expect(other.getByRole("heading", { name: "I documenti da preparare" })).toBeVisible();

  await sendCase(page);
  await expect(page.getByRole("heading", SENT)).toBeVisible();

  // The other tab tries to send again: the case is no longer editable.
  await sendCase(other);
  await expect(other.getByRole("heading", SENT)).toBeVisible();
});

test("sending again after a lost reply opens the sent case", async ({ page }) => {
  await openDocuments(page);
  // The case is sent, but the Wi-Fi drops before the reply arrives.
  let attempts = 0;
  await page.route(/\/submit$/, async (route) => {
    if (++attempts > 1) return route.fallback();
    await route.fetch();
    await route.abort("internetdisconnected");
  });
  await sendCase(page);
  await expect(page.getByText("Connessione assente. Controlla la rete e riprova.")).toBeVisible();
  await page.getByRole("button", { name: "Invia allo sportello" }).click();
  await expect(page.getByRole("heading", SENT)).toBeVisible();
});

test("confirming again after a lost reply does not leave the card stuck", async ({ page }) => {
  const token = await startCase(page, "Devo fare l'ISEE");
  await page.goto(`/pratica/${token}`);
  await page.getByLabel("Scrivi qui, con parole tue").fill("Vivo da solo in una casa in affitto");
  await page.getByRole("button", { name: "Invia", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Sì, è giusto" });
  await expect(confirm).toBeVisible();

  let attempts = 0;
  await page.route(/\/conversation\/confirm$/, async (route) => {
    if (++attempts > 1) return route.fallback();
    await route.fetch();
    await route.abort("internetdisconnected");
  });
  await confirm.click();
  await expect(page.getByText("Connessione assente. Controlla la rete e riprova.")).toBeVisible();
  await confirm.click();
  // The server already has the answers: the card goes away and the next question follows.
  await expect(confirm).toBeHidden();
  await expect(page.getByText(/Qualcosa non ha funzionato/)).toHaveCount(0);
});

test("photos with a misleading type are uploaded as what they are", async ({ page }) => {
  await openDocuments(page);
  const input = page.locator('input[type="file"][multiple]').last();
  // iPhone HEIF, a PNG renamed .jpg by a chat app, a PDF declared by an old phone as x-pdf.
  const files = [
    {
      name: "IMG_0001.HEIF",
      mimeType: "image/heif",
      buffer: HEIF,
    },
    { name: "scansione.jpg", mimeType: "image/jpeg", buffer: PNG },
    { name: "cu.pdf", mimeType: "application/x-pdf", buffer: PDF },
  ];
  for (const file of files) {
    const uploaded = page.waitForResponse(
      (r) => r.url().endsWith("/documents") && r.request().method() === "POST",
    );
    await input.setInputFiles(file);
    expect((await uploaded).status(), file.name).toBe(201);
  }
  await expect(page.getByText(/non è supportato/)).toHaveCount(0);
});

test("an upload that stalls on a dead Wi-Fi can be retried", async ({ page }) => {
  await page.clock.install();
  await openDocuments(page);
  let attempts = 0;
  // The first attempt never gets an answer, as on a Wi-Fi that is connected but dead.
  await page.route(/\/documents$/, (route) =>
    route.request().method() === "POST" && ++attempts === 1 ? undefined : route.fallback(),
  );
  await page
    .locator('input[type="file"][multiple]')
    .first()
    .setInputFiles({ name: "documento.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Caricamento in corso…")).toBeVisible();
  await page.clock.runFor(130_000);
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(page.getByText(/1 di \d+ pront[oi]/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Vai al riepilogo" })).toBeEnabled();
});

test("a slow assistant says to wait instead of sending again", async ({ page }) => {
  await page.clock.install();
  const token = await startCase(page);
  await page.goto(`/pratica/${token}`);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/turn$/, async (route) => {
    await held;
    await route.fallback();
  });
  await page.getByLabel("Cosa devi fare?").fill("Devo fare l'ISEE, vivo da solo");
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sto leggendo…" })).toBeVisible();
  await page.clock.runFor(9_000);
  await expect(page.getByText(/Resta su questa pagina: non serve inviare di nuovo/)).toBeVisible();
  release();
  await expect(page.getByRole("heading", { level: 1, name: "ISEE ordinario" })).toBeVisible();
  await expect(page.getByText(/non serve inviare di nuovo/)).toHaveCount(0);
});

test("trying again after a failed first load shows that it is loading", async ({ page }) => {
  const token = await startCase(page);
  // Offline until the error screen shows: the first load is tried twice before it does.
  let offline = true;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(new RegExp(`/api/c/${token}$`), async (route) => {
    if (offline) return route.abort("internetdisconnected");
    await held;
    await route.fallback();
  });
  await page.goto(`/pratica/${token}`);
  const retry = page.getByRole("button", { name: "Riprova" });
  await expect(retry).toBeVisible();
  offline = false;
  await retry.click();
  await expect(retry).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Caricamento…" })).toBeAttached();
  release();
  await expect(page.getByLabel("Cosa devi fare?")).toBeVisible();
});
