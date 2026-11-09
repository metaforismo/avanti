import { Camera, ChevronDown, Files, Frame, Sun, ZapOff } from "lucide-react";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";

/**
 * Most unusable uploads are bad photos, and every one costs the CAF a phone call.
 * Closed: the first screen of documents is for the camera buttons, the tips are one tap away.
 */
export function PhotoTips({ m }: { m: Widen<CitizenMessages> }) {
  const tips = [
    { icon: Sun, text: m.docs.photoTip1 },
    { icon: Frame, text: m.docs.photoTip2 },
    { icon: ZapOff, text: m.docs.photoTip3 },
    { icon: Files, text: m.docs.photoTip4 },
  ];
  return (
    <details className="group rounded-xl bg-folder/50 ring-1 ring-folder">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        <Camera className="size-5 shrink-0 text-stamp" aria-hidden />
        <span className="flex-1">{m.docs.photoTipsTitle}</span>
        <ChevronDown
          className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ul className="grid gap-3 px-4 pb-4">
        {tips.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3 text-ink-2">
            <Icon className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
    </details>
  );
}
