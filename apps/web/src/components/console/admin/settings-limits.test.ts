import { describe, expect, it } from "vitest";
import { LIMITS, message, wholeNumber } from "./settings-limits";

describe("wholeNumber", () => {
  it("accepts whole numbers inside the range, ends included", () => {
    expect(wholeNumber("linkDays", "1")).toBe(1);
    expect(wholeNumber("linkDays", "365")).toBe(365);
    expect(wholeNumber("retentionDays", "30")).toBe(30);
    expect(wholeNumber("nearReadyCriticalThreshold", "100")).toBe(100);
  });

  it("refuses letters, signs, decimals, spaces and the empty string", () => {
    for (const raw of ["", " ", "5 modificato", "12a", "-3", "+3", "1.5", "1,5", "1e2", "٣٠"]) {
      expect(wholeNumber("linkDays", raw), raw).toBeNull();
    }
  });

  it("refuses values just outside the range", () => {
    expect(wholeNumber("linkDays", "0")).toBeNull();
    expect(wholeNumber("linkDays", "366")).toBeNull();
    expect(wholeNumber("retentionDays", "29")).toBeNull();
    expect(wholeNumber("nearReadyOtherThreshold", "79")).toBeNull();
    expect(wholeNumber("nearReadyOtherThreshold", "101")).toBeNull();
    expect(wholeNumber("baselineMinutesPerCase", "99999999999999999999")).toBeNull();
  });
});

describe("message", () => {
  it("states the range and the unit", () => {
    expect(message("linkDays")).toBe("Inserisci un numero intero tra 1 e 365 giorni.");
    expect(message("baselineMinutesPerCase")).toBe(
      "Inserisci un numero intero tra 1 e 600 minuti.",
    );
    expect(message("nearReadyCriticalThreshold")).toBe("Inserisci una percentuale tra 80 e 100.");
  });

  it("covers every limit", () => {
    for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[])
      expect(message(key).length).toBeGreaterThan(10);
  });
});
