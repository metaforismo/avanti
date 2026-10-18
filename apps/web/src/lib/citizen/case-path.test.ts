import { describe, expect, it } from "vitest";
import { reusesFetchPreload } from "./case-path";

describe("reusesFetchPreload", () => {
  it("accepts Chromium browsers on Android and desktop", () => {
    for (const ua of [
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 13; SM-A145R) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
    ])
      expect(reusesFetchPreload(ua)).toBe(true);
  });

  it("refuses WebKit, including Chrome and Edge on iOS, and Firefox", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
      // iPadOS asks for desktop sites with a Mac Safari user agent.
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
      "Mozilla/5.0 (Android 14; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0",
    ])
      expect(reusesFetchPreload(ua)).toBe(false);
  });

  it("refuses a missing user agent", () => {
    expect(reusesFetchPreload(null)).toBe(false);
    expect(reusesFetchPreload("")).toBe(false);
  });
});
