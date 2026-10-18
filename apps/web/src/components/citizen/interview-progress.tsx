"use client";

import { useState } from "react";
import type { CitizenCase, Language } from "@avanti/contracts";
import { ProgressBar } from "@/components/ui/progress";
import { format, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import { interviewEstimate, remainingText } from "@/lib/citizen/view";

/** The "questions left" line, for the step header. */
export function RemainingQuestions({
  progress,
  language,
  m,
  section,
}: {
  progress: CitizenCase["progress"];
  language: Language;
  m: Widen<CitizenMessages>;
  /** Section of the question on screen, said instead of a long and vague count. */
  section?: string;
}) {
  const text = remainingText(interviewEstimate(progress).remaining, language, m, section);
  if (!text) return null;
  return (
    <p aria-hidden className="text-sm text-ink-3">
      {text}
    </p>
  );
}

/** The interview bar. While the citizen moves forward it never goes back, even when an answer
 * opens new questions; an edit that removes answers may move it back. */
export function InterviewProgressBar({
  progress,
  language,
  m,
  section,
}: {
  progress: CitizenCase["progress"];
  language: Language;
  m: Widen<CitizenMessages>;
  section?: string;
}) {
  const { percent } = interviewEstimate(progress);
  const answered = progress.questionsAnswered;
  const [bar, setBar] = useState({ answered, percent: percent ?? 0 });
  if (bar.answered !== answered) {
    const forward = answered > bar.answered;
    setBar({ answered, percent: forward ? Math.max(bar.percent, percent ?? 0) : (percent ?? 0) });
  }
  if (percent === null) return null;
  const { remaining } = interviewEstimate(progress);
  return (
    <ProgressBar
      value={Math.max(bar.percent, 0)}
      label={
        progress.questionsTotal > 0
          ? format(m.interview.progressLabel, { n: answered, total: progress.questionsTotal })
          : (remainingText(remaining, language, m, section) ?? "")
      }
      className="mt-2"
    />
  );
}
