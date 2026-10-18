import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { logIn, openFirstReadyCase } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const ADMIN = { email: "admin@demo.avanti.local", password: "DemoAvanti2027!" };

/** Names from the central directory: enough to see order and naming without an unzip library. */
function zipNames(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = bytes.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let n = 0; n < bytes.readUInt16LE(end + 10); n++) {
    const length = bytes.readUInt16LE(at + 28);
    names.push(bytes.subarray(at + 46, at + 46 + length).toString("utf8"));
    at += 46 + length + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return names;
}

test("every original of a ready case downloads as one ZIP, named and in dossier order", async ({
  page,
}) => {
  await logIn(page, ADMIN);
  await openFirstReadyCase(page);

  const button = page.getByRole("button", { name: "Scarica tutti" });
  await expect(button).toHaveAccessibleDescription(/^\d+ document[oi] in un file ZIP \(/);
  const download = page.waitForEvent("download");
  await button.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/ - AV-\d{4}-\d{6} - documenti\.zip$/);

  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const names = zipNames(bytes);
  expect(names.length).toBeGreaterThan(0);
  names.forEach((name, index) => {
    expect(name.startsWith(`${String(index + 1).padStart(2, "0")} `)).toBe(true);
    expect(name).not.toMatch(/[/\\]/);
  });

  // The download is in the activity log, under its own question.
  await page.getByRole("link", { name: "Registro attività" }).click();
  await page.getByLabel("Cosa cerchi").selectOption({ label: "Documenti scaricati in ZIP" });
  await expect(page.getByText("Documenti scaricati in un unico ZIP").first()).toBeVisible();
});
