import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a text colour next to the custom body-sm size", () => {
    expect(cn("text-on-stamp", "text-body-sm")).toBe("text-on-stamp text-body-sm");
  });

  it("still lets a later size replace body-sm", () => {
    expect(cn("text-body-sm", "text-base")).toBe("text-base");
  });

  it("treats the custom shadows as shadows", () => {
    expect(cn("shadow-raised", "shadow-float")).toBe("shadow-float");
    expect(cn("shadow-raised", "text-ink")).toBe("shadow-raised text-ink");
  });
});
