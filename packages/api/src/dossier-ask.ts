import { and, desc, eq, lt, or } from "drizzle-orm";
import { dossierChatTurns, settings } from "@avanti/db";
import {
  DossierAskRequest,
  DossierAskResponse,
  DossierChatQuery,
  DossierChatResponse,
  Id,
} from "@avanti/contracts";
import { evidenceFor, normativeRetriever, citationFor, calendarDate } from "@avanti/core";
import { body, parse, type App, type Services } from "./context";
import { audit, caseById, dossierView, iso } from "./dossier";
import { copilotDossier, redactContact } from "./copilot-context";
import { aiBudget } from "./ai-usage";
import { observeAi } from "./operational-telemetry";
import { lockOperatorAccess } from "./operator-access";
import { ApiFailure, notFound } from "./security";

export function mountDossierAsk(app: App, s: Services) {
  app.get("/cases/:id/ai/ask", async (c) => {
    const actor = c.get("operator");
    const row = await caseById(s.db, parse(Id, c.req.param("id")), actor.organizationId);
    const { beforeId } = parse(DossierChatQuery, c.req.query());
    const scope = and(
      eq(dossierChatTurns.caseId, row.id),
      eq(dossierChatTurns.operatorId, actor.id),
    );
    const [cursor] = beforeId
      ? await s.db
          .select()
          .from(dossierChatTurns)
          .where(and(scope, eq(dossierChatTurns.id, beforeId)))
      : [];
    if (beforeId && !cursor) throw notFound();
    const page = await s.db
      .select()
      .from(dossierChatTurns)
      .where(
        and(
          scope,
          cursor
            ? or(
                lt(dossierChatTurns.createdAt, cursor.createdAt),
                and(
                  eq(dossierChatTurns.createdAt, cursor.createdAt),
                  lt(dossierChatTurns.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(dossierChatTurns.createdAt), desc(dossierChatTurns.id))
      .limit(51);
    const more = page.length > 50;
    const turns = page
      .slice(0, 50)
      .reverse()
      .map((turn) => ({
        ...turn,
        createdAt: iso(turn.createdAt),
        caseVersion: iso(turn.caseVersion),
      }));
    c.header("Cache-Control", "private, no-store");
    return c.json(DossierChatResponse.parse({ turns, nextBeforeId: more ? turns[0]!.id : null }));
  });
  app.post("/cases/:id/ai/ask", async (c) => {
    const input = await body(c, DossierAskRequest);
    const actor = c.get("operator");
    const row = await caseById(s.db, parse(Id, c.req.param("id")), actor.organizationId);
    const dossier = copilotDossier(await dossierView(s.db, row, s.clock()));
    const previous =
      input.history === undefined
        ? await s.db
            .select()
            .from(dossierChatTurns)
            .where(
              and(
                eq(dossierChatTurns.caseId, row.id),
                eq(dossierChatTurns.operatorId, actor.id),
                // Old answers must never become facts for a new dossier version.
                eq(dossierChatTurns.caseVersion, iso(row.updatedAt)),
              ),
            )
            .orderBy(desc(dossierChatTurns.createdAt), desc(dossierChatTurns.id))
            .limit(4)
        : [];
    const history = (
      input.history ??
      previous.reverse().flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.response.answer },
      ])
    ).map((turn) => ({ ...turn, content: redactContact(turn.content).slice(0, 5000) }));
    const question = redactContact(input.question).slice(0, 1000);
    const chunks = normativeRetriever
      .search(
        [question, ...history.filter((t) => t.role === "user").map((t) => t.content)].join(" "),
        row.practiceId ?? undefined,
      )
      .map(({ chunk }) => ({ ...citationFor(chunk), text: chunk.text.slice(0, 5000) }));
    const { dossierAskTask } = await import("@avanti/ai/dossier-ask-task");
    const [policy] = await s.db
      .select()
      .from(settings)
      .where(eq(settings.organizationId, row.organizationId));
    const allow = policy?.aiCopilot !== false && !(await aiBudget(s, row.organizationId)).exhausted;
    const taskInput = dossierAskTask.input.parse({
      question,
      history,
      dossier,
      chunks,
      today: calendarDate(s.clock()),
    });
    const result =
      allow && s.ai.runTask
        ? await observeAi(s, row.organizationId, () => s.ai.runTask!(dossierAskTask, taskInput))
        : { output: dossierAskTask.heuristic(taskInput), engine: "heuristic" as const };
    const output = dossierAskTask.output.parse(result.output);
    const allEvidence = evidenceFor(dossier);
    const evidenceIds = [...new Set(output.statements.flatMap((p) => p.evidence))];
    const citationIds = output.statements.flatMap((p) => p.citations);
    const evidence = evidenceIds.flatMap((id) => allEvidence.filter((e) => e.id === id));
    const citations = chunks
      .filter((chunk) => citationIds.includes(chunk.id))
      .map(({ text: _text, ...citation }) => citation);
    const response = DossierAskResponse.parse({
      answer: output.statements
        .map((p) => {
          const refs = [...new Set(p.evidence)].flatMap((id) => {
            const index = evidence.findIndex((e) => e.id === id);
            return index < 0 ? [] : [String(index + 1)];
          });
          const sources = citations.flatMap((source, index) =>
            p.citations.includes(source.id) ? [`fonte ${index + 1}`] : [],
          );
          refs.push(...sources);
          return `${p.text}${refs.length ? ` [${refs.join(", ")}]` : ""}`;
        })
        .join("\n\n"),
      evidence,
      citations,
      engine: result.engine,
      suggestions: output.suggestions,
    });
    await s.db.transaction(async (tx) => {
      await lockOperatorAccess(tx, c, s);
      const current = await caseById(tx, row.id, actor.organizationId, true);
      if (iso(current.updatedAt) !== iso(row.updatedAt))
        throw new ApiFailure(
          "conflict",
          409,
          "Il fascicolo è cambiato. Ripeti la domanda sui dati aggiornati.",
        );
      await tx.insert(dossierChatTurns).values({
        id: crypto.randomUUID(),
        caseId: row.id,
        operatorId: actor.id,
        question: input.question,
        response,
        createdAt: s.clock().toISOString(),
        caseVersion: iso(row.updatedAt),
      });
      await audit(tx, current, "operator", "copilot.asked", s.clock(), actor.id);
    });
    c.header("Cache-Control", "private, no-store");
    return c.json(response);
  });
}
