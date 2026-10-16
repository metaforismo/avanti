import { appendConversationTurns } from "./conversation-messages";
import { eq } from "drizzle-orm";
import { cases, settings } from "@avanti/db";
import {
  ConversationRequest,
  ConversationConfirmRequest,
  MemberInput,
  type ConversationState,
  type Language,
} from "@avanti/contracts";
import { deterministicReply, converseTask, outputViolations, type ConverseInput } from "@avanti/ai";
import { applyValidatedAnswer, assertProposalCurrent } from "./citizen-turn";
import { citizenView, audit, type CaseRow } from "./dossier";
import {
  openQuestions,
  askNext,
  validateProposals,
  mergeProposals,
  pendingProposals,
  confirmedContext,
} from "./conversation-state";
import { lockCase } from "./citizen-link";
import { nextCaseUpdate } from "./case-version";
import { detachRemovedMembers } from "./household-cleanup";
import { observeAi } from "./operational-telemetry";
import { ApiFailure, notFound } from "./security";
import { body, mutableCitizen, type App, type Services } from "./context";
import { intakeEmergency, intakeViolence, t } from "@avanti/core";

const invalidText: Record<Language, string> = {
  it: "Scrivi un messaggio da 1 a 1000 caratteri.",
  en: "Write a message of 1 to 1000 characters.",
  fr: "Écrivez un message de 1 à 1000 caractères.",
  es: "Escribe un mensaje de 1 a 1000 caracteres.",
  ro: "Scrie un mesaj de la 1 la 1000 de caractere.",
  uk: "Напишіть повідомлення від 1 до 1000 символів.",
  ar: "اكتب رسالة من 1 إلى 1000 حرف.",
  bn: "১ থেকে ১০০০ অক্ষরের একটি বার্তা লিখুন।",
};
export async function readConversationText(c: Parameters<typeof body>[0], row: CaseRow) {
  const raw: unknown = await c.req.json().catch(() => null);
  const parsed = ConversationRequest.safeParse(raw);
  if (!parsed.success) throw new ApiFailure("bad_request", 400, invalidText[row.language]);
  return parsed.data;
}
async function state(s: Services, row: CaseRow): Promise<ConversationState> {
  return (await citizenView(s.db, row, s.clock())).conversation!;
}
export function mountConversationRoutes(app: App, s: Services) {
  app.get("/c/:token/conversation", async (c) => c.json(await state(s, c.get("citizen"))));
  app.post("/c/:token/conversation", async (c) => {
    const initial = c.get("citizen");
    mutableCitizen(initial);
    const { text } = await readConversationText(c, initial);
    if (!initial.practiceId) throw new ApiFailure("bad_request", 400, "Scegli prima la pratica.");
    if (intakeEmergency(text)) {
      const updated = await s.db.transaction(async (tx) => {
        const current = await lockCase(tx, initial, s.clock());
        const now = s.clock();
        const [updated] = await tx
          .update(cases)
          .set({
            conversationProposals: [],
            conversationEngine: "heuristic",
            updatedAt: nextCaseUpdate(current, now),
          })
          .where(eq(cases.id, current.id))
          .returning();
        if (!updated) throw notFound();
        await appendConversationTurns(tx, current.id, now, [
          {
            role: "assistant",
            text: [
              t(current.language, "intakeEmergency"),
              intakeViolence(text) ? t(current.language, "intakeViolence") : "",
            ]
              .filter(Boolean)
              .join(" "),
            kind: "message",
            questionId: null,
          },
        ]);
        await audit(tx, updated, "citizen", "citizen.safety_notice", now);
        return updated;
      });
      return c.json(await state(s, updated));
    }
    const view = await citizenView(s.db, initial, s.clock());
    const input: ConverseInput = {
      text,
      language: initial.language,
      practiceId: initial.practiceId,
      organizationName: view.organization.name,
      practiceName: view.practice!.name,
      openQuestions: openQuestions(initial),
      askNext: askNext(openQuestions(initial)),
      answered: confirmedContext(initial),
      turns: view.conversation!.turns.slice(-8),
    };
    const [policy] = await s.db
      .select({ enabled: settings.aiCitizenAssistant })
      .from(settings)
      .where(eq(settings.organizationId, initial.organizationId));
    const result =
      s.ai.converse && policy?.enabled !== false
        ? await observeAi(s, initial.organizationId, () => s.ai.converse!(input))
        : { ...converseTask.heuristic(input), engine: "heuristic" as const };
    const row = await s.db.transaction(async (tx) => {
      const current = await lockCase(tx, initial, s.clock());
      assertProposalCurrent(initial, current);
      const citizenTexts = [
        ...input.turns.filter((t) => t.role === "citizen").map((t) => t.text),
        text,
      ];
      const proposals = validateProposals(current, result.proposals, citizenTexts, s.clock());
      const understood = proposals
        .filter((p) => !outputViolations(p.display, citizenTexts.join("\n")).length)
        .map((p) => p.display);
      const reply =
        result.reply &&
        !outputViolations(result.reply, citizenTexts.join("\n"), current.language).length
          ? result.reply
          : deterministicReply(input, understood);
      const [updated] = await tx
        .update(cases)
        .set({
          conversationProposals: mergeProposals(pendingProposals(current, s.clock()), proposals),
          conversationEngine: result.engine,
          citizenRequestId: null,
          updatedAt: nextCaseUpdate(current, s.clock()),
        })
        .where(eq(cases.id, current.id))
        .returning();
      if (!updated) throw notFound();
      const now = s.clock();
      await appendConversationTurns(tx, current.id, now, [
        { role: "citizen", text, kind: "message", questionId: null },
        {
          role: "assistant",
          text: reply,
          kind: input.askNext.length ? "question" : "summary",
          questionId: input.askNext[0]?.id ?? null,
        },
      ]);
      await audit(tx, updated, "citizen", "conversation.updated", now, null, {
        proposalsCount: proposals.length,
        heuristic: result.engine === "heuristic",
      });
      return updated;
    });
    return c.json(await state(s, row));
  });
  app.post("/c/:token/conversation/confirm", async (c) => {
    const input = await body(c, ConversationConfirmRequest);
    const row = await s.db.transaction(async (tx) => {
      const current = await lockCase(tx, c.get("citizen"), s.clock());
      const pending = pendingProposals(current, s.clock());
      const ids = [...input.accept.map((p) => p.proposalId), ...input.reject];
      if (ids.some((id) => !pending.some((p) => p.id === id)))
        throw new ApiFailure(
          "conflict",
          409,
          "Le proposte sono cambiate. Rileggi la conversazione.",
        );
      let answers = current.answers;
      const confirmed = new Set(current.confirmedAnswers);
      // Catalog order makes validation independent of the order of cards in the request.
      const accepted = pending.filter((p) => input.accept.some((a) => a.proposalId === p.id));
      const order = openQuestions(current).map((q) => q.id);
      accepted.sort((a, b) => order.indexOf(a.questionId) - order.indexOf(b.questionId));
      const confirmations: { questionId: string; text: string }[] = [];
      for (const proposal of accepted) {
        const value =
          input.accept.find((a) => a.proposalId === proposal.id)!.value ?? proposal.value;
        answers = applyValidatedAnswer(
          current.practiceId!,
          answers,
          proposal.questionId,
          value,
          current.language,
          s.clock(),
        );
        confirmed.add(proposal.questionId);
        const { readableAnswer, getQuestions } = await import("@avanti/core");
        const q = getQuestions(current.practiceId!, current.answers, current.language).find(
          (q) => q.id === proposal.questionId,
        )!;
        confirmations.push({
          questionId: q.id,
          text: readableAnswer(answers[q.id]!, q, current.language),
        });
      }
      const remaining = pending.filter((p) => !ids.includes(p.id));
      const members = MemberInput.array().safeParse(answers.members);
      const editingQuestion =
        members.success &&
        typeof answers.household_count === "number" &&
        members.data.length !== answers.household_count
          ? "members"
          : accepted.some((p) => p.questionId === current.editingQuestion)
            ? null
            : current.editingQuestion;
      const candidate = { ...current, answers, conversationProposals: remaining, editingQuestion };
      const [updated] = await tx
        .update(cases)
        .set({
          answers,
          confirmedAnswers: [...confirmed].filter((id) => Object.hasOwn(answers, id)),
          conversationProposals: pendingProposals(candidate, s.clock()),
          editingQuestion: candidate.editingQuestion,
          citizenRequestId: null,
          updatedAt: nextCaseUpdate(current, s.clock()),
        })
        .where(eq(cases.id, current.id))
        .returning();
      if (!updated) throw notFound();
      await detachRemovedMembers(tx, current, updated);
      for (const confirmation of confirmations) {
        await appendConversationTurns(tx, current.id, s.clock(), [
          { role: "citizen", ...confirmation, kind: "confirmation" },
        ]);
        await audit(tx, updated, "citizen", "answer.updated", s.clock(), null, {
          answersCount: Object.keys(answers).length,
        });
      }
      const ask = askNext(openQuestions(updated));
      await appendConversationTurns(tx, current.id, s.clock(), [
        {
          role: "assistant",
          text: deterministicReply({ askNext: ask, language: current.language }),
          kind: ask.length ? "question" : "summary",
          questionId: ask[0]?.id ?? null,
        },
      ]);
      return updated;
    });
    return c.json(await state(s, row));
  });
}
