import { expect, it } from "vitest";
import { proxyAddress, rateKey } from "./rate-limit";
it("15: uses the trusted rightmost hop or Vercel real IP", () => {
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8", "x-real-ip": "9.10.11.12" });
  expect(proxyAddress(headers, false)).toBe("5.6.7.8");
  expect(proxyAddress(headers, true)).toBe("9.10.11.12");
  expect(proxyAddress(new Headers({ "x-forwarded-for": "spoof" }), false)).toBeNull();
});
it("15: hashes are secret-dependent and never contain the address", () => {
  expect(rateKey("one", "login", "1.2.3.4")).not.toBe(rateKey("two", "login", "1.2.3.4"));
  expect(rateKey("one", "login", "1.2.3.4")).not.toContain("1.2.3.4");
});
