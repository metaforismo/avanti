import { CATALOG_VERSION, NEAR_READY_RULES_VERSION, NEAR_READY_SCHEMA_VERSION } from "@avanti/core";
import { sql } from "drizzle-orm";
import {
  cases,
  documents,
  messages,
  copilotCache,
  nearReadyEvaluations,
  settings,
} from "@avanti/db";

// Drizzle unqualifies selected Column objects; preserve the outer scope inside subqueries.
const caseId = sql.raw('"cases"."id"');
const caseVersion = sql.raw('"cases"."updated_at"');

const unreadCitizenQuestion = sql`exists (select 1 from ${messages} where ${messages.caseId} = ${caseId}
      and ${messages.role} = 'citizen' and ${messages.operatorReadAt} is null
      and ${messages.text} ~* '([?？؟]|(^|[[:space:]])(come|quale|quali|quando|perché|posso|dove)([[:space:]]|$))')`;

function visibleNearReady(profile?: string, now?: Date) {
  return sql`${cases.status} in ('submitted','in_review') and exists (
      select 1 from ${nearReadyEvaluations} nr join ${settings} ns on ns.organization_id = "cases"."organization_id"
      where nr.case_id = ${caseId} and nr.case_version = ${caseVersion}
      and nr.snapshot->>'rulesVersion' = ${NEAR_READY_RULES_VERSION}
      and nr.snapshot->>'catalogVersion' = ${CATALOG_VERSION}
      and nr.snapshot->>'schemaVersion' = ${NEAR_READY_SCHEMA_VERSION}
      and ${profile ? sql`nr.snapshot->>'configurationKey' = ${profile}` : sql`true`}
      and (nr.snapshot->>'validUntil')::timestamptz > ${now ? sql`${now.toISOString()}::timestamptz` : sql`current_timestamp`}
      and nr.eligible and nr.state in ('suggested','accepted')
      and ns.near_ready_mode = 'visible' and ns.near_ready_suspended_at is null
    )`;
}

// Correlated predicates run before pagination, so counts and filters describe the whole queue.
export function queuePrioritySql(profile?: string, now?: Date) {
  return sql<"near_ready" | "quick_review" | "attention" | "citizen_question" | null>`case
    when ${unreadCitizenQuestion} then 'citizen_question'
    when ${cases.aiAttention} > 0 then 'attention'
    when ${visibleNearReady(profile, now)} then 'near_ready'
    when ${cases.aiAttention} = 0 and ${cases.practiceId} is not null
      and exists (select 1 from ${copilotCache} where ${copilotCache.caseId} = ${caseId}
        and ${copilotCache.caseVersion} = ${caseVersion} and ${copilotCache.task} in ('consistency','consistency:heuristic') and ${copilotCache.payload} is not null)
      and exists (select 1 from ${documents} where ${documents.caseId} = ${caseId})
      and not exists (select 1 from ${documents} where ${documents.caseId} = ${caseId}
        and (${documents.status} <> 'analyzed' or ${documents.analysis} is null or coalesce(${documents.analysis}->>'engine','') <> 'ai' or coalesce(${documents.analysis}->>'legible','false') <> 'true'))
      then 'quick_review'
    else null end`;
}

/**
 * Same result as `queuePrioritySql(…) = 'near_ready'`, written so the cheap conditions come
 * first: counting the whole queue no longer runs the message regex on every case.
 */
export function nearReadyPrioritySql(profile?: string, now?: Date) {
  return sql<boolean>`(${visibleNearReady(profile, now)}
    and (${cases.aiAttention} > 0) is not true
    and not ${unreadCitizenQuestion})`;
}
