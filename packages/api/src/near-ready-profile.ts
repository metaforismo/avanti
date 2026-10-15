import { createHash } from "node:crypto";
import type { Intelligence } from "./ai";
import type { NearReadySnapshot } from "@avanti/db";
import { CATALOG_VERSION, NEAR_READY_RULES_VERSION, NEAR_READY_SCHEMA_VERSION } from "@avanti/core";
import { NEAR_READY_PROMPT_VERSION } from "@avanti/ai/operator-tasks";
export function nearReadyProfile(ai: Intelligence) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        configured: ai.configured ?? false,
        configuration: ai.configuration ?? null,
        prompt: NEAR_READY_PROMPT_VERSION,
      }),
    )
    .digest("hex");
}
export function currentNearReadyProfile(snapshot: NearReadySnapshot, profile?: string, now?: Date) {
  return (
    snapshot.rulesVersion === NEAR_READY_RULES_VERSION &&
    snapshot.catalogVersion === CATALOG_VERSION &&
    snapshot.schemaVersion === NEAR_READY_SCHEMA_VERSION &&
    (profile === undefined || snapshot.configurationKey === profile) &&
    (now === undefined ||
      (Number.isFinite(Date.parse(snapshot.validUntil)) &&
        Date.parse(snapshot.validUntil) > now.getTime()))
  );
}
