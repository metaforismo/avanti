import { describe, expect, it } from "vitest";
import { resolveView } from "./view";

describe("resolveView", () => {
  it("follows the server step when the citizen has not navigated", () => {
    expect(resolveView(null, { step: "interview" })).toBe("interview");
    expect(resolveView(null, { step: "submitted" })).toBe("submitted");
  });

  it("lets the citizen go back to earlier steps", () => {
    expect(resolveView("interview", { step: "documents" })).toBe("interview");
  });

  it("never lets a stale local view skip ahead of the server", () => {
    expect(resolveView("documents", { step: "interview" })).toBe("interview");
    expect(resolveView("review", { step: "interview" })).toBe("interview");
  });

  it("opens the review only once documents are reachable", () => {
    expect(resolveView("review", { step: "documents" })).toBe("review");
  });
});
