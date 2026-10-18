import { describe, expect, it } from "vitest";
import type { SystemStatus } from "@avanti/contracts";
import { onlyNotStarted } from "./system-status";

const ok = { status: "ok", code: "available" } as const;
const counter = { status: "ok", count: 0, code: "available" } as const;
const job = { ...ok, lastStartedAt: null, lastFinishedAt: null, outcome: null };

function status(overrides: Partial<SystemStatus["components"]> = {}, counterStatus = "ok") {
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-17T08:00:00.000Z",
    status: "attention",
    version: { commit: null, tag: null },
    components: {
      database: ok,
      storage: ok,
      ai: { ...ok, configured: true, mode: "ai", hourly: null },
      maintenance: job,
      retention: job,
      email: {
        ...ok,
        provider: "resend",
        queuedOver1Hour: 0,
        failed24Hours: 0,
        sent24Hours: 0,
      },
      ...overrides,
    },
    counters: {
      documentsProcessingOver10Minutes: counter,
      casesWaitingForCitizenOver7Days: counter,
      linksExpiringWithin7Days: counter,
      recentApiErrors24Hours: { ...counter, status: counterStatus },
      notificationsQueued: counter,
    },
  } as SystemStatus;
}

describe("onlyNotStarted", () => {
  it("recognises a first day: jobs not run yet and no AI activity", () => {
    expect(
      onlyNotStarted(
        status({
          maintenance: { ...job, status: "attention", code: "never_run" },
          ai: {
            ...ok,
            status: "attention",
            code: "no_observations",
            configured: true,
            mode: "unknown",
            hourly: null,
          },
        }),
      ),
    ).toBe(true);
  });

  it("never hides a real warning next to the first-day ones", () => {
    const maintenance = { ...job, status: "attention", code: "never_run" } as const;
    expect(
      onlyNotStarted(
        status({
          maintenance,
          email: { ...status().components.email, status: "attention", code: "email_backlog" },
        }),
      ),
    ).toBe(false);
    expect(onlyNotStarted(status({ maintenance }, "attention"))).toBe(false);
  });

  it("says nothing when everything is fine or something is broken", () => {
    expect(onlyNotStarted({ ...status(), status: "ok" })).toBe(false);
    expect(
      onlyNotStarted({
        ...status({ maintenance: { ...job, status: "problem", code: "never_run" } }),
        status: "problem",
      }),
    ).toBe(false);
  });
});
