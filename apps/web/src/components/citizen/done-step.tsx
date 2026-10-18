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
import { officePlace } from "@/lib/office-place";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api";
import { Notice } from "@/components/ui/notice";
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
        <span className="grid size-16 animate-pop place-items-center rounded-full bg-ok text-white">
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

      <dl className="rounded-lg bg-surface p-5 ring-1 ring-line">
        <dt className="text-sm text-ink-3">{m.done.reference}</dt>
        <dd
          className="mt-1 font-mono text-2xl font-semibold tracking-wide"
          dir="ltr"
          translate="no"
        >
          {data.reference}
        </dd>
        {data.practice && <dd className="mt-1 text-ink-2">{data.practice.name}</dd>}
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
          <ul className="mt-2 grid gap-1.5">
            {missing.map((item) => (
              <li key={item.id} className="flex gap-2">
                <span aria-hidden>•</span>
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
