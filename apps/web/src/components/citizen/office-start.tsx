"use client";

import { Check, Clock, History, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Language, Office, OrganizationPublic, StartIntakeResponse } from "@avanti/contracts";
import { LANGUAGES, RTL_LANGUAGES } from "@avanti/contracts/constants";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { officePlace } from "@/lib/office-place";
import { forgetCase, recallCase, rememberCase } from "@/lib/citizen/local-cases";
import { errorMessage, format, LANGUAGE_NAMES, messagesFor } from "@/lib/citizen/messages";
import { cn } from "@/lib/cn";
import { browserLanguage, directionOf, useDocumentLanguage } from "@/lib/citizen/document-language";
import { ErrorScreen } from "./error-screen";
import { PrivacySheet } from "./privacy-sheet";
import { rise } from "./motion";
import "./citizen.css";

const NON_LATIN = new Set<Language>(["ar", "bn"]);

/**
 * The language radio checked in the page. Before hydration only the DOM knows what the citizen
 * picked (see components/ui/form): React's state still says Italian.
 */
function checkedLanguage(root: ParentNode) {
  const value = root.querySelector<HTMLInputElement>('input[name="language"]:checked')?.value;
  return (LANGUAGES as readonly string[]).includes(value ?? "") ? (value as Language) : null;
}

/** Data Saver (Chromium only): the citizen asked for nothing beyond what the page needs. */
function saveData() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Words every office name starts with: their initial would be «C» or «P» for nearly all. */
const GENERIC_WORDS = new Set(["caf", "patronato", "centro", "di", "del", "della", "dei", "delle"]);

/** «CAF Demo Milano» → «D»: the first word that tells this office apart. */
export function organizationInitial(name: string) {
  const words = name
    .trim()
    .split(/[\s'’.-]+/u)
    .filter(Boolean);
  const telling = words.find((word) => !GENERIC_WORDS.has(word.toLocaleLowerCase("it")));
  return Array.from(telling ?? words[0] ?? "")[0]?.toLocaleUpperCase("it") ?? "";
}

export type OfficeInfo = { office: Office; organization: OrganizationPublic };

export function OfficeStart({
  officeSlug,
  initial,
}: {
  officeSlug: string;
  /** Loaded with the page when possible; otherwise fetched here. */
  initial: OfficeInfo | "missing" | null;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<OfficeInfo | "missing" | "error" | null>(initial);
  const [language, setLanguage] = useState<Language>("it");
  const [consentError, setConsentError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    apiFetch<OfficeInfo>(`/api/offices/${encodeURIComponent(officeSlug)}`)
      .then((data) => !cancelled && setInfo(data))
      .catch((error) => {
        if (cancelled) return;
        setInfo(
          error instanceof ApiRequestError && error.code === "not_found" ? "missing" : "error",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [officeSlug, initial]);

  // Client-only values (browser language, local storage) are read after hydration.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // A language other than the default, checked already, was the citizen's own choice.
      const picked = checkedLanguage(document);
      setLanguage(picked && picked !== "it" ? picked : browserLanguage());
      setResumeToken(recallCase(officeSlug));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [officeSlug]);

  // The next screen's code downloads while the citizen reads and chooses: on a slow connection
  // it was most of the wait after «Inizia». It starts after this page's own fonts and icons,
  // only for an office that exists and never when the citizen asked to save data.
  const officeReady = info !== null && typeof info === "object";
  const prefetched = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (!officeReady || !navigator.onLine || saveData()) return;
    let timer = 0;
    const prefetch = () => {
      timer = window.setTimeout(() => {
        prefetched.current = import("./citizen-app").then(
          () => true,
          () => false,
        );
      }, 300);
    };
    if (document.readyState === "complete") prefetch();
    else window.addEventListener("load", prefetch, { once: true });
    return () => {
      window.removeEventListener("load", prefetch);
      window.clearTimeout(timer);
    };
  }, [officeReady]);

  const m = messagesFor(language);
  const dir = directionOf(language);
  useDocumentLanguage(language);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // Read from the form, not from state: a box ticked before hydration is only in the DOM.
    const consent = (form.elements.namedItem("consent") as HTMLInputElement | null)?.checked;
    const chosen = checkedLanguage(form) ?? language;
    // A language picked before hydration lives only in the DOM until now: the page follows it,
    // so a refused or failed start is explained in it and the next attempt keeps it.
    if (chosen !== language) setLanguage(chosen);
    if (!consent) {
      setConsentError(true);
      document.getElementById("consent")?.focus();
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const result = await apiFetch<StartIntakeResponse>("/api/intake", {
        method: "POST",
        body: { officeSlug, language: chosen, privacyAccepted: true },
      });
      rememberCase(officeSlug, result.token);
      const path = `/pratica/${result.token}` as const;
      // The bundler keeps a failed chunk load for the page's life: a client navigation would
      // fail the same way, after the case was created. A full load fetches it afresh. A prefetch
      // still under way is the download the navigation needs anyway.
      if ((await prefetched.current) === false) window.location.assign(path);
      else router.push(path);
    } catch (error) {
      setStarting(false);
      setStartError(
        errorMessage(
          messagesFor(chosen),
          error instanceof ApiRequestError
            ? error.status === 0
              ? "network"
              : error.code
            : "internal",
        ),
      );
    }
  }

  if (info === "missing" || info === "error") {
    return (
      <ErrorScreen
        lang={language}
        dir={dir}
        retryLabel={m.common.retry}
        title={info === "missing" ? m.start.officeNotFound : m.errors.generic}
        body={info === "missing" ? m.start.officeNotFoundHint : m.errors.network}
        onRetry={info === "error" ? () => window.location.reload() : undefined}
      />
    );
  }

  const orgName = info?.organization.name ?? "";

  return (
    <div lang={language} dir={dir} className="min-h-dvh">
      <header className="bg-surface shadow-[0_1px_0_var(--line)]">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
          {info ? (
            <>
              <span
                aria-hidden
                translate="no"
                className="grid size-11 shrink-0 place-items-center rounded-[0.95rem] bg-contrast font-display text-xl font-bold text-on-contrast"
              >
                {organizationInitial(info.organization.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg leading-tight font-semibold">
                  {info.organization.name}
                </p>
                <p className="truncate text-sm text-ink-3">{info.office.name}</p>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="size-11 shrink-0 rounded-[0.95rem]" />
              <div className="flex-1 space-y-2" aria-hidden>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </>
          )}
          <span translate="no" className="flex items-center gap-1.5 text-xs text-ink-3" dir="ltr">
            <LogoMark className="size-5" />
            Avanti
          </span>
        </div>
      </header>

      {/* Room at the bottom for the pinned «Inizia» bar. */}
      <main className="mx-auto max-w-xl px-5 pt-8 pb-56">
        {resumeToken && (
          <Notice
            tone="info"
            size="md"
            icon={History}
            title={m.start.resumeHint}
            className="mb-8 animate-rise"
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="touch" asChild>
                  <Link href={`/pratica/${resumeToken}`}>{m.start.resume}</Link>
                </Button>
                <Button
                  size="touch"
                  variant="ghost"
                  onClick={() => {
                    forgetCase(officeSlug);
                    setResumeToken(null);
                  }}
                >
                  {m.start.startNew}
                </Button>
              </div>
            }
          />
        )}

        <h1
          {...rise(
            0,
            "font-display text-[clamp(1.75rem,9vw,2.125rem)] leading-[1.04] font-bold tracking-[-0.03em] sm:text-[2.75rem]",
          )}
        >
          {m.start.title}
        </h1>
        <p {...rise(1, "mt-3 text-[1.0625rem] text-ink-2")}>{m.start.lead}</p>
        <p
          {...rise(
            1,
            "mt-4 inline-flex items-center gap-2 rounded-full bg-sunk px-3.5 py-1.5 text-sm text-ink-2",
          )}
        >
          <Clock className="size-4 shrink-0 text-ink-3" aria-hidden />
          <span>
            {m.start.time} {m.start.noAccount}
          </span>
        </p>

        <Form onSubmit={start} className="mt-9 grid gap-7">
          <fieldset {...rise(2)}>
            <legend className="mb-3 text-lg font-semibold">{m.start.chooseLanguage}</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {LANGUAGES.map((code) => (
                // The pill keeps the page's direction, so the column reads straight; only the
                // name is isolated in its own script and direction.
                <label
                  key={code}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center justify-between gap-2 rounded-xl bg-surface px-4 text-[1.0625rem] ring-1 ring-line transition-[background-color,box-shadow,transform] duration-150 ease-(--ease-out) select-none ring-inset active:scale-[0.97]",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp",
                    // From the radio, not from state: a choice made before hydration shows too.
                    "group has-checked:bg-stamp-wash has-checked:font-semibold has-checked:text-stamp has-checked:shadow-raised has-checked:ring-2 has-checked:ring-stamp",
                  )}
                >
                  <input
                    type="radio"
                    name="language"
                    value={code}
                    checked={language === code}
                    onChange={() => setLanguage(code)}
                    className="sr-only"
                  />
                  {/* System font for the other scripts' names: one word isn't worth a 100–200 KB font
                      on the waiting-room network. Choosing the language loads the real one. */}
                  <bdi
                    lang={code}
                    dir={RTL_LANGUAGES.includes(code) ? "rtl" : "ltr"}
                    className={cn(
                      "min-w-0",
                      code !== language &&
                        NON_LATIN.has(code) &&
                        "[font-family:system-ui,sans-serif]",
                    )}
                  >
                    {LANGUAGE_NAMES[code].native}
                  </bdi>
                  <Check
                    className="hidden size-5 shrink-0 animate-check-in group-has-checked:block"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {/* What the citizen must know before starting, in one card instead of two paragraphs. */}
          <div
            {...rise(
              3,
              "divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-raised ring-1 ring-line",
            )}
          >
            <p className="flex gap-3.5 p-4 text-body-sm text-ink-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-stamp-wash text-stamp">
                <Sparkles className="size-[1.125rem]" aria-hidden />
              </span>
              <span className="pt-0.5">{m.start.aiNotice}</span>
            </p>
            <p className="flex gap-3.5 p-4 text-body-sm text-ink-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ok-wash text-ok">
                <ShieldCheck className="size-[1.125rem]" aria-hidden />
              </span>
              <span className="pt-0.5">
                {format(m.start.privacy, { org: orgName })}{" "}
                {/* Before hydration the full Italian notice; after, the short one in the chosen
                  language, which links to the full one. */}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener"
                  onClick={(event) => {
                    event.preventDefault();
                    setNoticeOpen(true);
                  }}
                  className="inline-flex min-h-8 items-center font-semibold text-stamp underline underline-offset-2"
                >
                  {m.start.privacyLink}
                </a>
              </span>
            </p>
          </div>

          {startError && (
            <Notice tone="danger" size="md">
              {startError}
            </Notice>
          )}

          {/* Pinned to the thumb, like the main action of an app; inside the form, so a tap
              before hydration is still held and sent (components/ui/form). */}
          <div className="fixed inset-x-0 bottom-0 z-20 animate-dock-in bg-surface shadow-dock">
            <div className="mx-auto max-w-xl px-5 pt-2 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
              {/* The consent sits on the key it unlocks, not 600 px above it. */}
              <label className="group flex min-h-11 cursor-pointer items-center gap-3 text-[0.9375rem] leading-snug select-none">
                {/* The real checkbox covers the drawn box, so a tap or a test's click lands on it. */}
                <span className="relative grid shrink-0 place-items-center">
                  <input
                    type="checkbox"
                    id="consent"
                    name="consent"
                    onChange={() => setConsentError(false)}
                    aria-invalid={consentError || undefined}
                    aria-describedby={consentError ? "consent-error" : undefined}
                    className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-[1.375rem] shrink-0 place-items-center rounded-md bg-surface ring-2 ring-line-field transition-[background-color,box-shadow,transform] duration-150 ease-(--ease-out) ring-inset group-active:scale-90",
                      "peer-checked:bg-stamp peer-checked:ring-stamp peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-stamp",
                      "[&>svg]:scale-0 [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:ease-(--ease-out) peer-checked:[&>svg]:scale-100",
                      consentError && "ring-danger",
                    )}
                  >
                    <Check className="size-3.5 text-on-stamp" strokeWidth={3.5} />
                  </span>
                </span>
                <span className="min-w-0 flex-1 text-ink">{m.start.consent}</span>
              </label>
              {consentError && (
                <p
                  id="consent-error"
                  role="alert"
                  className="cz-swap ms-[2.125rem] -mt-1 mb-1 text-sm font-medium text-danger"
                >
                  {m.start.consentRequired}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                loading={starting}
                disabled={!info}
                className="mt-1.5 min-h-14 w-full rounded-xl text-[1.0625rem]"
              >
                {m.start.cta}
              </Button>
            </div>
          </div>
        </Form>
        <PrivacySheet
          open={noticeOpen}
          onOpenChange={setNoticeOpen}
          m={m}
          language={language}
          orgName={orgName}
        />

        {info && (info.office.address || info.office.phone) && (
          <address {...rise(5, "mt-8 grid gap-1 rounded-xl bg-sunk/70 p-2 text-ink-2 not-italic")}>
            <span className="flex items-center gap-3 px-2 py-2">
              <MapPin className="size-5 shrink-0 text-ink-3" aria-hidden />
              <span dir="ltr">{officePlace(info.office)}</span>
            </span>
            {info.office.phone && (
              <a
                href={`tel:${info.office.phone.replace(/\s+/g, "")}`}
                className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:text-ink active:bg-sunk"
              >
                <Phone className="size-5 shrink-0 text-ink-3" aria-hidden />
                <span dir="ltr">{info.office.phone}</span>
              </a>
            )}
          </address>
        )}
      </main>
    </div>
  );
}
