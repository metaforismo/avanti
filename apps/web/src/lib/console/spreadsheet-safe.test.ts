import { describe, expect, it } from "vitest";
import { spreadsheetCell, spreadsheetRows } from "./spreadsheet-safe";

describe("spreadsheet-safe copy", () => {
  it("keeps formulas typed by a citizen as plain text", () => {
    expect(spreadsheetCell('=HYPERLINK("https://example.test","clic")')).toBe(
      `'=HYPERLINK("https://example.test","clic")`,
    );
    for (const lead of ["+", "-", "@"]) expect(spreadsheetCell(`${lead}1`)).toBe(`'${lead}1`);
  });

  it("never lets a value add cells or rows", () => {
    expect(spreadsheetRows([["Istituto", "Banca\tFinta\nRiga"]])).toBe(
      "Istituto\tBanca Finta Riga",
    );
  });

  it("leaves ordinary values untouched", () => {
    expect(
      spreadsheetRows([
        ["Nome", "Giulia"],
        ["Saldo", "1.234,56"],
      ]),
    ).toBe("Nome\tGiulia\nSaldo\t1.234,56");
  });
});
