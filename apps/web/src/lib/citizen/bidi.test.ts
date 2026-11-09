import { describe, expect, it } from "vitest";
import { latinRuns } from "./bidi";
import { format } from "./messages";

describe("latinRuns", () => {
  it("leaves text without right-to-left letters whole", () => {
    expect(latinRuns("Giacenza media 2025 (Prova)")).toEqual([
      { text: "Giacenza media 2025 (Prova)", latin: false },
    ]);
  });

  it("keeps an Italian term together with its brackets inside Arabic", () => {
    const parts = latinRuns("متوسط الرصيد السنوي 2025 (giacenza media) · Prova");
    expect(parts.filter((p) => p.latin).map((p) => p.text)).toEqual(["(giacenza media)", "Prova"]);
    expect(parts.map((p) => p.text).join("")).toBe(
      "متوسط الرصيد السنوي 2025 (giacenza media) · Prova",
    );
  });

  it("takes a run of Latin words with the digits between them, not the spaces after", () => {
    const parts = latinRuns("الرصيد في 31/12/2025 (saldo) وبيانات الحساب · Conto BancoPosta 2");
    expect(parts.filter((p) => p.latin).map((p) => p.text)).toEqual([
      "(saldo)",
      "Conto BancoPosta 2",
    ]);
  });
});

describe("format", () => {
  it("isolates values only in right-to-left sentences", () => {
    expect(format("Li vede {org}.", { org: "CAF Demo" })).toBe("Li vede CAF Demo.");
    expect(format("يراها {org}.", { org: "CAF Demo" })).toBe("يراها ⁨CAF Demo⁩.");
  });
});
