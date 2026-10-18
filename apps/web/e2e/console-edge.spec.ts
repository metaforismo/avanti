import { expect, test, type Page } from "@playwright/test";
import { finishInterview, logIn, origin, startCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };
const ADMIN = { email: "admin@demo.avanti.local", password: DEMO.password };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * A submitted case of its own, so these tests never change the demo cases other tests read.
 * `files` documents are attached to the first checklist items, ready for «Verifica».
 */
async function submittedCase(
  page: Page,
  contact: { firstName: string; lastName: string },
  files = 2,
  language: "it" | "ar" = "it",
) {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo.", language);
  await finishInterview(page, token);
  const citizen = await (await page.request.get(`/api/c/${token}`)).json();
  const items = (citizen.checklist as { id: string }[]).slice(0, files);
  for (const [index, item] of items.entries()) {
    const uploaded = await page.request.post(`/api/c/${token}/documents`, {
      headers: origin(),
      multipart: {
        file: { name: `documento-${index + 1}.png`, mimeType: "image/png", buffer: PNG },
        checklistItemId: item.id,
      },
    });
    expect(uploaded.ok(), await uploaded.text()).toBeTruthy();
  }
  // Submitting waits for the background analysis of the uploads.
  await expect(async () => {
    const sent = await page.request.post(`/api/c/${token}/submit`, {
      headers: origin(),
      data: { contact, confirmed: true },
    });
    expect(sent.ok(), await sent.text()).toBeTruthy();
  }).toPass({ timeout: 30_000 });
  return citizen.reference as string;
}

async function openCase(page: Page, reference: string) {
  const found = await (await page.request.get(`/api/cases?q=${reference}&status=submitted`)).json();
  const id = found.items[0].id as string;
  await page.goto(`/console/pratiche/${id}`);
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
  return id;
}

/** What an idle timeout, a deactivation or a password reset does to the open console. */
async function endSession(page: Page) {
  const ended = await page.request.post("/api/auth/logout", { headers: origin() });
  expect(ended.ok()).toBeTruthy();
}

test("a session that ends mid-review keeps the page and brings the operator back to it", async ({
  page,
}) => {
  await logIn(page, DEMO);
  await expect(page.getByRole("heading", { name: "Pratiche" })).toBeVisible();
  const reference = await submittedCase(page, { firstName: "Sessione", lastName: "Scaduta" });
  const id = await openCase(page, reference);

  await endSession(page);
  await page.getByLabel("Note interne").fill("Richiamare il cittadino giovedì");
  await page.getByRole("button", { name: "Verifica", exact: true }).first().click();

  const expired = page.getByRole("alert").filter({ hasText: "La sessione è scaduta" });
  await expect(expired).toBeVisible();
  // Nothing typed disappears and the page stays where it was.
  await expect(page).toHaveURL(new RegExp(`/console/pratiche/${id}$`));
  await expect(page.getByLabel("Note interne")).toHaveValue("Richiamare il cittadino giovedì");

  // The unsaved note makes the browser ask before leaving: the operator decides.
  page.once("dialog", (dialog) => void dialog.accept());
  await expired.getByRole("button", { name: "Accedi di nuovo" }).click();
  await expect(page).toHaveURL(/\/console\/accedi\?motivo=sessione&next=%2Fconsole%2Fpratiche/);
  await expect(page.getByText("La sessione è scaduta. Accedi di nuovo.")).toBeVisible();
  await logIn(page, DEMO);
  await expect(page).toHaveURL(new RegExp(`/console/pratiche/${id}$`));
  await expect(page.getByRole("heading", { name: "Documenti", exact: true })).toBeVisible();
});

test("a note saved on blur and a click on «Verifica» are both kept, without a false conflict", async ({
  page,
}) => {
  await logIn(page, DEMO);
  const reference = await submittedCase(page, { firstName: "Nota", lastName: "Contemporanea" });
  const id = await openCase(page, reference);

  await page.getByLabel("Note interne").fill("Documento letto allo sportello");
  // The click blurs the notes: their save and the verification leave at the same moment.
  await page.getByRole("button", { name: "Verifica", exact: true }).first().click();

  await expect(page.getByText("Salvate")).toBeVisible();
  await expect(page.getByText(/La pratica è cambiata nel frattempo/)).toHaveCount(0);
  await expect(async () => {
    const dossier = await (await page.request.get(`/api/cases/${id}`)).json();
    expect(dossier.internalNotes).toBe("Documento letto allo sportello");
    expect(dossier.checklist.some((item: { status: string }) => item.status === "verified")).toBe(
      true,
    );
  }).toPass();
});

test("a case deleted while open says so and leaves the recent list", async ({ page, browser }) => {
  await logIn(page, DEMO);
  const reference = await submittedCase(page, { firstName: "Pratica", lastName: "Eliminata" });
  const id = await openCase(page, reference);
  const recent = page.getByRole("navigation", { name: "Console" });
  await expect(recent.getByRole("link", { name: "Pratica Eliminata" })).toBeVisible();

  const admin = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await logIn(admin, ADMIN);
  const deleted = await admin.request.delete(`/api/cases/${id}`, {
    headers: origin(),
    data: { confirmReference: reference },
  });
  expect(deleted.status()).toBe(204);
  await admin.close();

  await page.getByRole("button", { name: "Verifica", exact: true }).first().click();
  await expect(page.getByText("Pratica non trovata", { exact: true })).toBeVisible();
  await expect(recent.getByRole("link", { name: "Pratica Eliminata" })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("option", { name: /Pratica Eliminata/ })).toHaveCount(0);
});

test("a queue link with outdated or hand-edited filters still opens the queue", async ({
  page,
}) => {
  await logIn(page, DEMO);
  await page.goto(
    `/console?stato=archiviate&pratica=nope&assegnatario=xyz&priorita=toString&q=${"a".repeat(150)}`,
  );
  await expect(page.getByRole("button", { name: /^Da revisionare/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Impossibile caricare le pratiche.")).toHaveCount(0);
  await expect(page.getByLabel("Cerca pratiche")).toHaveValue("a".repeat(100));
});

test("an admin demoted while on an admin page sees it at the next action", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  await logIn(admin, ADMIN);
  const email = `e2e.ruolo.${Date.now()}@demo.avanti.local`;
  const created = await (
    await admin.request.post("/api/operators", {
      headers: origin(),
      data: { name: "Seconda Amministratrice", email, role: "admin" },
    })
  ).json();

  await logIn(page, { email, password: created.temporaryPassword });
  await page.getByLabel("Password temporanea").fill(created.temporaryPassword);
  await page.getByLabel("Nuova password", { exact: true }).fill("una frase lunga per e2e");
  await page.getByLabel("Ripeti la nuova password").fill("una frase lunga per e2e");
  await page.getByRole("button", { name: "Salva ed entra" }).click();
  await page.getByRole("link", { name: "Registro attività" }).click();
  await expect(page.getByRole("heading", { name: "Registro attività" })).toBeVisible();

  const demoted = await admin.request.patch(`/api/operators/${created.operator.id}`, {
    headers: origin(),
    data: { role: "operator" },
  });
  expect(demoted.ok()).toBeTruthy();
  await admin.close();

  // Any request of the page notices the new role; a filter change forces one if none came yet.
  const filter = page.getByLabel("Cosa cerchi");
  if (await filter.isVisible()) await filter.selectOption({ label: "Accessi" });
  await expect(page.getByRole("heading", { name: "Registro riservato" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Registro attività" })).toHaveCount(0);
});

test("the document viewer follows quick arrow presses and reports a failed decision", async ({
  page,
}) => {
  await logIn(page, DEMO);
  const reference = await submittedCase(page, { firstName: "Visore", lastName: "Tastiera" }, 4);
  const id = await openCase(page, reference);
  const dossier = await (await page.request.get(`/api/cases/${id}`)).json();
  await page.goto(`/console/pratiche/${id}?documento=${dossier.documents[0].id}`);
  const viewer = page.getByRole("dialog");
  const position = viewer.getByText(/^\d+ \/ \d+$/);
  await expect(position).toHaveText("1 / 4");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(position).toHaveText("4 / 4");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(position).toHaveText("2 / 4");

  await endSession(page);
  await page.keyboard.press("v");
  // The page's own notice sits under the viewer: the reason shows inside it.
  await expect(viewer.getByRole("alert")).toContainText("Accedi");
  await expect(position).toHaveText("2 / 4");
});

test("long unbroken names and an Arabic-speaking citizen never widen the page", async ({
  page,
}) => {
  await logIn(page, DEMO);
  const reference = await submittedCase(
    page,
    {
      firstName: "Abdulrahman-Al-Hashimi-Wa-Al-Qurashi-Bin-Abdullah-Ibn-Abdulaziz-Ibn-Saud-Al-Ma",
      lastName: "محمدعبدالرحمنالهاشميوالقرشيبنعبداللهابنعبدالعزيزابنسعودمحمدعبدالرحمنالهاشمي",
    },
    2,
    "ar",
  );
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await openCase(page, reference);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test("a refused export says why instead of failing as a browser download", async ({ page }) => {
  await logIn(page, DEMO);
  const reference = await submittedCase(page, { firstName: "Esporta", lastName: "Fascicolo" }, 0);
  await openCase(page, reference);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Altro" }).click();
  await page.getByRole("menuitem", { name: "Scarica fascicolo PDF" }).click();
  expect((await download).suggestedFilename()).toBe(`${reference}.pdf`);

  await endSession(page);
  await page.getByRole("button", { name: "Altro" }).click();
  await page.getByRole("menuitem", { name: "Scarica dati JSON" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Download non riuscito" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "La sessione è scaduta" })).toBeVisible();
});
