"use client";

import { Check, ChevronDown, Globe, MessageCircleQuestion, WifiOff } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useSyncExternalStore } from "react";
import type { CitizenCase } from "@avanti/contracts";
import { LANGUAGES, RTL_LANGUAGES } from "@avanti/contracts/constants";
import { Spinner } from "@/components/ui/spinner";
import { useOpenAssistant } from "@/lib/citizen/assistant";
import { format, LANGUAGE_NAMES, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import type { CitizenCaseApi } from "@/lib/citizen/use-citizen-case";
import { cn } from "@/lib/cn";
import type { View } from "./citizen-app";

function useOnline() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

const STEPS: { view: View; key: "interview" | "documents" | "review" }[] = [
  { view: "interview", key: "interview" },
  { view: "documents", key: "documents" },
  { view: "review", key: "review" },
];

export function CitizenHeader({
  data,
  m,
  view,
  api,
  onNavigate,
}: {
  data: CitizenCase;
  m: Widen<CitizenMessages>;
  view: View;
  api: CitizenCaseApi;
  onNavigate: (view: View | null) => void;
}) {
  const online = useOnline();
  // Index of the furthest step the citizen may open: review becomes reachable with documents.
  const reached =
    data.step === "documents" || data.step === "review" ? 2 : data.step === "interview" ? 0 : -1;
  const activeIndex = view === "need" ? -1 : STEPS.findIndex((s) => s.view === view);
  const switching = api.pending === "language";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-3 pb-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-tight font-semibold">
            {data.organization.name}
          </p>
          {data.office && <p className="truncate text-sm text-ink-3">{data.office.name}</p>}
        </div>
        <AssistantButton label={m.assistant.open} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="inline-flex h-11 items-center gap-1.5 rounded-sm px-2.5 text-sm font-semibold text-ink-2 ring-1 ring-line-strong ring-inset hover:bg-sunk data-[state=open]:bg-sunk"
            aria-label={`${m.common.language}: ${LANGUAGE_NAMES[data.language].native}`}
          >
            {switching ? <Spinner className="size-4" /> : <Globe className="size-4" aria-hidden />}
            <span>{data.language.toUpperCase()}</span>
            <ChevronDown className="size-3.5" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-48 animate-pop rounded-md bg-surface p-1 shadow-float ring-1 ring-line"
            >
              <DropdownMenu.RadioGroup
                value={data.language}
                onValueChange={(value) => void api.setLanguage(value as (typeof LANGUAGES)[number])}
              >
                {LANGUAGES.map((code) => (
                  <DropdownMenu.RadioItem
                    key={code}
                    value={code}
                    lang={code}
                    dir={RTL_LANGUAGES.includes(code) ? "rtl" : "ltr"}
                    className="flex h-11 cursor-pointer items-center justify-between gap-4 rounded-sm px-3 text-base outline-none data-[highlighted]:bg-stamp-wash data-[highlighted]:ring-2 data-[highlighted]:ring-stamp data-[highlighted]:ring-inset"
                  >
                    {LANGUAGE_NAMES[code].native}
                    <DropdownMenu.ItemIndicator>
                      <Check className="size-4 text-stamp" aria-hidden />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {view !== "submitted" && view !== "need" && (
        <nav
          aria-label={format(m.status.progress, { n: Math.round(data.progress.percent) })}
          className="mx-auto max-w-xl px-4 pb-3"
        >
          <ol className="flex gap-1.5">
            {STEPS.map((step, i) => {
              const canGo = i <= reached && i !== activeIndex;
              return (
                <li key={step.view} className="flex-1">
                  <button
                    type="button"
                    disabled={!canGo}
                    onClick={() => onNavigate(step.view)}
                    aria-current={i === activeIndex ? "step" : undefined}
                    className="group block min-h-11 w-full py-1 text-start disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "block h-1 rounded-full transition-colors duration-300",
                        i === activeIndex ? "bg-stamp" : i < reached ? "bg-ok" : "bg-sunk",
                      )}
                    />
                    <span
                      className={cn(
                        "mt-1.5 block truncate text-sm",
                        i === activeIndex ? "font-semibold text-ink" : "text-ink-3",
                        canGo && "group-hover:text-ink",
                      )}
                    >
                      {m.steps[step.key]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {!online && (
        <p
          role="status"
          className="flex items-center justify-center gap-2 bg-warn-wash px-4 py-2 text-sm text-warn"
        >
          <WifiOff className="size-4" aria-hidden />
          {m.errors.network}
        </p>
      )}
    </header>
  );
}

function AssistantButton({ label }: { label: string }) {
  const open = useOpenAssistant();
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={() => open()}
      className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-sm px-2.5 text-sm font-semibold text-stamp ring-1 ring-stamp/30 ring-inset hover:bg-stamp-wash"
    >
      <MessageCircleQuestion className="size-4" aria-hidden />
      {/* On the narrowest phones the icon alone leaves room for the CAF's name. */}
      <span className="max-[359px]:sr-only">{label}</span>
    </button>
  );
}
