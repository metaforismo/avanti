"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import type { MemberRole } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { errorMessage } from "@/lib/citizen/messages";
import { useConversation, type ConversationTurn } from "@/lib/citizen/conversation";
import { STEP_TITLE_ID } from "@/lib/citizen/view";
import { ChatBubble, Thinking } from "./chat-bubble";
import type { StepProps } from "./citizen-app";
import { Composer } from "./composer";
import { AnsweredList, InterviewStep } from "./interview-step";
import { ProposalsCard } from "./proposals-card";
import { InterviewProgressBar, RemainingQuestions } from "./interview-progress";
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
  const { questionsAnswered } = data.progress;
  const bottom = useRef<HTMLDivElement>(null);

  // Answers given with the buttons go through the classic turn: refresh the conversation after.
  useEffect(() => {
    void load();
  }, [load, questionsAnswered]);

  const turns = state?.turns ?? [];
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Like chat apps: after a reply the citizen's last message goes to the top, so the answer
    // and the card below it are read from their start, not from the button at the bottom.
    const mine = list.current?.querySelectorAll<HTMLElement>('[data-from="citizen"]');
    const last = mine?.[mine.length - 1];
    if (last) last.scrollIntoView({ block: "start", behavior: "smooth" });
    else bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length]);
  useEffect(() => {
    // A confirmed card makes room for the next question, which comes after everything else.
    if (state?.proposals.length === 0)
      bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [state?.proposals.length]);

  if (!state && conversation.error?.status === 404) return <InterviewStep {...props} />;

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
          <RemainingQuestions progress={data.progress} m={m} />
        </div>
        <InterviewProgressBar progress={data.progress} m={m} />
      </div>

      <AnsweredList api={api} data={data} m={m} />

      <ol
        ref={list}
        aria-live="polite"
        aria-relevant="additions"
        className="grid grid-cols-[minmax(0,1fr)] gap-6"
      >
        {turns.map((turn) => (
          <Turn key={turn.id} turn={turn} you={m.conversation.you} avanti={m.conversation.avanti} />
        ))}
        {thinking && <Thinking label={m.conversation.avanti} text={m.conversation.reading} />}
      </ol>

      {conversation.error && conversation.error.status !== 404 && (
        <Notice tone="danger" size="md">
          {errorMessage(m, conversation.error.status === 0 ? "network" : conversation.error.code)}
        </Notice>
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

      <div className="sticky bottom-0 z-20 -mx-4 bg-linear-to-t from-paper from-70% to-paper/0 px-4 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Composer
          token={token}
          language={data.language}
          m={m}
          label={m.conversation.placeholder}
          placeholder={m.conversation.placeholder}
          maxLength={1000}
          busy={thinking}
          voiceEnabled={data.aiCitizenAssistant !== false}
          onSend={async (text) => {
            const next = await conversation.send(text);
            if (next) void api.reload();
            return Boolean(next);
          }}
        />
      </div>

      <div ref={bottom} />
    </div>
  );
}

function Turn({ turn, you, avanti }: { turn: ConversationTurn; you: string; avanti: string }) {
  const mine = turn.role === "citizen";
  return (
    <ChatBubble
      from={mine ? "citizen" : "assistant"}
      label={mine ? you : avanti}
      text={turn.text}
    />
  );
}
