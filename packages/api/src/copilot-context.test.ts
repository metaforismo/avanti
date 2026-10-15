import { expect, it } from "vitest";
import { stripInternalIds } from "./copilot-context";
it("removes ids the model quoted, keeps the prose", () => {
  expect(
    stripInternalIds(
      "Il conto e il veicolo sono intestati al richiedente (answer account_owner_0, answer vehicle_owner_0), quindi vanno a lui.",
    ),
  ).toBe("Il conto e il veicolo sono intestati al richiedente, quindi vanno a lui.");
  expect(
    stripInternalIds(
      "La madre è dichiarata con redditi nel 2025 (answer income_present_fb9caada-f56b-48f9-838a-515ee788aa0e): la CU è da acquisire.",
    ),
  ).toBe("La madre è dichiarata con redditi nel 2025: la CU è da acquisire.");
  expect(stripInternalIds("Manca la giacenza media 2025 del conto Fineco.")).toBe(
    "Manca la giacenza media 2025 del conto Fineco.",
  );
});
