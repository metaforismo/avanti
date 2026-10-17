import { expect, test } from "@playwright/test";
import { logIn, openFirstCaseInReview } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };
const ADMIN = { email: "admin@demo.avanti.local", password: DEMO.password };

test("a quick reply goes into the request message where the cursor is", async ({ page }) => {
  await logIn(page, DEMO);
  // A case already in review: asking for documents on a new one would start its review and
  // change the demo data other tests rely on.
  await openFirstCaseInReview(page);
  await page.getByRole("button", { name: "Chiedi integrazione" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Chiedi un'integrazione" });
  const message = dialog.getByLabel("Messaggio");
  await message.fill("Buongiorno, grazie.");
  // Cursor after "Buongiorno,": the reply lands between the greeting and the thanks.
  await message.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(11, 11));
  await dialog
    .getByRole("group", { name: "Risposte rapide" })
    .getByText("Foto illeggibile")
    .click();
  await expect(message).toHaveValue(/^Buongiorno,\n[^]+\ngrazie\.$/);

  // The draft is the operator's own now: closing asks before discarding it.
  page.once("dialog", (confirm) => void confirm.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("an administrator adds, reorders and removes a quick reply", async ({ page }) => {
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Impostazioni" }).click();
  const section = page.getByRole("region", { name: "Risposte rapide" });
  const items = section.getByRole("listitem");
  await expect(items.first()).toBeVisible();
  const seeded = await items.count();

  await section.getByRole("button", { name: "Aggiungi risposta" }).click();
  const form = page.getByRole("dialog", { name: "Nuova risposta rapida" });
  await form.getByLabel("Titolo").fill("Serve il codice fiscale");
  await form
    .getByLabel("Messaggio")
    .fill("Carica la foto della tessera sanitaria, fronte e retro.");
  await form.getByRole("button", { name: "Salva" }).click();
  await expect(items).toHaveCount(seeded + 1);
  await expect(items.last()).toContainText("Serve il codice fiscale");

  await section.getByRole("button", { name: "Sposta su: Serve il codice fiscale" }).click();
  await expect(items.nth(seeded - 1)).toContainText("Serve il codice fiscale");
  await page.reload();
  await expect(items.nth(seeded - 1)).toContainText("Serve il codice fiscale");

  await section.getByRole("button", { name: "Elimina: Serve il codice fiscale" }).click();
  await page.getByRole("button", { name: "Elimina «Serve il codice fiscale»" }).click();
  await expect(items).toHaveCount(seeded);
});
