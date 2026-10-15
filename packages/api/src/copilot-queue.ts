import { sql } from "drizzle-orm";
import { cases, documents, messages, copilotCache } from "@avanti/db";

// Correlated predicates run before pagination, so counts and filters describe the whole queue.
export function queuePrioritySql() {
  // Drizzle unqualifies selected Column objects; preserve the outer scope inside subqueries.
  const caseId = sql.raw('"cases"."id"');
  const caseVersion = sql.raw('"cases"."updated_at"');
  return sql<"quick_review" | "attention" | "citizen_question" | null>`case
    when exists (select 1 from ${messages} where ${messages.caseId} = ${caseId}
      and ${messages.role} = 'citizen' and ${messages.operatorReadAt} is null
      and ${messages.text} ~* '([?？؟]|(^|[[:space:]])(come|quale|quali|quando|perché|posso|dove)([[:space:]]|$))') then 'citizen_question'
    when ${cases.aiAttention} > 0 then 'attention'
    when ${cases.aiAttention} = 0 and ${cases.practiceId} is not null
      and exists (select 1 from ${copilotCache} where ${copilotCache.caseId} = ${caseId}
        and ${copilotCache.caseVersion} = ${caseVersion} and ${copilotCache.task} in ('consistency','consistency:heuristic') and ${copilotCache.payload} is not null)
      and exists (select 1 from ${documents} where ${documents.caseId} = ${caseId})
      and not exists (select 1 from ${documents} where ${documents.caseId} = ${caseId}
        and (${documents.status} <> 'analyzed' or ${documents.analysis} is null or coalesce(${documents.analysis}->>'engine','') <> 'ai' or coalesce(${documents.analysis}->>'legible','false') <> 'true'))
      then 'quick_review'
    else null end`;
}
