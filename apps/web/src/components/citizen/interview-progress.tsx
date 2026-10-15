"use client";

import { useState } from "react";
import type { CitizenCase } from "@avanti/contracts";
import { ProgressBar } from "@/components/ui/progress";
import { format, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import { interviewEstimate } from "@/lib/citizen/view";

/** The "questions left" line, for the step header. */
export function RemainingQuestions({
  progress,
  m,
}: {
  progress: CitizenCase["progress"];
  m: Widen<CitizenMessages>;
}) {
  const { remaining } = interviewEstimate(progress);
  if (!remaining) return null;
  return (
    <p aria-hidden className="text-sm text-ink-3">
      {remaining.min !== remaining.max
        ? format(m.interview.remainingRange, { min: remaining.min, max: remaining.max })
        : remaining.max === 1
          ? m.interview.remainingOne
          : format(m.interview.remainingMany, { n: remaining.max })}
    </p>
  );
}

/** The interview bar. While the citizen moves forward it never goes back, even when an answer
 * opens new questions; an edit that removes answers may move it back. */
export function InterviewProgressBar({
  progress,
  m,
}: {
  progress: CitizenCase["progress"];
  m: Widen<CitizenMessages>;
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
          : remaining
            ? format(m.interview.remainingRange, { min: remaining.min, max: remaining.max })
            : ""
      }
      className="mt-2"
    />
  );
}
