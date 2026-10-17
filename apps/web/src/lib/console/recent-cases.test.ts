import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetRecentCases, rememberedQueueHref, rememberQueue } from "./recent-cases";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("the queue «← Pratiche» returns to", () => {
  beforeEach(() => vi.stubGlobal("sessionStorage", fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("is the default queue until one is remembered", () => {
    expect(rememberedQueueHref()).toBe("/console");
  });

  it("keeps tab, filters and search", () => {
    rememberQueue(new URLSearchParams("stato=in_review&pratica=isee_ordinario&q=Rossi"));
    expect(rememberedQueueHref()).toBe("/console?stato=in_review&pratica=isee_ordinario&q=Rossi");
  });

  it("drops the one-off notices shown after a deletion", () => {
    rememberQueue(new URLSearchParams("eliminata=AV-2026-000001&famiglia=3&stato=ready"));
    expect(rememberedQueueHref()).toBe("/console?stato=ready");
  });

  it("is the default queue again when the remembered one had no parameters", () => {
    rememberQueue(new URLSearchParams("stato=ready"));
    rememberQueue(new URLSearchParams("eliminata=AV-2026-000001"));
    expect(rememberedQueueHref()).toBe("/console");
  });

  it("is forgotten at logout, with the recent cases", () => {
    rememberQueue(new URLSearchParams("stato=ready"));
    forgetRecentCases();
    expect(rememberedQueueHref()).toBe("/console");
  });

  it("falls back to the default queue when storage throws", () => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    vi.stubGlobal("sessionStorage", { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => rememberQueue(new URLSearchParams("stato=ready"))).not.toThrow();
    expect(rememberedQueueHref()).toBe("/console");
  });
});
