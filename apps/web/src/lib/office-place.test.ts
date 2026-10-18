import { describe, expect, it } from "vitest";
import { officePlace } from "./office-place";

describe("officePlace", () => {
  it("joins address and city", () => {
    expect(officePlace({ address: "Via Indipendenza 10", city: "Bologna" })).toBe(
      "Via Indipendenza 10, Bologna",
    );
  });

  it("shows only the city when the address was left empty", () => {
    expect(officePlace({ address: "", city: "Bologna" })).toBe("Bologna");
    expect(officePlace({ address: "  ", city: "Bologna" })).toBe("Bologna");
  });
});
