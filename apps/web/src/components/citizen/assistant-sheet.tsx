"use client";

import { ArrowRight, MessageCircleQuestion, Phone, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CitizenCase } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAssistant, type AssistantFocus, type AssistantTurn } from "@/lib/citizen/assistant";
import { errorMessage, format, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import type { View } from "@/lib/citizen/view";
import { cn } from "@/lib/cn";
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.assistant.title}
      description={m.assistant.disclaimer}
      closeLabel={m.common.close}
      className="sm:max-w-xl"
    >
      <div className="grid gap-4">
        <ol
          aria-live="polite"
          aria-relevant="additions"
          className="grid max-h-[50dvh] gap-3 overflow-y-auto overscroll-contain"
        >
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
            <li className="flex items-center gap-2 text-sm text-ink-3">
              <Spinner className="size-4" />
              {m.assistant.thinking}
            </li>
          )}
          {assistant.pending === "load" && turns.length === 0 && (
            <li className="flex justify-center py-6 text-ink-3">
              <Spinner label={m.common.loading} />
            </li>
          )}
          <div ref={end} />
        </ol>

        {turns.length === 0 && assistant.pending !== "load" && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                disabled={assistant.pending !== null}
                onClick={() => void assistant.ask(text, focus)}
                className="rounded-full bg-stamp-wash px-3.5 py-2 text-start text-sm font-semibold text-stamp hover:bg-stamp/15 disabled:opacity-50"
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {assistant.error && (
          <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
            {limited
              ? m.assistant.limit
              : assistant.error.status === 0
                ? errorMessage(m, "network")
                : m.assistant.error}
          </p>
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
          <>
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
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {history && history.remainingToday <= 5 && (
                <span className="text-ink-3">
                  {format(m.assistant.remaining, { n: history.remainingToday })}
                </span>
              )}
              <button
                type="button"
                onClick={() => setDesk(lastQuestion)}
                className="ms-auto inline-flex items-center gap-1.5 font-semibold text-stamp underline underline-offset-4"
              >
                <MessageCircleQuestion className="size-4" aria-hidden />
                {m.assistant.askDesk}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
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
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-4 py-2.5",
          mine ? "rounded-ee-md bg-stamp text-on-stamp" : "rounded-es-md bg-sunk",
        )}
      >
        {!mine && (
          <p className="mb-0.5 flex items-center gap-1 text-xs text-ink-3">
            <Sparkles className="size-3" aria-hidden />
            {m.assistant.assistant}
          </p>
        )}
        {turn.intent === "emergency" && (
          <p role="alert" className="mb-2 rounded-md bg-danger px-3 py-2 font-semibold text-white">
            <a href="tel:112" className="inline-flex items-center gap-2 underline">
              <Phone className="size-4" aria-hidden />
              {m.assistant.emergency}
            </a>
          </p>
        )}
        <p dir="auto" className="break-words whitespace-pre-line">
          {turn.text}
        </p>
        {!mine && turn.sources && turn.sources.length > 0 && (
          <p className="mt-1.5 text-xs text-ink-3">
            {m.assistant.sources}: {turn.sources.map((s) => s.title).join(" · ")}
          </p>
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
      </div>
    </li>
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
      <p role="status" className="rounded-md bg-ok-wash px-4 py-3 text-ok">
        {m.assistant.askDeskSent}
      </p>
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
