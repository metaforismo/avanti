import type { ChatMessage } from "@avanti/contracts";
import { WithCallLinks } from "./call-links";
import { AssistantMark } from "./chat-bubble";

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
    <div key={message.id} className="grid animate-rise gap-1.5">
      <AssistantMark label={label} />
      <p dir="auto" className="ps-8 text-[1.0625rem] leading-relaxed whitespace-pre-line text-ink">
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
