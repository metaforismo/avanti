"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CitizenCase, CitizenContact } from "@avanti/contracts";
import {
  directionOf,
  useBrowserLanguage,
  useDocumentLanguage,
} from "@/lib/citizen/document-language";
import { AssistantContext, type AssistantFocus } from "@/lib/citizen/assistant";
import { forgetCaseToken } from "@/lib/citizen/local-cases";
import { messagesFor, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import { useCitizenCase, type CitizenCaseApi } from "@/lib/citizen/use-citizen-case";
import { resolveView, STEP_TITLE_ID, type View } from "@/lib/citizen/view";
import { AssistantSheet } from "./assistant-sheet";
import { CitizenHeader } from "./citizen-header";
import { DocumentsStep } from "./documents-step";
import { DoneStep } from "./done-step";
import { ErrorScreen } from "./error-screen";
import { ConversationStep } from "./conversation-step";
import { NeedStep } from "./need-step";
import { ReviewStep } from "./review-step";

export type { View };

export type StepProps = {
  api: CitizenCaseApi;
  data: CitizenCase;
  m: Widen<CitizenMessages>;
  goTo: (view: View | null) => void;
  /** Capability token, needed to build file URLs. */
  token: string;
  /** Review form values survive going back to edit answers or documents. */
  draft: ContactDraft;
  setDraft: (draft: ContactDraft) => void;
};

export type ContactDraft = Partial<CitizenContact> & { note?: string };

const SUBMITTED_STATUSES = new Set(["submitted", "in_review", "ready", "closed"]);

export function CitizenApp({ token }: { token: string }) {
  const api = useCitizenCase(token);
  // Local navigation on top of the server step: going back to edit, or forward to review.
  const [view, setView] = useState<View | null>(null);
  const [draft, setDraft] = useState<ContactDraft>({});
  const [assistant, setAssistant] = useState<{ open: boolean; focus?: AssistantFocus }>({
    open: false,
  });
  const assistantApi = useMemo(
    () => ({ open: (focus?: AssistantFocus) => setAssistant({ open: true, focus }) }),
    [],
  );
  const firstStep = useRef(true);

  const { state } = api;
  useEffect(() => {
    if (state.kind === "error" && (state.code === "link_expired" || state.code === "not_found")) {
      forgetCaseToken(token);
    }
  }, [state, token]);

  // Every step change starts from the top, including server-driven ones (e.g. after submit).
  const stepKey =
    state.kind === "ready" ? `${state.data.status}:${state.data.step}:${view}` : state.kind;
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (firstStep.current) {
      firstStep.current = state.kind !== "ready";
      return;
    }
    document.getElementById(STEP_TITLE_ID)?.focus({ preventScroll: true });
  }, [stepKey, state.kind]);

  const deviceLanguage = useBrowserLanguage();
  const language = state.kind === "ready" ? state.data.language : deviceLanguage;
  useDocumentLanguage(language);

  const goTo = (next: View | null) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  if (state.kind === "loading")
    return <LoadingShell label={messagesFor(language).common.loading} />;

  if (state.kind === "error") {
    const m = messagesFor(language);
    const expired = state.code === "link_expired";
    const missing = state.code === "not_found";
    return (
      <ErrorScreen
        title={
          expired ? m.errors.expiredTitle : missing ? m.errors.notFoundTitle : m.errors.generic
        }
        body={expired ? m.errors.expiredBody : missing ? m.errors.notFoundBody : m.errors.network}
        onRetry={expired || missing ? undefined : () => void api.reload()}
        retryLabel={m.common.retry}
        lang={language}
        dir={directionOf(language)}
      />
    );
  }

  const data = state.data;
  const m = messagesFor(data.language);
  const submitted = SUBMITTED_STATUSES.has(data.status);
  const current: View = submitted ? "submitted" : resolveView(view, data);
  const props: StepProps = { api, data, m, goTo, token, draft, setDraft };

  return (
    <AssistantContext.Provider value={assistantApi}>
      <div
        lang={data.language}
        dir={directionOf(data.language)}
        className="flex min-h-dvh flex-col"
      >
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          {m.common.skipToContent}
        </a>
        <CitizenHeader data={data} m={m} view={current} api={api} onNavigate={goTo} />
        <main id="contenuto" className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-32">
          {current === "need" && <NeedStep {...props} />}
          {current === "interview" && <ConversationStep {...props} />}
          {current === "documents" && <DocumentsStep {...props} />}
          {current === "review" && <ReviewStep {...props} />}
          {current === "submitted" && <DoneStep {...props} />}
        </main>
        <AssistantSheet
          open={assistant.open}
          onOpenChange={(open) => setAssistant((a) => ({ ...a, open }))}
          focus={assistant.focus}
          view={current}
          data={data}
          m={m}
          token={token}
          onNavigate={goTo}
        />
      </div>
    </AssistantContext.Provider>
  );
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="min-h-dvh" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded-xs bg-sunk" />
            <div className="h-3 w-24 animate-pulse rounded-xs bg-sunk" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-xl space-y-4 px-4 pt-8">
        <div className="h-8 w-3/4 animate-pulse rounded-sm bg-sunk" />
        <div className="h-4 w-full animate-pulse rounded-xs bg-sunk" />
        <div className="h-4 w-2/3 animate-pulse rounded-xs bg-sunk" />
        <div className="mt-8 h-32 animate-pulse rounded-lg bg-sunk" />
      </div>
    </div>
  );
}
