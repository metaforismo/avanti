import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("keeps a whole code point instead of half a surrogate pair", () => {
    expect(initialsOf("𝒜nna Rossi")).toBe("𝒜R");
    expect(initialsOf("😀 Bianchi")).toBe("😀B");
  });

  it("ignores extra spaces and stops at two", () => {
    expect(initialsOf("  maria  de luca ")).toBe("MD");
    expect(initialsOf("")).toBe("");
  });
});
