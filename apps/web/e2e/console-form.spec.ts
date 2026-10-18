import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { EARLY_SUBMIT_SCRIPT_HASH } from "../src/lib/early-submit";
import { holdScripts } from "./helpers";

// Demo credentials created by `pnpm db:seed` (see README); never valid outside local demo data.
const DEMO = { email: "operatore@demo.avanti.local", password: "DemoAvanti2027!" };

/** Login requests the page sends, counted from now. */
function countLogins(page: Page) {
  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/auth/login") && r.method() === "POST") sent.push(r.url());
  });
  return sent;
}

/** Resolves once `<Form>` has taken the form over: any replay has been queued by then. */
async function formReady(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector("form[data-early-submit]");
    return Boolean(form && (form as HTMLFormElement & { avantiFormReady?: true }).avantiFormReady);
  });
  // One more round trip: the replay runs in a microtask after the ready mark.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function heldLoginPage(page: Page) {
  const release = await holdScripts(page);
  await page.goto("/console/accedi", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO.password);
  return release;
}

test("without JavaScript a sign-in goes in the request body, never in the URL", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto("/console/accedi?next=%2Fconsole%2Fmetriche");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO.password);
  const posted = page.waitForRequest((r) => r.isNavigationRequest() && r.method() === "POST");
  await page.getByRole("button", { name: "Accedi" }).click();
  const request = await posted;
  expect(request.postData()).toContain("password=");
  const response = (await request.response())!;
  // The page comes back as it is: nothing of the body is read or shown again.
  expect(response.status()).toBe(200);
  expect(await response.text()).not.toContain(DEMO.password);
  expect(page.url()).not.toMatch(/[?&](email|password)=/);
  await expect(page.getByRole("heading", { name: "Accedi alla console" })).toBeVisible();
  await context.close();
});

test("the listener in the page is the script whose hash a strict CSP would allow", async ({
  page,
}) => {
  await page.goto("/console/accedi");
  const inline = await page.evaluate(() =>
    [...document.head.querySelectorAll("script:not([src])")]
      .map((script) => script.textContent ?? "")
      .find((text) => text.includes("data-early-submit")),
  );
  expect(inline, "early-submit script in <head>").toBeTruthy();
  const digest = createHash("sha256").update(inline!).digest("base64");
  expect(`'sha256-${digest}'`).toBe(EARLY_SUBMIT_SCRIPT_HASH);
});

test("a held sign-in pressed with a button of another form is still sent once", async ({
  page,
}) => {
  const release = await heldLoginPage(page);
  // An Enter or a script can name any element as submitter: only this form's own buttons count.
  await page.evaluate(() => {
    const other = document.createElement("form");
    const button = document.createElement("button");
    other.append(button);
    const form = document.querySelector<HTMLFormElement>("form[data-early-submit]")!;
    form.dispatchEvent(
      new SubmitEvent("submit", { submitter: button, bubbles: true, cancelable: true }),
    );
  });
  const logins = countLogins(page);
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/auth/login"));
  release();
  expect((await sent).postDataJSON()).toEqual({ email: DEMO.email, password: DEMO.password });
  await formReady(page);
  expect(logins).toHaveLength(1);
});

test("a held sign-in whose button was disabled meanwhile is not sent", async ({ page }) => {
  const release = await heldLoginPage(page);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.getByRole("button", { name: "Accedi" }).evaluate((button: HTMLButtonElement) => {
    button.disabled = true;
  });
  const logins = countLogins(page);
  release();
  await formReady(page);
  expect(logins).toHaveLength(0);
});

test("a held sign-in whose form left the page is dropped without an error", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  const release = await heldLoginPage(page);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.evaluate(() => document.querySelector("form[data-early-submit]")!.remove());
  const logins = countLogins(page);
  release();
  // React draws the form again from scratch: the held submission belonged to the old one.
  await formReady(page);
  expect(logins).toHaveLength(0);
  // Removing the form makes React's hydration fail, as it should: nothing else may throw (a
  // requestSubmit on the detached form would).
  expect(errors.filter((error) => !/Hydration failed/.test(error.message))).toEqual([]);
});
