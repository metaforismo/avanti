"use client";

import { Check, ChevronDown, Globe, MessageCircleQuestion, WifiOff } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { CitizenCase } from "@avanti/contracts";
import { LANGUAGES, RTL_LANGUAGES } from "@avanti/contracts/constants";
import { Spinner } from "@/components/ui/spinner";
import { useOpenAssistant } from "@/lib/citizen/assistant";
import { format, LANGUAGE_NAMES, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import type { CitizenCaseApi } from "@/lib/citizen/use-citizen-case";
import { cn } from "@/lib/cn";
import { documentCountsOf } from "@/lib/citizen/view";
import type { View } from "./citizen-app";
import { useInterviewShare } from "./interview-progress";

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
  // The step on screen fills as it goes: answers over the estimated total, ready documents over
  // the required ones. A sliver shows from the start, so an empty step never looks unloaded.
  const interviewShare = useInterviewShare(data.progress);
  const counts = documentCountsOf(data);
  const activeShare =
    view === "interview"
      ? (interviewShare ?? 1)
      : view === "documents"
        ? counts.required
          ? counts.ready / counts.required
          : 1
        : 1;
  const activeFill = Math.max(0.06, activeShare);

  // Its height changes with the language and the offline line: what scrolls under it reads it.
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty("--citizen-header", `${element.offsetHeight}px`),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--citizen-header");
    };
  }, []);

  return (
    <header ref={header} className="sticky top-0 z-30 bg-surface shadow-[0_1px_0_var(--line)]">
      <div className="mx-auto flex max-w-xl items-center gap-2.5 px-5 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5">
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-2 font-display text-base leading-tight font-semibold break-words"
            title={data.organization.name}
          >
            {data.organization.name}
          </p>
          {data.office && (
            <p className="truncate text-sm text-ink-3" title={data.office.name}>
              {data.office.name}
            </p>
          )}
        </div>
        <AssistantButton label={m.assistant.open} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-sunk px-3 text-sm font-semibold text-ink-2 transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-line active:scale-[0.96] data-[state=open]:bg-line"
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
              className="z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) animate-pop rounded-md bg-surface p-1 shadow-float ring-1 ring-line data-[state=closed]:animate-sink"
            >
              <DropdownMenu.RadioGroup
                value={data.language}
                onValueChange={(value) => void api.setLanguage(value as (typeof LANGUAGES)[number])}
              >
                {LANGUAGES.map((code) => (
                  <DropdownMenu.RadioItem
                    key={code}
                    value={code}
                    className="flex h-11 cursor-pointer items-center justify-between gap-4 rounded-sm px-3 text-base outline-none data-[highlighted]:bg-stamp-wash data-[highlighted]:ring-2 data-[highlighted]:ring-stamp data-[highlighted]:ring-inset"
                  >
                    {/* The row keeps the page's direction; the name keeps its own. */}
                    <bdi
                      lang={code}
                      dir={RTL_LANGUAGES.includes(code) ? "rtl" : "ltr"}
                      className="min-w-0"
                    >
                      {LANGUAGE_NAMES[code].native}
                    </bdi>
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
          className="mx-auto max-w-xl px-5 pb-2"
        >
          <ol className="flex gap-1.5">
            {STEPS.map((step, i) => {
              const canGo = i <= reached && i !== activeIndex;
              return (
                <li key={step.view} className="min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!canGo}
                    onClick={() => onNavigate(step.view)}
                    aria-current={i === activeIndex ? "step" : undefined}
                    className="group block min-h-11 w-full py-1 text-start disabled:cursor-default [@media(max-height:640px)]:min-h-6 [@media(max-height:640px)]:py-2.5"
                  >
                    {/* The fill grows from the start edge when a step is reached: transform
                        only, mirrored in RTL. */}
                    <span className="block h-1 overflow-hidden rounded-full bg-sunk">
                      <span
                        style={
                          i === activeIndex ? { transform: `scaleX(${activeFill})` } : undefined
                        }
                        className={cn(
                          "block h-full origin-left rounded-full transition-[transform,background-color] duration-500 ease-(--ease-out) rtl:origin-right",
                          i === activeIndex
                            ? "bg-stamp"
                            : i < reached
                              ? "scale-x-100 bg-ok"
                              : "scale-x-0 bg-stamp",
                        )}
                      />
                    </span>
                    {i === activeIndex &&
                      view === "interview" &&
                      data.progress.questionsTotal > 0 && (
                        <span className="sr-only">
                          {format(m.interview.progressLabel, {
                            n: data.progress.questionsAnswered,
                            total: data.progress.questionsTotal,
                          })}
                        </span>
                      )}
                    {/* On a short screen (320×568) the bar alone says where the citizen is: the
                        labels give their 28 px back to the content. */}
                    <span
                      className={cn(
                        "mt-1.5 flex items-center gap-1 truncate text-sm [@media(max-height:640px)]:sr-only",
                        i === activeIndex ? "font-semibold text-ink" : "text-ink-3",
                        canGo && "group-hover:text-ink",
                      )}
                    >
                      {i < activeIndex && (
                        <Check className="size-3.5 shrink-0 text-ok" strokeWidth={3} aria-hidden />
                      )}
                      <span className="min-w-0 truncate">{m.steps[step.key]}</span>
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
          className="flex items-center justify-center gap-2 bg-warn-wash px-5 py-2 text-sm text-warn"
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
      className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-stamp-wash px-3 text-sm font-semibold text-stamp transition-[background-color,transform] duration-150 ease-(--ease-out) hover:bg-folder active:scale-[0.96]"
    >
      <MessageCircleQuestion className="size-4" aria-hidden />
      {/* On the narrowest phones the icon alone leaves room for the CAF's name. */}
      <span className="max-[359px]:sr-only">{label}</span>
    </button>
  );
}
