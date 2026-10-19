import { expect, test } from "@playwright/test";
import { logIn, openCase, origin, submittedCase } from "./helpers";

const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

test("an admin sees a citizen's erasure request with its deadline and can keep the case", async ({
  page,
}) => {
  const { id, reference, token } = await submittedCase(
    page,
    { firstName: "Cancellazione", lastName: "Esempio" },
    { files: 0 },
  );
  const asked = await page.request.post(`/api/c/${token}/erasure-request`, { headers: origin() });
  expect(asked.ok(), await asked.text()).toBeTruthy();

  await logIn(page, ADMIN);
  await page.goto("/console");
  await expect(
    page.getByRole("link", { name: new RegExp(reference) }).getByText("Chiede la cancellazione"),
  ).toBeVisible();
  await openCase(page, id);
  const notice = page.getByText("Il cittadino chiede di cancellare i suoi dati");
  await expect(notice).toBeVisible();
  await expect(page.getByText(/Rispondi entro il/)).toBeVisible();
  await page.getByRole("button", { name: "Conserva la pratica…" }).click();
  await page.getByRole("button", { name: "Ho risposto, conserva" }).click();
  await expect(notice).toHaveCount(0);
});
