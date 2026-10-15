import { desc, eq } from "drizzle-orm";
import { messages, type Database } from "@avanti/db";
import type { ConversationTurn } from "@avanti/contracts";

/** Caller holds the case lock: ties in the wall clock must not reorder the dialogue. */
export async function appendConversationTurns(
  db: Database,
  caseId: string,
  now: Date,
  turns: Pick<ConversationTurn, "role" | "text" | "kind" | "questionId">[],
) {
  if (!turns.length) return;
  const [last] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.caseId, caseId))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const started = Math.max(now.getTime(), last ? Date.parse(last.createdAt) + 1 : 0);
  await db.insert(messages).values(
    turns.map((turn, index) => ({
      id: crypto.randomUUID(),
      caseId,
      ...turn,
      createdAt: new Date(started + index).toISOString(),
    })),
  );
}
