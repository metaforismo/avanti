import { expect, test } from "@playwright/test";
import type { ConversationState } from "@avanti/contracts";
import { loseReply, startCase } from "./helpers";

test("a message sent again after a lost reply appears once", async ({ page }) => {
  const token = await startCase(page, "Devo fare l'ISEE");
  await page.goto(`/pratica/${token}`);
  const text = "Vivo da solo in una casa in affitto a Milano";
  let attempts = 0;
  // The server stores the message, but the Wi-Fi drops before the reply arrives.
  await page.route(/\/conversation$/, async (route) => {
    if (route.request().method() !== "POST" || ++attempts > 1) return route.fallback();
    await loseReply(route);
  });
  await page.getByLabel("Scrivi qui, con parole tue").fill(text);
  await page.getByRole("button", { name: "Invia", exact: true }).click();
  await expect(page.getByText("Connessione assente. Controlla la rete e riprova.")).toBeVisible();
  await expect(page.getByLabel("Scrivi qui, con parole tue")).toHaveValue(text);
  await page.getByRole("button", { name: "Invia", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  expect(attempts).toBe(2);

  const state = (await (
    await page.request.get(`/api/c/${token}/conversation`)
  ).json()) as ConversationState;
  expect(state.turns.filter((turn) => turn.role === "citizen" && turn.text === text)).toHaveLength(
    1,
  );
  // The stored conversation has one copy too.
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
});
