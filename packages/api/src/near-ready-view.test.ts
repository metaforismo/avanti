import { expect, it } from "vitest";
import type { Database } from "@avanti/db";
import { CATALOG_VERSION, NEAR_READY_RULES_VERSION, NEAR_READY_SCHEMA_VERSION } from "@avanti/core";
import { nearReadyView, type NearReadyViewData } from "./near-ready-view";

const version = "2027-01-15T10:00:00.000Z";
const data = (state: NearReadyViewData["evaluation"]["state"]): NearReadyViewData => ({
  evaluation: {
    id: "evaluation",
    caseId: "case",
    caseVersion: version,
    currentVersion: version,
    checkedAt: version,
    eligible: true,
    mode: "visible",
    state,
    language: "it",
    reading: "ai",
    snapshot: {
      rulesVersion: NEAR_READY_RULES_VERSION,
      catalogVersion: CATALOG_VERSION,
      schemaVersion: NEAR_READY_SCHEMA_VERSION,
      configurationKey: "profile",
      validUntil: "2027-12-31T23:00:00.000Z",
      conditions: {},
      criticalThreshold: 0.98,
      otherThreshold: 0.95,
      fields: [],
      exclusions: [],
      tasks: [],
      durationMs: 0,
    },
    dismissalNote: null,
  },
  policy: { nearReadyMode: "visible" } as NearReadyViewData["policy"],
  blind: null,
});
const view = (state: NearReadyViewData["evaluation"]["state"]) =>
  nearReadyView(
    undefined as unknown as Database,
    { id: "case", organizationId: "org", updatedAt: version },
    "op",
    undefined,
    undefined,
    data(state),
  );

it("never shows a suggestion withdrawn at the same version as eligible", async () => {
  // AI attention can change without a new case version (forced consistency run).
  expect(await view("withdrawn")).toMatchObject({
    state: "withdrawn",
    result: "not_eligible",
    exclusions: [expect.objectContaining({ code: "stale_version" })],
  });
  expect(await view("suggested")).toMatchObject({ state: "suggested", result: "eligible" });
});
