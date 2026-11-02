import { Check, LinkIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function ErrorScreen({
  title,
  body,
  lang,
  dir = "ltr",
  onRetry,
  retryLabel,
  tone = "problem",
}: {
  title: string;
  body: string;
  lang: string;
  dir?: "ltr" | "rtl";
  onRetry?: () => void;
  /** Required with onRetry: the label must be in the page language. */
  retryLabel?: string;
  /** "done" for an ending the citizen chose (an erased practice), not a broken link. */
  tone?: "problem" | "done";
}) {
  return (
    <main lang={lang} dir={dir} className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        {/* Someone who lands here from a broken link should still see where they are. */}
        <span className="mb-10 inline-block">
          <Logo />
        </span>
        {tone === "done" ? (
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok text-white">
            <Check className="size-7" strokeWidth={2.5} aria-hidden />
          </span>
        ) : (
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-sunk text-ink-2">
            <LinkIcon className="size-6" aria-hidden />
          </span>
        )}
        <h1 className="mt-6 font-display text-3xl font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-3 text-lg text-ink-2">{body}</p>
        {onRetry && retryLabel && (
          <Button className="mt-8" size="lg" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </main>
  );
}
