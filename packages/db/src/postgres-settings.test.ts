import { expect, it } from "vitest";
import { postgresSettings } from "./client";

it("bounds connection budgets and refuses invalid settings instead of silently disabling timeouts", () => {
  const defaults = postgresSettings({}, {});
  expect(defaults.max).toBe(5);
  expect(defaults.connection.statement_timeout).toBe(15000);
  expect(defaults.connection.lock_timeout).toBe(3000);
  expect(postgresSettings({}, { DATABASE_POOL_MAX: "10" }).max).toBe(10);
  expect(postgresSettings({ poolMax: 8 }, { DATABASE_POOL_MAX: "10" }).max).toBe(8);
  for (const value of ["", "0", "-1", "1.5", "NaN", "51"])
    expect(() => postgresSettings({}, { DATABASE_POOL_MAX: value })).toThrow("DATABASE_POOL_MAX");
  expect(() => postgresSettings({}, { DATABASE_STATEMENT_TIMEOUT_MS: "0" })).toThrow();
  expect(() => postgresSettings({}, { DATABASE_LOCK_TIMEOUT_MS: "60001" })).toThrow();
  expect(postgresSettings({}, { DATABASE_TIMEOUT_MODE: "role" }).connection).toEqual({
    application_name: "avanti",
  });
  expect(() => postgresSettings({}, { DATABASE_TIMEOUT_MODE: "typo" })).toThrow();
});
