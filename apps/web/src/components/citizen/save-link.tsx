"use client";

import { Share2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";

const noSubscribe = () => () => {};

/** Copy or share the personal link: it is the citizen's only way back to the case. */
export function SaveLinkActions({ m, title }: { m: Widen<CitizenMessages>; title: string }) {
  const link = useSyncExternalStore(
    noSubscribe,
    () => window.location.href,
    () => "",
  );
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function share() {
    try {
      await navigator.share({ title, url: link });
    } catch {
      // Cancelled by the user or no share target: nothing to report.
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <CopyButton
        size="touch"
        value={link}
        labels={{ copy: m.done.copyLink, copied: m.done.copied, failed: m.done.copyFailed }}
      />
      {canShare && (
        <Button size="touch" variant="secondary" onClick={() => void share()}>
          <Share2 className="size-4" aria-hidden />
          {m.done.share}
        </Button>
      )}
    </div>
  );
}
