import { expect, test } from "@playwright/test";
import { logIn } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };
const ADMIN = { email: "admin@demo.avanti.local", password: DEMO.password };

test("a quick reply goes into the request message where the cursor is", async ({ page }) => {
  await logIn(page, DEMO);
  await page.locator('a[href^="/console/pratiche/"]').first().click();
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
  await expect(message).toHaveValue(/^Buongiorno,\n.+\ngrazie\.$/s);

  // The draft is the operator's own now: closing asks before discarding it.
  page.once("dialog", (confirm) => void confirm.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("an administrator adds, reorders and removes a quick reply", async ({ page }) => {
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Impostazioni" }).click();
  const section = page.getByRole("region", { name: "Risposte rapide" });
  await expect(section.getByRole("listitem")).toHaveCount(4);

  await section.getByRole("button", { name: "Aggiungi" }).click();
  const form = page.getByRole("dialog", { name: "Nuova risposta rapida" });
  await form.getByLabel("Titolo").fill("Serve il codice fiscale");
  await form
    .getByLabel("Messaggio")
    .fill("Carica la foto della tessera sanitaria, fronte e retro.");
  await form.getByRole("button", { name: "Salva" }).click();
  await expect(section.getByRole("listitem")).toHaveCount(5);
  await expect(section.getByRole("listitem").last()).toContainText("Serve il codice fiscale");

  await section.getByRole("button", { name: "Sposta su: Serve il codice fiscale" }).click();
  await expect(section.getByRole("listitem").nth(3)).toContainText("Serve il codice fiscale");
  await page.reload();
  await expect(section.getByRole("listitem").nth(3)).toContainText("Serve il codice fiscale");

  await section.getByRole("button", { name: "Elimina: Serve il codice fiscale" }).click();
  await page.getByRole("button", { name: "Elimina «Serve il codice fiscale»" }).click();
  await expect(section.getByRole("listitem")).toHaveCount(4);
});
