"use client";

import {
  CalendarCheck,
  Check,
  Copy,
  ExternalLink,
  FileWarning,
  IdCard,
  Info,
  MapPin,
  Phone,
} from "lucide-react";
import { useState } from "react";
import { CHEVRON_PATH } from "@/components/brand/mark";
import { officePlace } from "@/lib/office-place";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { STEP_TITLE_ID, stillToDo } from "@/lib/citizen/view";
import type { StepProps } from "./citizen-app";
import { SaveLinkActions } from "./save-link";

export function DoneStep({ api, data, m, token }: StepProps) {
  // Once sent, the citizen can no longer upload: what is still missing goes to the office, all of
  // it, since this list is what they take to the desk.
  const missing = data.status === "submitted" || data.status === "in_review" ? stillToDo(data) : [];
  const statusLine =
    data.status === "in_review"
      ? m.done.inReview
      : data.status === "ready"
        ? m.done.ready
        : data.status === "closed"
          ? m.done.closed
          : null;

  return (
    <div className="grid gap-8 pt-4">
      <div>
        <span className="grid size-16 animate-check-in place-items-center rounded-full bg-ok text-white shadow-[0_10px_24px_-12px_var(--ok)]">
          <Check className="size-8" strokeWidth={2.5} aria-hidden />
        </span>
        <h1
          id={STEP_TITLE_ID}
          tabIndex={-1}
          className="mt-6 font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.025em] outline-none"
        >
          {m.done.title}
        </h1>
        <p className="mt-3 text-lg text-ink-2">{m.done.lead}</p>
        {statusLine && <Notice tone="info" size="md" title={statusLine} className="mt-3" />}
      </div>

      {/* The reference as the paper ticket taken at the desk: what the citizen shows there. */}
      <dl
        className={cn(
          "relative animate-ticket-in overflow-hidden rounded-[14px] bg-stamp px-6 py-5 text-on-stamp shadow-raised [animation-delay:120ms]",
          // The two half-moon notches of a tear-off ticket, cut by the paper behind it.
          "before:absolute before:-start-2.5 before:top-1/2 before:size-5 before:-translate-y-1/2 before:rounded-full before:bg-paper",
          "after:absolute after:-end-2.5 after:top-1/2 after:size-5 after:-translate-y-1/2 after:rounded-full after:bg-paper",
        )}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <dt className="text-xs font-semibold tracking-[0.12em] uppercase opacity-80">
              {m.done.reference}
            </dt>
            <dd
              className="tabular mt-1.5 font-mono text-[1.625rem] leading-none font-semibold tracking-wide rtl:text-right"
              dir="ltr"
              translate="no"
            >
              {data.reference}
            </dd>
            {data.practice && (
              <dd className="mt-2 text-body-sm opacity-85">{data.practice.name}</dd>
            )}
          </div>
          <svg viewBox="11 9 9.5 14" aria-hidden className="rtl-flip h-12 w-8 shrink-0 opacity-90">
            <path
              d={CHEVRON_PATH}
              fill="none"
              stroke="var(--marker)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </dl>

      {data.office?.bookingUrl && (
        <div className="grid gap-2">
          <Button asChild size="lg">
            {/* An external site chosen by the CAF: no referrer, no access to this page. */}
            <a href={data.office.bookingUrl} target="_blank" rel="noopener noreferrer">
              <CalendarCheck className="size-5" aria-hidden />
              {m.done.book}
              <ExternalLink className="size-4 opacity-70" aria-hidden />
            </a>
          </Button>
          <p className="text-center text-sm text-ink-3">{m.done.bookHint}</p>
        </div>
      )}

      {missing.length > 0 && (
        <section aria-labelledby="bring-title" className="rounded-lg bg-warn-wash/60 p-5">
          <h2 id="bring-title" className="flex items-start gap-2 font-semibold">
            <FileWarning className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
            {m.done.bringMissing}
          </h2>
          <ul className="mt-3 grid gap-2">
            {missing.map((item) => (
              <li key={item.id} className="flex gap-3">
                {/* An empty box: something still to do, ticked by the citizen on the way. */}
                <span
                  aria-hidden
                  className="mt-1 size-4 shrink-0 rounded-xs border-[1.5px] border-warn/60 bg-surface"
                />
                <span dir="auto">
                  {item.title}
                  {item.memberName && <span className="text-ink-2"> ({item.memberName})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-4">
        <li className="flex gap-3">
          <IdCard className="mt-0.5 size-5 shrink-0 text-stamp" aria-hidden />
          <span>{m.done.bring}</span>
        </li>
        {data.office?.citizenNote && (
          <li className="flex gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-stamp" aria-hidden />
            <span>
              <span className="block text-sm text-ink-3">{m.done.officeNote}</span>
              <span lang="it" dir="ltr" className="block">
                {data.office.citizenNote}
              </span>
            </span>
          </li>
        )}
        <li className="grid gap-3">
          <span className="flex gap-3">
            <Copy className="mt-0.5 size-5 shrink-0 text-stamp" aria-hidden />
            <span>{m.done.save}</span>
          </span>
          <div className="ms-8">
            <SaveLinkActions m={m} title={data.reference} />
          </div>
        </li>
      </ul>

      {data.practice?.id === "isee_ordinario" && data.renewalContactConsent !== undefined && (
        <RenewalConsent
          token={token}
          consented={data.renewalContactConsent}
          m={m}
          onSaved={() => void api.reload()}
        />
      )}

      {data.office && (
        <address className="grid gap-2 border-t border-line pt-6 text-ink-2 not-italic">
          <span className="font-semibold text-ink">{data.office.name}</span>
          <span className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <span dir="ltr">{officePlace(data.office)}</span>
          </span>
          {data.office.phone && (
            <a
              href={`tel:${data.office.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-2 hover:text-ink"
            >
              <Phone className="size-4 shrink-0 text-ink-3" aria-hidden />
              <span dir="ltr">{data.office.phone}</span>
            </a>
          )}
          {data.office.openingHours && (
            <span className="text-sm">
              {m.status.hours}: {data.office.openingHours}
            </span>
          )}
        </address>
      )}
    </div>
  );
}

/**
 * The renewal reminder can be turned on or off at any time from here: the consent given in
 * the summary must be as easy to withdraw as it was to give.
 */
function RenewalConsent({
  token,
  consented,
  m,
  onSaved,
}: {
  token: string;
  consented: boolean;
  m: StepProps["m"];
  onSaved: () => void;
}) {
  const [checked, setChecked] = useState(consented);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function change(next: boolean) {
    setChecked(next);
    setState("saving");
    try {
      await apiFetch(`/api/c/${encodeURIComponent(token)}/renewal-consent`, {
        method: "PUT",
        body: { consented: next },
      });
      setState("saved");
      onSaved();
    } catch {
      setChecked(!next);
      setState("failed");
    }
  }

  return (
    <div className="grid gap-1.5">
      <Checkbox
        look="card"
        checked={checked}
        disabled={state === "saving"}
        onChange={(e) => void change(e.currentTarget.checked)}
        label={m.review.renewalConsent}
        hint={m.review.renewalConsentHint}
      />
      <p role="status" className="min-h-5 ps-1 text-sm">
        {state === "saved" && <span className="text-ok">{m.done.renewalSaved}</span>}
        {state === "failed" && <span className="text-danger">{m.errors.generic}</span>}
      </p>
    </div>
  );
}
