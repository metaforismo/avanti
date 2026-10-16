import { expect, it, vi } from "vitest";

it("shows Italian time even when the operator's computer uses another time zone", async () => {
  vi.stubEnv("TZ", "America/New_York");
  vi.resetModules();
  const { formatDateTime, timeAgo } = await import("./labels");
  expect(formatDateTime("2027-01-01T23:30:00Z")).toMatch(/^2 gen 2027.*00:30$/);
  expect(timeAgo("2026-12-31T23:30:00Z", Date.parse("2027-01-20T10:00:00Z"))).toBe("1 gen");
  vi.unstubAllEnvs();
});
