import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorScreen({
  title,
  body,
  lang,
  onRetry,
  retryLabel = "Riprova",
}: {
  title: string;
  body: string;
  lang?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <main lang={lang} className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-sunk text-ink-2">
          <LinkIcon className="size-6" aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-3 text-lg text-ink-2">{body}</p>
        {onRetry && (
          <Button className="mt-8" size="lg" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </main>
  );
}
