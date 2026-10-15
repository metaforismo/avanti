"use client";

import { AlertTriangle, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Textarea } from "@/components/ui/field";
import { format } from "@/lib/citizen/messages";
import { DONE_STATUSES, STEP_TITLE_ID } from "@/lib/citizen/view";
import { isEmail } from "@/lib/validation";
import { ActionErrorNotice } from "./action-error";
import type { ContactDraft, StepProps } from "./citizen-app";

type Errors = Partial<Record<"firstName" | "lastName" | "contact" | "email" | "confirmed", string>>;

const MAX_SHOWN = 6;
// Folding the list must save real space: "show all" for one or two hidden items is just a click.
const FOLD_AFTER = MAX_SHOWN + 2;

export function ReviewStep({ api, data, m, goTo, draft, setDraft }: StepProps) {
  const [errors, setErrors] = useState<Errors>({});
  const [showAllMissing, setShowAllMissing] = useState(false);
  const missing = data.checklist.filter((item) => item.required && !DONE_STATUSES.has(item.status));
  const folded = !showAllMissing && missing.length > FOLD_AFTER;
  const shownMissing = folded ? missing.slice(0, MAX_SHOWN) : missing;

  // Typed values live in the parent: going back to edit answers must not erase them.
  const values: Required<Omit<ContactDraft, "phone" | "email">> &
    Pick<ContactDraft, "phone" | "email"> = {
    firstName:
      draft.firstName ??
      data.contact?.firstName ??
      data.household.find((member) => member.role === "richiedente")?.firstName ??
      "",
    lastName: draft.lastName ?? data.contact?.lastName ?? "",
    phone: draft.phone ?? data.contact?.phone ?? "",
    email: draft.email ?? data.contact?.email ?? "",
    note: draft.note ?? "",
  };
  const field = (name: keyof ContactDraft) => ({
    name,
    value: values[name] ?? "",
    onChange: (event: { target: { value: string } }) =>
      setDraft({ ...draft, [name]: event.target.value }),
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (api.pending === "submit") return;
    const form = new FormData(event.currentTarget);
    const raw = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
    };

    const next: Errors = {};
    if (!raw.firstName) next.firstName = m.review.fieldRequired;
    if (!raw.lastName) next.lastName = m.review.fieldRequired;
    if (!raw.phone && !raw.email) next.contact = m.review.contactRequired;
    if (raw.email && !isEmail(raw.email)) next.email = m.review.emailInvalid;
    if (form.get("confirmed") !== "on") next.confirmed = m.review.confirmRequired;
    setErrors(next);

    const first = Object.keys(next)[0];
    if (first) {
      const target = first === "contact" ? "phone" : first;
      (event.currentTarget.elements.namedItem(target) as HTMLElement | null)?.focus();
      return;
    }
    await api.submit({ contact: raw, confirmed: true, note: values.note.trim() || undefined });
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1
          id={STEP_TITLE_ID}
          tabIndex={-1}
          className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.025em] outline-none"
        >
          {m.review.title}
        </h1>
        <p className="mt-2 text-lg text-ink-2">{m.review.lead}</p>
      </div>

      <ul className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
        <SummaryRow
          label={m.review.practice}
          value={data.practice?.name ?? "—"}
          onEdit={() => goTo("interview")}
          editLabel={m.review.editAnswers}
        />
        {data.household.length > 0 && (
          <SummaryRow
            label={m.review.household}
            value={data.household.map((member) => member.firstName).join(", ")}
            onEdit={() => goTo("interview")}
            editLabel={m.review.editAnswers}
          />
        )}
        <SummaryRow
          label={m.review.documents}
          value={format(m.docs.progress, {
            done: data.progress.documentsDone,
            total: data.progress.documentsRequired,
          })}
          onEdit={() => goTo("documents")}
          editLabel={m.review.editDocuments}
        />
      </ul>

      {missing.length > 0 && (
        <section className="rounded-lg bg-warn-wash p-4">
          <h2 className="flex items-center gap-2 font-semibold text-warn">
            <AlertTriangle className="size-5" aria-hidden />
            {m.review.missingList}
          </h2>
          <ul className="mt-2 grid gap-1.5 text-ink">
            {shownMissing.map((item) => (
              <li key={item.id} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>
                  {item.title}
                  {item.memberName && <span className="text-ink-2"> ({item.memberName})</span>}
                </span>
              </li>
            ))}
            {folded && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAllMissing(true)}
                  className="min-h-11 rounded-sm font-semibold text-warn underline underline-offset-2"
                >
                  {format(m.review.showAll, { n: missing.length })}
                </button>
              </li>
            )}
          </ul>
          <p className="mt-3 text-sm text-ink-2">{format(m.docs.missing, { n: missing.length })}</p>
        </section>
      )}

      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <fieldset className="grid gap-4">
          <legend className="font-display text-xl font-semibold">{m.review.contact}</legend>
          <p className="mt-1 text-ink-2">{m.review.contactHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={m.review.firstName} error={errors.firstName}>
              {(p) => <Input {...p} {...field("firstName")} autoComplete="given-name" />}
            </Field>
            <Field label={m.review.lastName} error={errors.lastName}>
              {(p) => <Input {...p} {...field("lastName")} autoComplete="family-name" />}
            </Field>
          </div>
          <Field label={m.review.phone} error={errors.contact}>
            {(p) => (
              <Input
                {...p}
                {...field("phone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
              />
            )}
          </Field>
          <Field label={m.review.email} error={errors.email}>
            {(p) => (
              <Input
                {...p}
                {...field("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                autoCapitalize="none"
                dir="ltr"
              />
            )}
          </Field>
          <Field label={m.review.note} optional={m.common.optional}>
            {(p) => <Textarea {...p} {...field("note")} rows={3} maxLength={1000} />}
          </Field>
        </fieldset>

        <div className="grid gap-1.5">
          <Checkbox
            look="card"
            name="confirmed"
            label={format(m.review.confirm, { org: data.organization.name })}
            aria-invalid={errors.confirmed ? true : undefined}
            aria-describedby={errors.confirmed ? "confirm-error" : undefined}
            onChange={() => errors.confirmed && setErrors((e) => ({ ...e, confirmed: undefined }))}
          />
          {errors.confirmed && (
            <p id="confirm-error" role="alert" className="text-sm font-medium text-danger">
              {errors.confirmed}
            </p>
          )}
        </div>

        <ActionErrorNotice error={api.actionError} m={m} onDismiss={api.clearActionError} />

        <Button type="submit" size="lg" loading={api.pending === "submit"} className="w-full">
          {data.status === "needs_citizen" ? m.request.resend : m.review.submit}
        </Button>
      </form>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-3">{label}</p>
        <p className="mt-0.5 font-semibold">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="-me-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-stamp hover:bg-stamp-wash"
        aria-label={`${editLabel}: ${label}`}
      >
        <Pencil className="size-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only">{editLabel}</span>
      </button>
    </li>
  );
}
