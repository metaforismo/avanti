"use client";

import {
  CalendarCheck,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileWarning,
  IdCard,
  Info,
  MapPin,
  Phone,
  type LucideIcon,
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
import { rise } from "./motion";

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-[0.75rem] bg-stamp-wash text-stamp">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

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
    <div className="grid gap-7 pt-4">
      <div className="grid justify-items-center text-center">
        {/* The mark lands, then a ring leaves it once: the moment the practice is really sent. */}
        <span className="cz-pop cz-ring grid size-20 place-items-center rounded-full bg-ok text-white shadow-[0_14px_30px_-14px_var(--ok)] [--cz-ring-color:var(--ok)]">
          <Check className="size-10" strokeWidth={2.75} aria-hidden />
        </span>
        <h1
          id={STEP_TITLE_ID}
          tabIndex={-1}
          {...rise(
            1,
            "mt-6 font-display text-[clamp(1.75rem,9vw,2.125rem)] leading-[1.05] font-bold tracking-[-0.028em] outline-none",
          )}
        >
          {m.done.title}
        </h1>
        <p {...rise(2, "mt-3 max-w-sm text-lg text-ink-2")}>{m.done.lead}</p>
        {statusLine && (
          <Notice tone="info" size="md" title={statusLine} className="mt-4 w-full text-start" />
        )}
      </div>

      {/* The reference as the paper ticket taken at the desk: what the citizen shows there. Two
          halves cut by a perforation, like a wallet pass. */}
      <dl
        className={cn(
          "cz-ticket relative overflow-hidden rounded-[1.25rem] bg-stamp text-on-stamp shadow-[0_22px_40px_-22px_var(--stamp)]",
        )}
      >
        <div className="px-6 pt-5 pb-5">
          <dt className="text-xs font-semibold tracking-[0.12em] uppercase opacity-80">
            {m.done.reference}
          </dt>
          <dd
            className="tabular mt-2 font-mono text-[1.75rem] leading-none font-semibold tracking-wide rtl:text-right"
            dir="ltr"
            translate="no"
          >
            {data.reference}
          </dd>
        </div>
        <div
          aria-hidden
          className={cn(
            "relative border-t-2 border-dashed border-on-stamp/30",
            // The two half-moon notches of a tear-off ticket, cut by the paper behind it.
            "before:absolute before:-start-3 before:-top-3.5 before:size-6 before:rounded-full before:bg-paper",
            "after:absolute after:-end-3 after:-top-3.5 after:size-6 after:rounded-full after:bg-paper",
          )}
        />
        <div className="flex items-center gap-4 px-6 py-4">
          <dd className="min-w-0 flex-1 truncate font-semibold">{data.practice?.name ?? ""}</dd>
          <svg viewBox="11 9 9.5 14" aria-hidden className="rtl-flip h-7 w-5 shrink-0">
            <path
              d={CHEVRON_PATH}
              fill="none"
              stroke="var(--marker)"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </dl>

      {data.office?.bookingUrl && (
        <div {...rise(4, "grid gap-2")}>
          <Button asChild size="lg" className="min-h-14 rounded-xl text-[1.0625rem]">
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
        <section
          aria-labelledby="bring-title"
          {...rise(5, "rounded-xl bg-warn-wash/70 p-5 ring-1 ring-warn/15")}
        >
          <h2 id="bring-title" className="flex items-start gap-2.5 font-semibold">
            <FileWarning className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
            {m.done.bringMissing}
          </h2>
          <ul className="mt-4 grid gap-3">
            {missing.map((item) => (
              <li key={item.id} className="flex gap-3">
                {/* An empty box: something still to do, ticked by the citizen on the way. */}
                <span
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 rounded-md border-[1.5px] border-warn/60 bg-surface"
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

      <ul
        {...rise(
          6,
          "divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-raised ring-1 ring-line",
        )}
      >
        <li className="flex gap-3.5 p-4">
          <IconTile icon={IdCard} />
          <span className="pt-1.5">{m.done.bring}</span>
        </li>
        {data.office?.citizenNote && (
          <li className="flex gap-3.5 p-4">
            <IconTile icon={Info} />
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm text-ink-3">{m.done.officeNote}</span>
              <span lang="it" dir="ltr" className="block">
                {data.office.citizenNote}
              </span>
            </span>
          </li>
        )}
        <li className="grid gap-3 p-4">
          <span className="flex gap-3.5">
            <IconTile icon={Copy} />
            <span className="pt-1.5">{m.done.save}</span>
          </span>
          <div className="ms-[3.25rem]">
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
        <address {...rise(6, "grid gap-1 rounded-xl bg-sunk/70 p-2 text-ink-2 not-italic")}>
          <span className="px-2 pt-2 font-semibold text-ink">{data.office.name}</span>
          <span className="flex items-center gap-3 px-2 py-2">
            <MapPin className="size-5 shrink-0 text-ink-3" aria-hidden />
            <span dir="ltr">{officePlace(data.office)}</span>
          </span>
          {data.office.phone && (
            <a
              href={`tel:${data.office.phone.replace(/\s+/g, "")}`}
              className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:text-ink active:bg-sunk"
            >
              <Phone className="size-5 shrink-0 text-ink-3" aria-hidden />
              <span dir="ltr">{data.office.phone}</span>
            </a>
          )}
          {data.office.openingHours && (
            <span className="flex items-center gap-3 px-2 py-2 text-sm">
              <Clock className="size-5 shrink-0 text-ink-3" aria-hidden />
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
