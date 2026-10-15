import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetCase,
  forgetCaseToken,
  recallCase,
  rememberCase,
  REMEMBER_DAYS,
} from "./local-cases";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

const DAY = 86_400_000;

describe("local cases", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));

  it("resumes within the window and forgets after it", () => {
    rememberCase("milano", "tok-1", 0);
    expect(recallCase("milano", (REMEMBER_DAYS - 1) * DAY)).toBe("tok-1");
    expect(recallCase("milano", REMEMBER_DAYS * DAY)).toBeNull();
    // Expired entries are removed, not just hidden.
    expect(localStorage.length).toBe(0);
  });

  it("drops tokens saved without a date by older versions", () => {
    localStorage.setItem("avanti:case:milano", "tok-legacy");
    expect(recallCase("milano")).toBeNull();
    expect(localStorage.getItem("avanti:case:milano")).toBeNull();
  });

  it("forgets one office on 'start new', and a token wherever it is stored", () => {
    rememberCase("milano", "tok-1");
    rememberCase("loreto", "tok-2");
    forgetCase("milano");
    expect(recallCase("milano")).toBeNull();
    expect(recallCase("loreto")).toBe("tok-2");
    forgetCaseToken("tok-2");
    expect(recallCase("loreto")).toBeNull();
  });

  it("ignores corrupted values and unavailable storage", () => {
    localStorage.setItem("avanti:case:milano", "{not json");
    expect(recallCase("milano")).toBeNull();
    vi.stubGlobal("localStorage", undefined);
    expect(() => rememberCase("milano", "tok")).not.toThrow();
    expect(recallCase("milano")).toBeNull();
  });
});
