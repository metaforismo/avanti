import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@avanti/contracts";

/** Latest assistant reply, always labelled as automated (AI Act art. 50 transparency). */
export function AssistantMessage({
  message,
  label,
}: {
  message: ChatMessage | undefined;
  label: string;
}) {
  if (!message) return null;
  return (
    <div
      key={message.id}
      className="animate-rise rounded-lg rounded-ss-xs bg-stamp-wash px-4 py-3.5"
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-stamp">
        <Sparkles className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="text-[1.0625rem] leading-relaxed whitespace-pre-line text-ink">
        {message.text}
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
