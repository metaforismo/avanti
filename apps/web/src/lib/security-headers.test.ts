import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { pageSecurityHeaders } from "./security-headers";

/** Applies the rules the way Next does: every matching rule, the last value per key wins. */
function headersFor(path: string) {
  const result = new Map<string, string>();
  for (const rule of pageSecurityHeaders(true))
    if (getPathMatch(rule.source, { removeUnnamedParams: true, strict: true })(path))
      for (const { key, value } of rule.headers) result.set(key.toLowerCase(), value);
  return result;
}

describe("pageSecurityHeaders", () => {
  it("adds nothing in development, where pages are served over plain HTTP", () => {
    expect(pageSecurityHeaders(false)).toEqual([]);
  });

  it("allows the microphone only on the citizen's case page", () => {
    expect(headersFor("/pratica/abc").get("permissions-policy")).toBe(
      "camera=(), microphone=(self), geolocation=()",
    );
    for (const path of ["/", "/console", "/console/pratiche/x", "/s/sportello", "/pratica/a/b"])
      expect(headersFor(path).get("permissions-policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
  });

  it("keeps the capability page isolated and unreferenced", () => {
    const headers = headersFor("/pratica/abc");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(headers.get("strict-transport-security")).toBe("max-age=63072000");
  });

  it("leaves API headers to the API but still sends HSTS", () => {
    const headers = headersFor("/api/c/abc");
    expect([...headers.keys()]).toEqual(["strict-transport-security"]);
    expect(headersFor("/apiary").get("content-security-policy")).toBeDefined();
  });
});
