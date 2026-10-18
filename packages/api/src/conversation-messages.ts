import { and, desc, eq, gt, inArray, notInArray } from "drizzle-orm";
import { messages, type Database } from "@avanti/db";
import type { ConversationTurn } from "@avanti/contracts";
import { askNext, openQuestions } from "./conversation-state";
import type { CaseRow } from "./dossier";

/** Caller holds the case lock: ties in the wall clock must not reorder the dialogue. */
export async function appendConversationTurns(
  db: Database,
  caseId: string,
  now: Date,
  turns: Pick<ConversationTurn, "role" | "text" | "kind" | "questionId">[],
) {
  if (!turns.length) return [];
  const [last] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.caseId, caseId))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const started = Math.max(now.getTime(), last ? Date.parse(last.createdAt) + 1 : 0);
  const rows = turns.map((turn, index) => ({
    id: crypto.randomUUID(),
    caseId,
    ...turn,
    createdAt: new Date(started + index).toISOString(),
  }));
  await db.insert(messages).values(rows);
  return rows.map((row) => row.id);
}

/**
 * Whether the turn an earlier attempt stored is still the citizen's latest word in the guided
 * conversation. A key remembered without a turn (older rows, actions that write none) holds.
 * Operator messages and the separate assistant thread do not count: they are not the citizen
 * answering again, and treating them as such would store a lost message twice.
 */
export async function turnStillLatest(
  db: Database,
  caseId: string,
  turnId: string | null | undefined,
) {
  if (!turnId) return true;
  const [turn] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.caseId, caseId), eq(messages.id, turnId)));
  if (!turn) return false;
  const [later] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.caseId, caseId),
        eq(messages.role, "citizen"),
        inArray(messages.kind, ["message", "confirmation"]),
        gt(messages.createdAt, turn.createdAt),
      ),
    )
    .limit(1);
  return !later;
}

/**
 * When the assistant's last bubble asks a question, that bubble is the question on screen. After a
 * language switch it is in the language the citizen just left: ask again in the new one.
 */
export async function reaskInLanguage(
  db: Database,
  before: Pick<CaseRow, "language">,
  after: Pick<CaseRow, "id" | "practiceId" | "answers" | "editingQuestion" | "language">,
  now: Date,
) {
  if (before.language === after.language || !after.practiceId) return;
  const [last] = await db
    .select({ role: messages.role, questionId: messages.questionId })
    .from(messages)
    .where(
      and(
        eq(messages.caseId, after.id),
        inArray(messages.role, ["citizen", "assistant"]),
        notInArray(messages.kind, ["citizen_assistant", "citizen_question"]),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (last?.role !== "assistant" || !last.questionId) return;
  const [question] = askNext(openQuestions(after));
  if (!question) return;
  await appendConversationTurns(db, after.id, now, [
    { role: "assistant", text: question.prompt, kind: "question", questionId: question.id },
  ]);
}
