import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@avanti/contracts";
import { referenceYearFor } from "./catalog";
import { documentTypeLabel, requirements, type RequirementId } from "./requirements";

const ids = Object.keys(requirements) as RequirementId[];

describe("documentTypeLabel", () => {
  it.each(ids)("gives %s a readable label in every language", (id) => {
    for (const language of LANGUAGES) {
      const label = documentTypeLabel(
        { detectedRequirementId: id, detectedLabel: null },
        language,
        2025,
      );
      expect(label, `${id} / ${language}`).toBeTruthy();
      expect(label).not.toBe(id);
      expect(label).not.toMatch(/[{}]|\b[a-z]+_[a-z_]+\b/);
    }
  });

  it("replaces an id stored as label by older heuristic analyses", () => {
    const year = referenceYearFor("isee_ordinario", {});
    expect(
      documentTypeLabel(
        { detectedRequirementId: "identity", detectedLabel: "identity" },
        "it",
        year,
      ),
    ).toBe("Documento d’identità");
    expect(
      documentTypeLabel({ detectedRequirementId: null, detectedLabel: "tax_code" }, "it", year),
    ).toBe("Codice fiscale / tessera sanitaria");
    expect(
      documentTypeLabel(
        { detectedRequirementId: "account_balance", detectedLabel: "account_balance" },
        "ro",
        2025,
      ),
    ).toBe("Sold la 31/12/2025 (saldo) și datele contului");
  });

  it("keeps the AI reading for the Italian operator, not for a citizen in another language", () => {
    const analysis = { detectedRequirementId: "identity", detectedLabel: "Carta d'identità" };
    expect(documentTypeLabel(analysis, "it", null)).toBe("Carta d'identità");
    expect(documentTypeLabel(analysis, "uk", null)).toBe("Документ, що посвідчує особу");
  });

  it("returns null for unknown types, so the file name is shown instead of an id", () => {
    expect(
      documentTypeLabel(
        { detectedRequirementId: "drivers_license", detectedLabel: "drivers_license" },
        "it",
        null,
      ),
    ).toBeNull();
    expect(
      documentTypeLabel(
        { detectedRequirementId: null, detectedLabel: "residence_permit" },
        "it",
        null,
      ),
    ).toBeNull();
    expect(
      documentTypeLabel({ detectedRequirementId: null, detectedLabel: "Bolletta" }, "en", null),
    ).toBeNull();
    expect(
      documentTypeLabel({ detectedRequirementId: null, detectedLabel: "  " }, "it", null),
    ).toBeNull();
    expect(
      documentTypeLabel({ detectedRequirementId: "licence", detectedLabel: "licence" }, "it", null),
    ).toBeNull();
    expect(documentTypeLabel(null, "it", null)).toBeNull();
  });
});
