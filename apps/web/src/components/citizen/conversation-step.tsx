"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import type { MemberRole } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { errorMessage, format } from "@/lib/citizen/messages";
import { useConversation, type ConversationTurn } from "@/lib/citizen/conversation";
import { STEP_TITLE_ID } from "@/lib/citizen/view";
import { cn } from "@/lib/cn";
import type { StepProps } from "./citizen-app";
import { Composer } from "./composer";
import { AnsweredList, InterviewStep } from "./interview-step";
import { ProposalsCard } from "./proposals-card";
import { QuestionCard } from "./question-card";

/**
 * The interview as a conversation: the citizen writes or speaks in their own words, the assistant
 * says back what it understood (to confirm), and asks what the rules still need. The question on
 * screen keeps its buttons for anyone who prefers to tap. If the conversation service is not
 * there, the classic question-by-question interview takes over.
 */
export function ConversationStep(props: StepProps) {
  const { api, data, m, token, goTo } = props;
  const conversation = useConversation(token, null);
  const { load, state } = conversation;
  const { questionsAnswered, questionsTotal } = data.progress;
  const bottom = useRef<HTMLDivElement>(null);

  // Answers given with the buttons go through the classic turn: refresh the conversation after.
  useEffect(() => {
    void load();
  }, [load, questionsAnswered]);

  const turns = state?.turns ?? [];
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length, state?.proposals.length]);

  if (!state && conversation.error?.status === 404) return <InterviewStep {...props} />;

  const remaining = Math.max(0, questionsTotal - questionsAnswered);
  const percent = questionsTotal > 0 ? (questionsAnswered / questionsTotal) * 100 : 0;
  const question = state?.ask[0] ?? data.nextQuestion ?? null;
  const thinking = conversation.pending === "send";

  return (
    <div className="grid gap-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h1
            id={STEP_TITLE_ID}
            tabIndex={-1}
            className="font-display text-xl font-semibold tracking-[-0.01em] outline-none"
          >
            {data.practice?.name ?? m.steps.interview}
          </h1>
          {remaining > 0 && (
            <p aria-hidden className="text-sm text-ink-3">
              {remaining === 1
                ? m.interview.remainingOne
                : format(m.interview.remainingMany, { n: remaining })}
            </p>
          )}
        </div>
        {questionsTotal > 0 && (
          <ProgressBar
            value={percent}
            label={format(m.interview.progressLabel, {
              n: questionsAnswered,
              total: questionsTotal,
            })}
            className="mt-2"
          />
        )}
      </div>

      <ol aria-live="polite" aria-relevant="additions" className="grid gap-3">
        {turns.map((turn) => (
          <Turn key={turn.id} turn={turn} you={m.conversation.you} avanti={m.conversation.avanti} />
        ))}
        {thinking && (
          <li
            className="flex items-center gap-2 text-sm text-ink-3"
            aria-label={m.conversation.reading}
          >
            <TypingDots />
            {m.conversation.reading}
          </li>
        )}
      </ol>

      {conversation.error && conversation.error.status !== 404 && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {errorMessage(m, conversation.error.status === 0 ? "network" : conversation.error.code)}
        </p>
      )}

      {state && state.proposals.length > 0 && (
        <ProposalsCard
          key={state.proposals.map((p) => p.id).join(",")}
          proposals={state.proposals}
          m={m}
          busy={conversation.pending === "confirm"}
          onConfirm={(accept, reject) =>
            void conversation
              .confirm(
                accept.map((proposalId) => ({ proposalId })),
                reject,
              )
              .then((next) => next && void api.reload())
          }
        />
      )}

      {state?.complete ? (
        <section className="animate-rise rounded-lg bg-ok-wash p-5">
          <h2 className="font-semibold text-ok">{m.conversation.completeTitle}</h2>
          <p className="mt-1 text-ink-2">{m.conversation.completeBody}</p>
          <Button className="mt-4" onClick={() => goTo("documents")}>
            {m.conversation.toDocuments}
            <ArrowRight className="rtl-flip size-4" aria-hidden />
          </Button>
        </section>
      ) : (
        question &&
        (state?.proposals.length ?? 0) === 0 && (
          <div className="grid gap-2">
            <p className="text-sm text-ink-3">{m.conversation.quickAnswer}</p>
            <QuestionCard
              key={question.id}
              api={api}
              question={question}
              m={m}
              initial={data.answers[question.id]}
              autoFocus={false}
              expectedRoles={
                Array.isArray(data.answers.household_roles)
                  ? (data.answers.household_roles as MemberRole[])
                  : undefined
              }
              expectedMembers={
                typeof data.answers.household_count === "number"
                  ? data.answers.household_count
                  : undefined
              }
            />
          </div>
        )
      )}

      <div className="sticky bottom-0 z-20 -mx-4 bg-paper/95 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Composer
          token={token}
          language={data.language}
          m={m}
          label={m.conversation.placeholder}
          placeholder={m.conversation.placeholder}
          maxLength={1000}
          busy={thinking}
          onSend={async (text) => {
            const next = await conversation.send(text);
            if (next) void api.reload();
            return Boolean(next);
          }}
        />
      </div>

      <AnsweredList api={api} data={data} m={m} />
      <div ref={bottom} />
    </div>
  );
}

function Turn({ turn, you, avanti }: { turn: ConversationTurn; you: string; avanti: string }) {
  const mine = turn.role === "citizen";
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] animate-fade-in rounded-2xl px-4 py-2.5",
          mine
            ? "rounded-ee-md bg-stamp text-on-stamp"
            : "rounded-es-md bg-surface ring-1 ring-line",
        )}
      >
        <p
          className={cn(
            "mb-0.5 flex items-center gap-1 text-xs",
            mine ? "text-on-stamp/80" : "text-ink-3",
          )}
        >
          {!mine && <Sparkles className="size-3" aria-hidden />}
          {mine ? you : avanti}
        </p>
        <p dir="auto" className="break-words whitespace-pre-line">
          {turn.text}
        </p>
      </div>
    </li>
  );
}

function TypingDots() {
  return (
    <span aria-hidden className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-ink-3"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
