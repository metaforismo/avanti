"use client";

import {
  CalendarCheck,
  Check,
  Copy,
  ExternalLink,
  IdCard,
  Info,
  MapPin,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { STEP_TITLE_ID } from "@/lib/citizen/view";
import type { StepProps } from "./citizen-app";
import { SaveLinkActions } from "./save-link";

export function DoneStep({ data, m }: StepProps) {
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
        {statusLine && (
          <p className="mt-3 rounded-md bg-stamp-wash px-4 py-3 font-semibold text-stamp">
            {statusLine}
          </p>
        )}
      </div>

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

      {data.office && (
        <address className="grid gap-2 border-t border-line pt-6 text-ink-2 not-italic">
          <span className="font-semibold text-ink">{data.office.name}</span>
          <span className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <span dir="ltr">
              {data.office.address}, {data.office.city}
            </span>
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
