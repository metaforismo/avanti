import type { ChatMessage } from "@avanti/contracts";
import { WithCallLinks } from "./call-links";
import { AssistantAvatar } from "./chat-bubble";

/** Latest assistant reply, always labelled as automated (AI Act art. 50 transparency). */
export function AssistantMessage({
  message,
  label,
  question,
}: {
  message: ChatMessage | undefined;
  label: string;
  /** Prompt of the question shown below: a reply that only repeats it adds nothing. */
  question?: string;
}) {
  const visible = message && !(question && normalize(message.text) === normalize(question));
  // The live region stays mounted so screen readers announce replies that arrive later.
  return (
    <div aria-live="polite" aria-atomic="true" className="empty:hidden">
      {visible && <Bubble message={message} label={label} />}
    </div>
  );
}

function Bubble({ message, label }: { message: ChatMessage; label: string }) {
  return (
    <div key={message.id} className="flex animate-rise gap-3">
      <AssistantAvatar />
      <p
        dir="auto"
        className="min-w-0 flex-1 pt-0.5 text-[1.0625rem] leading-relaxed whitespace-pre-line text-ink"
      >
        <span className="sr-only">{label}: </span>
        <WithCallLinks text={message.text} />
      </p>
    </div>
  );
}

export function lastMessage(messages: ChatMessage[], role: ChatMessage["role"]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === role) return messages[i];
  }
  return undefined;
}

const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
