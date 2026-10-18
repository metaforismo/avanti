"use client";

import { useState } from "react";
import type { CitizenCase, Language } from "@avanti/contracts";
import { ProgressBar } from "@/components/ui/progress";
import { format, plural, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import { interviewEstimate } from "@/lib/citizen/view";

/** The "questions left" line, for the step header. */
export function RemainingQuestions({
  progress,
  language,
  m,
}: {
  progress: CitizenCase["progress"];
  language: Language;
  m: Widen<CitizenMessages>;
}) {
  const { remaining } = interviewEstimate(progress);
  if (!remaining) return null;
  return (
    <p aria-hidden className="text-sm text-ink-3">
      {remaining.atLeast || remaining.min !== remaining.max
        ? rangeText(remaining, language, m)
        : remaining.max === 1
          ? m.interview.remainingOne
          : format(m.interview.remainingMany, { n: remaining.max })}
    </p>
  );
}

/**
 * A floor this high reads as a long road and says little: what lies behind «at least 16» can be
 * 16 questions or 400 (one per person, per account). Until it gets small the line says how the
 * questions come instead; the bar still shows the way done.
 */
const OPEN_FLOOR = 8;

/** "At least 3" or "3–5" questions left. In a range the noun agrees with the last number. */
function rangeText(
  remaining: { min: number; max: number; atLeast?: boolean },
  language: Language,
  m: Widen<CitizenMessages>,
) {
  if (remaining.atLeast && remaining.min > OPEN_FLOOR) return m.interview.remainingOpen;
  return remaining.atLeast
    ? plural(language, remaining.min, m.interview.remainingAtLeast)
    : plural(language, remaining.max, m.interview.remainingRange, {
        min: remaining.min,
        max: remaining.max,
      });
}

/** The interview bar. While the citizen moves forward it never goes back, even when an answer
 * opens new questions; an edit that removes answers may move it back. */
export function InterviewProgressBar({
  progress,
  language,
  m,
}: {
  progress: CitizenCase["progress"];
  language: Language;
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
            ? rangeText(remaining, language, m)
            : ""
      }
      className="mt-2"
    />
  );
}
