"use client";

import { useEffect, useState } from "react";
import { LANGUAGES, RTL_LANGUAGES, type CitizenCase, type Language } from "@avanti/contracts";
import { forgetCaseToken } from "@/lib/citizen/local-cases";
import { messagesFor, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import { useCitizenCase, type CitizenCaseApi } from "@/lib/citizen/use-citizen-case";
import { resolveView, type View } from "@/lib/citizen/view";
import { CitizenHeader } from "./citizen-header";
import { DocumentsStep } from "./documents-step";
import { DoneStep } from "./done-step";
import { ErrorScreen } from "./error-screen";
import { InterviewStep } from "./interview-step";
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
};

const SUBMITTED_STATUSES = new Set(["submitted", "in_review", "ready", "closed"]);

function guessLanguage(): Language {
  if (typeof navigator === "undefined") return "it";
  const base = navigator.language.slice(0, 2).toLowerCase();
  return (LANGUAGES as readonly string[]).includes(base) ? (base as Language) : "it";
}

export function CitizenApp({ token }: { token: string }) {
  const api = useCitizenCase(token);
  // Local navigation on top of the server step: going back to edit, or forward to review.
  const [view, setView] = useState<View | null>(null);

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
  }, [stepKey]);

  const goTo = (next: View | null) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  if (state.kind === "loading") return <LoadingShell />;

  if (state.kind === "error") {
    const m = messagesFor(guessLanguage());
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
      />
    );
  }

  const data = state.data;
  const m = messagesFor(data.language);
  const submitted = SUBMITTED_STATUSES.has(data.status);
  const current: View = submitted ? "submitted" : resolveView(view, data);
  const props: StepProps = { api, data, m, goTo, token };

  return (
    <div
      lang={data.language}
      dir={RTL_LANGUAGES.includes(data.language) ? "rtl" : "ltr"}
      className="flex min-h-dvh flex-col"
    >
      <CitizenHeader data={data} m={m} view={current} api={api} onNavigate={goTo} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-32">
        {current === "need" && <NeedStep {...props} />}
        {current === "interview" && <InterviewStep {...props} />}
        {current === "documents" && <DocumentsStep {...props} />}
        {current === "review" && <ReviewStep {...props} />}
        {current === "submitted" && <DoneStep {...props} />}
      </main>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-dvh" aria-busy="true">
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
