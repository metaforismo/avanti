import { expect, request, test, type Page } from "@playwright/test";
import { finishInterview, origin, startCase } from "./helpers";

const PNG = {
  name: "documento.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
};

async function openDocuments(page: Page) {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo");
  await finishInterview(page, token);
  await page.goto(`/pratica/${token}`);
  await expect(page.getByRole("heading", { name: "I documenti da preparare" })).toBeVisible();
  return token;
}

/** Asks the citizen for one checklist item again, as an operator does from the console. */
async function requestItem(token: string, message: string) {
  const baseURL = test.info().project.use.baseURL!;
  const citizen = await request.newContext({ baseURL });
  const { reference } = (await (await citizen.get(`/api/c/${token}`)).json()) as {
    reference: string;
  };
  await citizen.dispose();
  const admin = await request.newContext({ baseURL, extraHTTPHeaders: origin() });
  const login = await admin.post("/api/auth/login", {
    data: { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  type Case = { id: string; reference: string; updatedAt: string };
  const list = (await (await admin.get(`/api/cases?q=${reference}`)).json()) as { items: Case[] };
  const id = list.items.find((item) => item.reference === reference)!.id;
  const read = async () =>
    (await (await admin.get(`/api/cases/${id}`)).json()) as {
      updatedAt: string;
      checklist: { id: string; title: string; required: boolean }[];
    };
  let current = await read();
  const review = await admin.patch(`/api/cases/${id}`, {
    data: { expectedUpdatedAt: current.updatedAt, status: "in_review" },
  });
  expect(review.ok(), await review.text()).toBeTruthy();
  current = await read();
  // The last required item: the one furthest down the citizen's list.
  const item = current.checklist.filter((i) => i.required).at(-1)!;
  const asked = await admin.post(`/api/cases/${id}/requests`, {
    data: { expectedUpdatedAt: current.updatedAt, checklistItemIds: [item.id], message },
  });
  expect(asked.ok(), await asked.text()).toBeTruthy();
  await admin.dispose();
  return item;
}

test("an answer given with a tap shows the question it answers", async ({ page }) => {
  const token = await startCase(page, "Devo fare l'ISEE, vivo da solo");
  // Two answers in a row: the second has no question just above it in the transcript.
  for (let i = 0; i < 2; i++) {
    const data = await (await page.request.get(`/api/c/${token}`)).json();
    const q = data.nextQuestion;
    const value =
      q.kind === "yes_no"
        ? false
        : q.kind === "number"
          ? Math.max(q.min ?? 1, 1)
          : q.kind === "members"
            ? [{ role: "richiedente", firstName: "Prova" }]
            : q.options?.[0]?.value;
    test.skip(value === undefined, `unexpected question kind ${q.kind}`);
    const answered = await page.request.post(`/api/c/${token}/turn`, {
      headers: origin(),
      data: { type: "answer", questionId: q.id, value },
    });
    expect(answered.ok(), await answered.text()).toBeTruthy();
  }
  const data = (await (await page.request.get(`/api/c/${token}`)).json()) as {
    answered: { questionId: string; question: string; answer: string }[];
  };
  const last = data.answered.at(-1)!;
  await page.goto(`/pratica/${token}`);
  const bubble = page.locator('li[data-from="citizen"]').filter({ hasText: last.question });
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText(last.answer);
});

test("an office request links to the document it asks for", async ({ page }) => {
  const token = await openDocuments(page);
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await page.getByLabel("Cognome").fill("Esempio");
  await page.getByLabel("Telefono").fill("3330000000");
  await page.getByLabel(/Confermo che le informazioni sono vere/).check();
  await page.getByRole("button", { name: "Invia allo sportello" }).click();
  await expect(
    page.getByRole("heading", { name: "Fatto. La pratica è allo sportello." }),
  ).toBeVisible();

  const item = await requestItem(token, "Serve anche il retro, con più luce.");
  await page.reload();
  const message = page.getByText("Serve anche il retro, con più luce.", { exact: true });
  await expect(message).toBeVisible();
  const link = page.getByRole("button", { name: new RegExp(`^${item.title}`) }).first();
  await expect(link).toBeVisible();
  await link.click();
  // The item's card comes into view and takes focus, below the sticky header.
  const target = page.locator(":focus");
  await expect(target).toContainText(item.title);
  await expect(target).toBeInViewport();
});

test("an upload lost with the connection is sent again once it is back", async ({
  page,
  context,
}) => {
  await openDocuments(page);
  await context.setOffline(true);
  await page.locator('input[type="file"][multiple]').first().setInputFiles(PNG);
  await expect(page.getByRole("button", { name: "Riprova" })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/1 di \d+ pront[oi]/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Riprova" })).toBeHidden();
});
