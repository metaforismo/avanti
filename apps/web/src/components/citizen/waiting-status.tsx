"use client";

import { useEffect, useState } from "react";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";

/** The assistant usually answers in a few seconds; the server gives up after about 45. */
export const SLOW_AFTER_MS = 8000;

/**
 * While the assistant reads a message: after a few seconds, says that it is slow and that the
 * message must not be sent again. Always mounted, so screen readers announce the change.
 */
export function WaitingStatus({
  active,
  m,
  showReading = false,
}: {
  active: boolean;
  m: Widen<CitizenMessages>;
  /** Also say "reading" at once, where nothing else on screen does. */
  showReading?: boolean;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);

  const text = !active
    ? ""
    : slow
      ? m.conversation.slow
      : showReading
        ? m.conversation.reading
        : "";
  return (
    <p role="status" className="text-sm text-ink-2 empty:sr-only">
      {text}
    </p>
  );
}
