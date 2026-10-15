"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  MessageCircleQuestion,
  Phone,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import type { CitizenCase } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { useAssistant, type AssistantFocus, type AssistantTurn } from "@/lib/citizen/assistant";
import { errorMessage, format, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import type { View } from "@/lib/citizen/view";
import { cn } from "@/lib/cn";
import { AssistantAvatar, ChatBubble, Thinking } from "./chat-bubble";
import { Composer } from "./composer";

/**
 * The citizen's assistant, reachable from every step. It answers from what Avanti knows about
 * this practice; anything that needs a person goes to the desk, with the citizen's own words.
 */
export function AssistantSheet({
  open,
  onOpenChange,
  focus,
  view,
  data,
  m,
  token,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus: AssistantFocus | undefined;
  view: View;
  data: CitizenCase;
  m: Widen<CitizenMessages>;
  token: string;
  onNavigate: (view: View) => void;
}) {
  const assistant = useAssistant(token);
  const { load, history } = assistant;
  const [desk, setDesk] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const turns = history?.messages ?? [];

  useEffect(() => {
    if (open && !history) void load();
  }, [open, history, load]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns.length, assistant.pending]);

  const suggestions = [
    ...(view === "interview" ? [m.assistant.suggestQuestion] : []),
    ...(view === "documents" || focus?.checklistItemId
      ? [m.assistant.suggestDocument, m.assistant.suggestPhoto]
      : []),
    m.assistant.suggestNext,
  ];
  const lastQuestion = [...turns].reverse().find((t) => t.role === "citizen")?.text ?? "";
  const limited = assistant.error?.code === "rate_limited";

  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim backdrop-blur-[2px]" />
        <Primitive.Content
          className={cn(
            "fixed inset-0 z-50 flex animate-rise flex-col bg-paper outline-none",
            // A side panel next to the practice on larger screens, the whole screen on a phone.
            "sm:inset-y-0 sm:start-auto sm:end-0 sm:w-[28rem] sm:border-s sm:border-line sm:shadow-float",
          )}
        >
          <header className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
            <AssistantAvatar />
            <div className="min-w-0 flex-1">
              <Primitive.Title className="font-semibold">{m.assistant.title}</Primitive.Title>
              <Primitive.Description className="text-sm text-ink-3">
                {m.assistant.disclaimer}
              </Primitive.Description>
            </div>
            <Primitive.Close
              className="grid size-11 shrink-0 place-items-center rounded-md bg-surface text-ink-3 ring-1 ring-line hover:text-ink"
              aria-label={m.common.close}
            >
              <X className="size-5" aria-hidden />
            </Primitive.Close>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
            {turns.length === 0 && assistant.pending !== "load" ? (
              <div className="grid gap-5 pt-6">
                <div className="grid justify-items-center gap-3 text-center">
                  <span
                    aria-hidden
                    className="grid size-12 place-items-center rounded-full bg-stamp-wash text-stamp ring-1 ring-stamp/15"
                  >
                    <Sparkles className="size-6" />
                  </span>
                  <p className="font-display text-2xl font-semibold tracking-[-0.015em]">
                    {m.assistant.empty}
                  </p>
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">
                  {suggestions.map((text) => (
                    <li key={text}>
                      <button
                        type="button"
                        disabled={assistant.pending !== null}
                        onClick={() => void assistant.ask(text, focus)}
                        className="group flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-none disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1">{text}</span>
                        <ArrowUpRight
                          className="rtl-flip size-4 shrink-0 text-ink-3 group-hover:text-ink"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ol aria-live="polite" aria-relevant="additions" className="grid grid-cols-[minmax(0,1fr)] gap-6">
                {turns.map((turn) => (
                  <Bubble
                    key={turn.id}
                    turn={turn}
                    m={m}
                    phone={data.office?.phone ?? null}
                    onAskDesk={() => setDesk(lastQuestion)}
                    onDocuments={() => {
                      onOpenChange(false);
                      onNavigate("documents");
                    }}
                  />
                ))}
                {assistant.pending === "ask" && (
                  <Thinking label={m.assistant.assistant} text={m.assistant.thinking} />
                )}
                {assistant.pending === "load" && turns.length === 0 && (
                  <li className="flex justify-center py-6 text-ink-3">
                    <Spinner label={m.common.loading} />
                  </li>
                )}
              </ol>
            )}
            <div ref={end} />
          </div>

          <div className="grid gap-2 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {assistant.error && (
              <Notice tone="danger">
                {limited
                  ? m.assistant.limit
                  : assistant.error.status === 0
                    ? errorMessage(m, "network")
                    : m.assistant.error}
              </Notice>
            )}
            {desk !== null ? (
              <DeskForm
                m={m}
                initial={desk}
                sent={assistant.deskSent}
                busy={assistant.pending === "desk"}
                onSend={(text) => assistant.askDesk(text)}
                onCancel={() => setDesk(null)}
              />
            ) : (
              <Composer
                token={token}
                language={data.language}
                m={m}
                label={m.assistant.placeholder}
                placeholder={m.assistant.placeholder}
                maxLength={600}
                busy={assistant.pending === "ask"}
                voiceEnabled={data.aiCitizenAssistant !== false}
                onSend={(text) => assistant.ask(text, focus)}
                leading={
                  <button
                    type="button"
                    onClick={() => setDesk(lastQuestion)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-stamp ring-1 ring-line-strong transition-colors hover:bg-stamp-wash focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none"
                  >
                    <MessageCircleQuestion className="size-4" aria-hidden />
                    {m.assistant.askDesk}
                  </button>
                }
              />
            )}
            {history && history.remainingToday <= 5 && (
              <p className="text-center text-xs text-ink-3">
                {format(m.assistant.remaining, { n: history.remainingToday })}
              </p>
            )}
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

function Bubble({
  turn,
  m,
  phone,
  onAskDesk,
  onDocuments,
}: {
  turn: AssistantTurn;
  m: Widen<CitizenMessages>;
  phone: string | null;
  onAskDesk: () => void;
  onDocuments: () => void;
}) {
  const mine = turn.role === "citizen";
  return (
    <ChatBubble
      from={mine ? "citizen" : "assistant"}
      label={mine ? undefined : m.assistant.assistant}
      text={turn.text}
      before={
        turn.intent === "emergency" && (
          // No on-danger token: white on the danger fill is the contrast pair for this alert.
          <p role="alert" className="mb-2 rounded-md bg-danger px-3 py-2 font-semibold text-white">
            <a
              href="tel:112"
              className="inline-flex items-center gap-2 underline underline-offset-2"
            >
              <Phone className="size-4" aria-hidden />
              {m.assistant.emergency}
            </a>
          </p>
        )
      }
    >
      {!mine && turn.sources && turn.sources.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="sr-only">{m.assistant.sources}:</span>
          {turn.sources.map((source) => (
            <span
              key={source.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-ink-2 ring-1 ring-line"
            >
              <BookOpen className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{source.title}</span>
            </span>
          ))}
        </div>
      )}
      {!mine && (turn.intent === "needs_operator" || turn.action === "ask_desk") && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onAskDesk}>
            <MessageCircleQuestion className="size-4" aria-hidden />
            {m.assistant.askDesk}
          </Button>
          {phone && (
            <Button size="sm" variant="ghost" asChild>
              <a href={`tel:${phone.replace(/\s+/g, "")}`} dir="ltr">
                <Phone className="size-4" aria-hidden />
                {phone}
              </a>
            </Button>
          )}
        </div>
      )}
      {!mine && turn.action === "open_documents" && (
        <Button size="sm" variant="secondary" className="mt-2" onClick={onDocuments}>
          {m.assistant.goToDocuments}
          <ArrowRight className="rtl-flip size-4" aria-hidden />
        </Button>
      )}
    </ChatBubble>
  );
}

function DeskForm({
  m,
  initial,
  sent,
  busy,
  onSend,
  onCancel,
}: {
  m: Widen<CitizenMessages>;
  initial: string;
  sent: boolean;
  busy: boolean;
  onSend: (text: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  if (sent)
    return (
      <Notice tone="ok" size="md">
        {m.assistant.askDeskSent}
      </Notice>
    );
  return (
    <form
      className="grid gap-2 rounded-lg bg-paper p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) void onSend(text.trim());
      }}
    >
      <label htmlFor="desk-message" className="font-semibold">
        {m.assistant.askDesk}
      </label>
      <p className="text-sm text-ink-3">{m.assistant.askDeskHint}</p>
      <textarea
        id="desk-message"
        dir="auto"
        rows={3}
        maxLength={600}
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        className="w-full resize-y rounded-sm bg-surface p-3 text-base ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy} disabled={!text.trim()}>
          <Send className="rtl-flip size-4" aria-hidden />
          {m.assistant.askDeskSend}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {m.common.cancel}
        </Button>
      </div>
    </form>
  );
}
