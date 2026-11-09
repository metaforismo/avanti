"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MemberRole } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { errorMessage } from "@/lib/citizen/messages";
import { useConversation, type ConversationTurn } from "@/lib/citizen/conversation";
import { askedBefore, initialAnswer, justAsked, STEP_TITLE_ID } from "@/lib/citizen/view";
import { RenewalNotice } from "./renewal-notice";
import { Bidi } from "./bidi";
import { ChatBubble, Thinking } from "./chat-bubble";
import type { StepProps } from "./citizen-app";
import { ComposerDock } from "./composer-dock";
import { WaitingStatus } from "./waiting-status";
import { AnsweredList, InterviewStep } from "./interview-step";
import { ProposalsCard } from "./proposals-card";
import { RemainingQuestions } from "./interview-progress";
import { QuestionCard } from "./question-card";
import { rise } from "./motion";

/**
 * The interview as a conversation: the citizen writes or speaks in their own words, the assistant
 * says back what it understood (to confirm), and asks what the rules still need. One way to answer
 * at a time: while a card waits, the composer folds into a pill and the card's keys stay in view.
 * If the conversation service is not there, the classic question-by-question interview takes over.
 */
export function ConversationStep(props: StepProps) {
  const { api, data, m, token, goTo } = props;
  const conversation = useConversation(token, null, api.reload);
  const { load, state } = conversation;
  const { questionsAnswered } = data.progress;

  // Answers given with the buttons go through the classic turn: refresh the conversation after.
  // A language switch too: the server asks the question again in the new language.
  const { language } = data;
  useEffect(() => {
    void load();
  }, [load, questionsAnswered, language]);

  const turns = state?.turns ?? [];
  const proposals = state?.proposals ?? [];
  const question = state?.ask[0] ?? data.nextQuestion ?? null;
  const thinking = conversation.pending === "send";
  const cardActive = !state?.complete && (proposals.length > 0 || question !== null);

  // An acknowledgement followed by the «Ho capito così» card would say the same facts twice:
  // the bubble keeps one line, and keeps it after the card is confirmed.
  const [summarized, setSummarized] = useState<ReadonlySet<string>>(() => new Set());
  const lastTurn = turns.at(-1);
  if (proposals.length > 0 && lastTurn?.role === "assistant" && !summarized.has(lastTurn.id))
    setSummarized(new Set([...summarized, lastTurn.id]));

  const card = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const settle = `${turns.length}|${proposals.map((p) => p.id).join(",")}|${question?.id ?? ""}|${state?.complete ?? ""}`;
  const firstSettle = useRef(true);
  useLayoutEffect(() => {
    if (!state) return;
    // The page opens at its top: title, notices, the first exchange.
    if (firstSettle.current) {
      firstSettle.current = false;
      if (turns.length === 0) return;
    }
    const frame = requestAnimationFrame(() => bringIntoView(list.current, card.current));
    return () => cancelAnimationFrame(frame);
    // settle is the moment a turn lands; the rest is read from the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settle]);

  if (!state && conversation.error?.status === 404) return <InterviewStep {...props} />;

  // The last exchange stays in bubbles; earlier answers live in «Le tue risposte».
  const lastMine = turns.findLastIndex((turn) => turn.role === "citizen");
  const shown = lastMine > 0 ? turns.slice(lastMine) : turns;
  const offset = turns.length - shown.length;

  return (
    <div className="grid gap-5">
      <div {...rise(0)}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h1
            id={STEP_TITLE_ID}
            tabIndex={-1}
            className="font-display text-xl font-semibold tracking-[-0.01em] text-balance outline-none"
          >
            <Bidi text={data.practice?.name ?? m.steps.interview} />
          </h1>
          <RemainingQuestions
            progress={data.progress}
            language={data.language}
            m={m}
            section={question?.section}
          />
        </div>
      </div>

      <RenewalNotice data={data} />

      <div {...rise(1, "empty:hidden")}>
        <AnsweredList api={api} data={data} m={m} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <ol
          ref={list}
          aria-live="polite"
          aria-relevant="additions"
          className="grid grid-cols-[minmax(0,1fr)] gap-5 empty:hidden"
        >
          {shown.map((turn, index) => (
            <Turn
              key={turn.id}
              turn={turn}
              asked={askedBefore(turns, offset + index, data.answered)}
              you={m.conversation.you}
              avanti={m.conversation.avanti}
              summary={summarized.has(turn.id) ? m.conversation.checkBelow : null}
            />
          ))}
          {thinking && <Thinking label={m.conversation.avanti} text={m.conversation.reading} />}
        </ol>
        <WaitingStatus active={thinking} m={m} />

        {conversation.error && conversation.error.status !== 404 && (
          <Notice tone="danger" size="md">
            {errorMessage(m, conversation.error.status === 0 ? "network" : conversation.error.code)}
          </Notice>
        )}

        <div ref={card} className="grid empty:hidden">
          {proposals.length > 0 && (
            <ProposalsCard
              key={proposals.map((p) => p.id).join(",")}
              proposals={proposals}
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
            <section className="animate-rise rounded-xl bg-ok-wash p-5">
              <h2 className="font-semibold text-ok">{m.conversation.completeTitle}</h2>
              <p className="mt-1 text-ink-2">{m.conversation.completeBody}</p>
              <Button size="touch" className="mt-4" onClick={() => goTo("documents")}>
                {m.conversation.toDocuments}
                <ArrowRight className="rtl-flip size-4" aria-hidden />
              </Button>
            </section>
          ) : (
            question &&
            proposals.length === 0 && (
              <QuestionCard
                key={question.id}
                api={api}
                question={question}
                m={m}
                initial={initialAnswer(data, question.id)}
                autoFocus={false}
                askedAbove={justAsked(turns, question.id)}
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
            )
          )}
        </div>
      </div>

      <ComposerDock
        token={token}
        language={data.language}
        m={m}
        compact={cardActive}
        busy={thinking}
        voiceEnabled={data.aiCitizenAssistant !== false}
        onSend={async (text) => {
          const next = await conversation.send(text);
          if (next) void api.reload();
          return Boolean(next);
        }}
      />
    </div>
  );
}

/**
 * After a turn lands: the card's last key ends just above the composer, with the citizen's last
 * message still in view when there is room. A card taller than the screen shows from its top.
 */
function bringIntoView(list: HTMLElement | null, card: HTMLElement | null) {
  const target = card?.firstElementChild ? card : null;
  const mine = list?.querySelectorAll<HTMLElement>('[data-from="citizen"]');
  const last = mine?.[mine.length - 1];
  const root = document.documentElement;
  const header = parseFloat(getComputedStyle(root).getPropertyValue("--citizen-header")) || 0;
  const dock = parseFloat(getComputedStyle(root).getPropertyValue("--citizen-dock")) || 0;
  const top = header + 12;
  const bottom = window.innerHeight - dock - 16;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = still ? "auto" : "smooth";
  if (!target) {
    if (last) window.scrollBy({ top: last.getBoundingClientRect().top - top, behavior });
    return;
  }
  const box = target.getBoundingClientRect();
  // Never further than the card's own top (or the citizen's message above it, when it fits).
  const ceiling =
    last && box.bottom - last.getBoundingClientRect().top <= bottom - top
      ? last.getBoundingClientRect().top - top
      : box.top - top;
  const delta = Math.min(box.bottom - bottom, ceiling);
  if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior });
}

function Turn({
  turn,
  asked,
  you,
  avanti,
  summary,
}: {
  turn: ConversationTurn;
  asked: string | null;
  you: string;
  avanti: string;
  /** One line said instead of the turn's text: the card below holds the details. */
  summary: string | null;
}) {
  const mine = turn.role === "citizen";
  return (
    <ChatBubble
      from={mine ? "citizen" : "assistant"}
      label={mine ? you : avanti}
      text={summary ?? turn.text}
      context={asked}
    />
  );
}
