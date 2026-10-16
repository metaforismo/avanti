import { and, eq, desc } from "drizzle-orm";
import { cases, documents, messages, rateLimits, settings } from "@avanti/db";
import {
  AskDesk,
  AssistantAsk,
  AssistantReply,
  TranscribeFields,
  Transcription,
} from "@avanti/contracts";
import {
  assistantContext,
  assistantSafetyIntent,
  heuristicAssistant,
  citizenAssistantCopy,
} from "@avanti/core";
import { outputViolations, safeAssistantOutput } from "@avanti/ai";
import type { z } from "zod";
import { body, mutableCitizen, type App, type Services, type ApiContext } from "./context";
import { assistantTurns, citizenView, audit, iso } from "./dossier";
import { currentCitizenLink } from "./citizen-link";
import { nextCaseUpdate } from "./case-version";
import { ApiFailure, notFound } from "./security";
import { observeAi } from "./operational-telemetry";
import { rateKey, rateLimitSecret } from "./rate-limit-key";
import { audioMetadata } from "./speech-audio";

async function assistantBody<T>(c: ApiContext, schema: z.ZodType<T>) {
  try {
    return await body(c, schema);
  } catch {
    throw new ApiFailure(
      "bad_request",
      400,
      citizenAssistantCopy("invalid", c.get("citizen").language),
    );
  }
}
/** A CAF can switch off AI for citizens: then nothing they write or say reaches a provider. */
async function citizenAiAllowed(s: Services, organizationId: string) {
  const [policy] = await s.db
    .select({ enabled: settings.aiCitizenAssistant })
    .from(settings)
    .where(eq(settings.organizationId, organizationId));
  return policy?.enabled !== false;
}
export function mountCitizenAssistant(app: App, s: Services) {
  app.get("/c/:token/assistant", async (c) => {
    const row = c.get("citizen");
    const [bucket] = await s.db
      .select()
      .from(rateLimits)
      .where(
        eq(
          rateLimits.key,
          rateKey(rateLimitSecret(s.rateLimitSecret), "assistant:86400", `case:${row.id}`),
        ),
      );
    const remainingToday =
      bucket && Date.parse(bucket.resetAt) > s.clock().getTime()
        ? Math.max(0, 80 - bucket.count)
        : 80;
    return c.json({ messages: await assistantTurns(s.db, row.id), remainingToday });
  });
  app.post("/c/:token/assistant", async (c) => {
    const row = c.get("citizen"),
      input = await assistantBody(c, AssistantAsk);
    const view = await citizenView(s.db, row, s.clock());
    const history = await s.db
      .select()
      .from(messages)
      .where(and(eq(messages.caseId, row.id), eq(messages.kind, "citizen_assistant")))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(12);
    const taskInput = {
      ...input,
      language: row.language,
      organizationName: view.organization.name,
      step: view.step,
      context: assistantContext(view, input.focus),
      history: history.reverse().map((m) => ({
        id: m.id,
        role: m.role as "citizen" | "assistant",
        text: m.text,
        ...m.assistantMetadata,
        createdAt: iso(m.createdAt),
      })),
    };
    const result =
      s.ai.assistant &&
      !assistantSafetyIntent(input.message) &&
      (await citizenAiAllowed(s, row.organizationId))
        ? await observeAi(s, row, () => s.ai.assistant!(taskInput))
        : { ...heuristicAssistant(taskInput), engine: "heuristic" as const };
    const safe = safeAssistantOutput(result, taskInput);
    const reply = AssistantReply.parse({
      ...safe,
      id: crypto.randomUUID(),
      createdAt: s.clock().toISOString(),
      engine: safe === result ? result.engine : "heuristic",
      sources: safe.sources.map((id) => ({
        id,
        title: taskInput.context.find((i) => i.id === id)!.title,
      })),
    });
    await s.db.transaction(async (tx) => {
      const current = await currentCitizenLink(tx, row, s.clock(), true);
      const [latest] = await tx
        .select({ at: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.caseId, row.id), eq(messages.kind, "citizen_assistant")))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const at = Math.max(s.clock().getTime(), latest ? Date.parse(latest.at) + 1 : 0);
      reply.createdAt = new Date(at + 1).toISOString();
      await tx.insert(messages).values([
        {
          id: crypto.randomUUID(),
          caseId: row.id,
          kind: "citizen_assistant",
          role: "citizen",
          text: outputViolations(input.message, input.message).includes("credentials")
            ? citizenAssistantCopy("secrets", row.language)
            : input.message,
          createdAt: new Date(at).toISOString(),
        },
        {
          id: reply.id,
          caseId: row.id,
          kind: "citizen_assistant",
          role: "assistant",
          text: reply.reply,
          assistantMetadata: { intent: reply.intent, action: reply.action, sources: reply.sources },
          createdAt: reply.createdAt,
        },
      ]);
      await tx
        .update(cases)
        .set({ updatedAt: nextCaseUpdate(current, s.clock()) })
        .where(eq(cases.id, row.id));
    });
    return c.json(reply);
  });
  app.post("/c/:token/assistant/ask-desk", async (c) => {
    const row = c.get("citizen"),
      input = await assistantBody(c, AskDesk),
      now = s.clock();
    await s.db.transaction(async (tx) => {
      const current = await currentCitizenLink(tx, row, s.clock(), true);
      await tx.insert(messages).values({
        id: crypto.randomUUID(),
        caseId: row.id,
        kind: "citizen_question",
        role: "citizen",
        text: outputViolations(input.message, input.message).includes("credentials")
          ? citizenAssistantCopy("secrets", row.language)
          : input.message,
        createdAt: now.toISOString(),
      });
      await audit(tx, current, "citizen", "citizen.question", now);
      await tx
        .update(cases)
        .set({ updatedAt: nextCaseUpdate(current, now) })
        .where(eq(cases.id, row.id));
    });
    return c.json({ ok: true }, 201);
  });
  app.post("/c/:token/documents/:id/keep", async (c) => {
    const row = c.get("citizen");
    await s.db.transaction(async (tx) => {
      const current = await currentCitizenLink(tx, row, s.clock(), true);
      mutableCitizen(current);
      const [document] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.caseId, row.id), eq(documents.id, c.req.param("id"))));
      if (!document) throw notFound();
      if (document.status === "processing")
        throw new ApiFailure("conflict", 409, citizenAssistantCopy("desk", row.language));
      if (document.citizenKeptAt) return;
      await tx
        .update(documents)
        .set({ citizenKeptAt: s.clock().toISOString() })
        .where(eq(documents.id, document.id));
      await audit(tx, current, "citizen", "document.kept", s.clock());
      await tx
        .update(cases)
        .set({ updatedAt: nextCaseUpdate(current, s.clock()) })
        .where(eq(cases.id, row.id));
    });
    return c.json(
      await citizenView(s.db, await currentCitizenLink(s.db, row, s.clock()), s.clock()),
    );
  });
  app.post("/c/:token/transcribe", async (c) => {
    const row = c.get("citizen");
    if (
      !s.ai.transcribe ||
      s.ai.configured === false ||
      !(await citizenAiAllowed(s, row.organizationId))
    )
      throw new ApiFailure(
        "transcription_unavailable",
        503,
        citizenAssistantCopy("audioUnavailable", row.language),
      );
    let bytes: Uint8Array, mime: string, language: typeof row.language;
    try {
      const form = await c.req.formData();
      const parsed = TranscribeFields.parse({ language: form.get("language") });
      language = parsed.language;
      const files = form.getAll("file");
      const file = files[0];
      if (
        files.length !== 1 ||
        !(file instanceof File) ||
        file.size > 2 * 1024 * 1024 ||
        file.size === 0 ||
        [...form.keys()].some((k) => !["file", "language"].includes(k))
      )
        throw new Error("InvalidAudio");
      bytes = new Uint8Array(await file.arrayBuffer());
      mime = await audioMetadata(bytes);
    } catch {
      throw new ApiFailure("bad_request", 400, citizenAssistantCopy("audioInvalid", row.language));
    }
    const result = await observeAi(s, row, () =>
      s.ai.transcribe!({ bytes, mime, language }),
    );
    await currentCitizenLink(s.db, row, s.clock());
    if (result.engine !== "ai" || !result.text.trim())
      throw new ApiFailure(
        "transcription_unavailable",
        503,
        citizenAssistantCopy("audioUnavailable", language),
      );
    return c.json(Transcription.parse(result));
  });
}
