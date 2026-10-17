"use client";

import { History, MapPin, Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Language, Office, OrganizationPublic, StartIntakeResponse } from "@avanti/contracts";
import { LANGUAGES, RTL_LANGUAGES } from "@avanti/contracts/constants";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { forgetCase, recallCase, rememberCase } from "@/lib/citizen/local-cases";
import { errorMessage, format, LANGUAGE_NAMES, messagesFor } from "@/lib/citizen/messages";
import { cn } from "@/lib/cn";
import { browserLanguage, directionOf, useDocumentLanguage } from "@/lib/citizen/document-language";
import { ErrorScreen } from "./error-screen";

const NON_LATIN = new Set<Language>(["ar", "bn"]);

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
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [resumeToken, setResumeToken] = useState<string | null>(null);

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
      setLanguage(browserLanguage());
      setResumeToken(recallCase(officeSlug));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [officeSlug]);

  const m = messagesFor(language);
  const dir = directionOf(language);
  useDocumentLanguage(language);

  async function start(event: FormEvent) {
    event.preventDefault();
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
        body: { officeSlug, language, privacyAccepted: true },
      });
      rememberCase(officeSlug, result.token);
      router.push(`/pratica/${result.token}`);
    } catch (error) {
      setStarting(false);
      setStartError(
        errorMessage(
          m,
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
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
          {info ? (
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg leading-tight font-semibold">
                {info.organization.name}
              </p>
              <p className="truncate text-sm text-ink-3">{info.office.name}</p>
            </div>
          ) : (
            <div className="flex-1 space-y-2" aria-hidden>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          )}
          <span translate="no" className="flex items-center gap-1.5 text-xs text-ink-3" dir="ltr">
            <LogoMark className="size-5" />
            Avanti
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-8 pb-16">
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

        <h1 className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.025em] sm:text-[2.5rem]">
          {m.start.title}
        </h1>
        <p className="mt-3 text-lg text-ink-2">{m.start.lead}</p>
        <p className="mt-2 text-ink-3">
          {m.start.time} {m.start.noAccount}
        </p>

        <form onSubmit={start} className="mt-10 grid gap-8">
          <fieldset>
            <legend className="mb-3 text-lg font-semibold">{m.start.chooseLanguage}</legend>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((code) => (
                <label
                  key={code}
                  lang={code}
                  dir={RTL_LANGUAGES.includes(code) ? "rtl" : "ltr"}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-md bg-surface px-4 text-lg ring-1 ring-line-strong transition-shadow duration-150 ring-inset",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp",
                    language === code && "font-semibold ring-2 ring-stamp",
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
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full ring-2 ring-line-strong",
                      language === code && "ring-stamp",
                    )}
                  >
                    {language === code && <span className="size-2.5 rounded-full bg-stamp" />}
                  </span>
                  {/* System font for the other scripts' names: one word isn't worth a 100–200 KB font
                      on the waiting-room network. Choosing the language loads the real one. */}
                  <span
                    className={cn(
                      code !== language &&
                        NON_LATIN.has(code) &&
                        "[font-family:system-ui,sans-serif]",
                    )}
                  >
                    {LANGUAGE_NAMES[code].native}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3">
            <p className="flex gap-3 rounded-md bg-folder/60 p-4 text-ink-2">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-stamp" aria-hidden />
              {m.start.aiNotice}
            </p>
            <p className="text-ink-2">
              {format(m.start.privacy, { org: orgName })}{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener"
                className="font-semibold text-stamp underline underline-offset-2"
              >
                {m.start.privacyLink}
              </a>
            </p>
            <Checkbox
              look="card"
              id="consent"
              label={m.start.consent}
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setConsentError(false);
              }}
              aria-invalid={consentError || undefined}
              aria-describedby={consentError ? "consent-error" : undefined}
            />
            {consentError && (
              <p id="consent-error" role="alert" className="text-sm font-medium text-danger">
                {m.start.consentRequired}
              </p>
            )}
          </div>

          {startError && (
            <Notice tone="danger" size="md">
              {startError}
            </Notice>
          )}

          <Button type="submit" size="lg" loading={starting} disabled={!info} className="w-full">
            {m.start.cta}
          </Button>
        </form>

        {info && (info.office.address || info.office.phone) && (
          <address className="mt-12 grid gap-2 border-t border-line pt-6 text-ink-2 not-italic">
            <span className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
              <span dir="ltr">
                {info.office.address}, {info.office.city}
              </span>
            </span>
            {info.office.phone && (
              <a
                href={`tel:${info.office.phone.replace(/\s+/g, "")}`}
                className="flex items-center gap-2 hover:text-ink"
              >
                <Phone className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span dir="ltr">{info.office.phone}</span>
              </a>
            )}
          </address>
        )}
      </main>
    </div>
  );
}
