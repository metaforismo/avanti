import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const webRequire = createRequire(resolve(root, "apps/web/package.json"));
const apiRequire = createRequire(resolve(root, "packages/api/package.json"));
const { chromium, expect } = webRequire("@playwright/test");
const { PDFDocument, StandardFonts } = apiRequire("pdf-lib");
const origin = process.env.PREVIEW_URL ?? "http://localhost:3417";
const output = resolve(root, "output/playwright");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  baseURL: origin,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const sandboxErrors = [];
page.on("console", (message) => {
  if (/blocked.*script|sandbox/i.test(message.text())) sandboxErrors.push(message.text());
});
try {
  const login = await context.request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" },
  });
  expect(login.status()).toBe(200);
  const intake = await context.request.post("/api/intake", {
    data: {
      officeSlug: "demo-milano-centro",
      language: "it",
      privacyAccepted: true,
      practiceId: "isee_ordinario",
    },
  });
  expect(intake.status()).toBe(201);
  const { token, case: dossier } = await intake.json();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([600, 400]).drawText("ANTEPRIMA PDF - ESEMPIO", { x: 40, y: 220, size: 24, font });
  const uploadedPdf = await context.request.post(`/api/c/${token}/documents`, {
    multipart: {
      file: {
        name: "anteprima-esempio.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(await pdf.save()),
      },
    },
  });
  expect(uploadedPdf.status()).toBe(201);
  const pdfDocument = (await uploadedPdf.json()).documents[0];
  await page.goto(`/console/pratiche/${dossier.id}?documento=${pdfDocument.id}`);
  const iframe = page.locator(`iframe[title="${pdfDocument.fileName}"]`);
  await expect(iframe).toBeVisible({ timeout: 30000 });
  await expect
    .poll(() => page.frames().some((frame) => frame.url().startsWith("chrome-extension://")), {
      timeout: 15000,
    })
    .toBe(true);
  await page.screenshot({ path: resolve(output, "pdf-preview.png") });
  expect(sandboxErrors).toEqual([]);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  );
  const uploadedImage = await context.request.post(`/api/c/${token}/documents`, {
    multipart: { file: { name: "immagine-esempio.png", mimeType: "image/png", buffer: png } },
  });
  expect(uploadedImage.status()).toBe(201);
  const imageDocument = (await uploadedImage.json()).documents.find(
    (doc) => doc.mimeType === "image/png",
  );
  await page.goto(`/console/pratiche/${dossier.id}?documento=${imageDocument.id}`);
  const image = page.getByRole("dialog").locator("img");
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
    .toBe(true);
  await page.screenshot({ path: resolve(output, "image-preview.png") });
  console.info(
    JSON.stringify({
      pdfInConsoleIframe: "PASS",
      imageInConsoleImg: "PASS",
      sandboxErrors: sandboxErrors.length,
    }),
  );
} finally {
  await context.close();
  await browser.close();
}
