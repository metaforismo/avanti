"use client";

import { AlertTriangle, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CitizenContact } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { format } from "@/lib/citizen/messages";
import { DONE_STATUSES } from "@/lib/citizen/view";
import { ActionErrorNotice } from "./action-error";
import type { StepProps } from "./citizen-app";

type Errors = Partial<Record<"firstName" | "lastName" | "contact" | "email" | "confirmed", string>>;

export function ReviewStep({ api, data, m, goTo }: StepProps) {
  const [errors, setErrors] = useState<Errors>({});
  const missing = data.checklist.filter((item) => item.required && !DONE_STATUSES.has(item.status));
  const MAX_SHOWN = 8;
  const contact = data.contact;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const raw = {
      firstName: text("firstName"),
      lastName: text("lastName"),
      phone: text("phone") || undefined,
      email: text("email") || undefined,
    };

    const next: Errors = {};
    if (!raw.firstName) next.firstName = m.review.fieldRequired;
    if (!raw.lastName) next.lastName = m.review.fieldRequired;
    if (!raw.phone && !raw.email) next.contact = m.review.contactRequired;
    if (raw.email && !CitizenContact.shape.email.safeParse(raw.email).success)
      next.email = m.review.emailInvalid;
    if (form.get("confirmed") !== "on") next.confirmed = m.review.confirmRequired;
    setErrors(next);

    const first = Object.keys(next)[0];
    if (first) {
      const target = first === "contact" ? "phone" : first;
      (event.currentTarget.elements.namedItem(target) as HTMLElement | null)?.focus();
      return;
    }
    await api.submit({ contact: raw, confirmed: true, note: text("note") || undefined });
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.025em]">
          {m.review.title}
        </h1>
        <p className="mt-2 text-lg text-ink-2">{m.review.lead}</p>
      </div>

      <dl className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
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
      </dl>

      {missing.length > 0 && (
        <section className="rounded-lg bg-warn-wash p-4">
          <h2 className="flex items-center gap-2 font-semibold text-warn">
            <AlertTriangle className="size-5" aria-hidden />
            {m.review.missingList}
          </h2>
          <ul className="mt-2 grid gap-1.5 text-ink">
            {missing.slice(0, MAX_SHOWN).map((item) => (
              <li key={item.id} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>
                  {item.title}
                  {item.memberName && <span className="text-ink-2"> ({item.memberName})</span>}
                </span>
              </li>
            ))}
            {missing.length > MAX_SHOWN && (
              <li className="ps-4 text-ink-2">+ {missing.length - MAX_SHOWN}</li>
            )}
          </ul>
          <p className="mt-3 text-sm text-ink-2">{format(m.docs.missing, { n: missing.length })}</p>
        </section>
      )}

      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <fieldset className="grid gap-4">
          <legend className="font-display text-xl font-semibold">{m.review.contact}</legend>
          <p className="-mt-2 text-ink-2">{m.review.contactHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={m.review.firstName} error={errors.firstName}>
              {(p) => (
                <Input
                  {...p}
                  name="firstName"
                  autoComplete="given-name"
                  defaultValue={
                    contact?.firstName ??
                    data.household.find((h) => h.role === "richiedente")?.firstName ??
                    ""
                  }
                />
              )}
            </Field>
            <Field label={m.review.lastName} error={errors.lastName}>
              {(p) => (
                <Input
                  {...p}
                  name="lastName"
                  autoComplete="family-name"
                  defaultValue={contact?.lastName ?? ""}
                />
              )}
            </Field>
          </div>
          <Field label={m.review.phone} error={errors.contact}>
            {(p) => (
              <Input
                {...p}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                defaultValue={contact?.phone ?? ""}
              />
            )}
          </Field>
          <Field label={m.review.email} error={errors.email}>
            {(p) => (
              <Input
                {...p}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                defaultValue={contact?.email ?? ""}
              />
            )}
          </Field>
          <Field label={m.review.note} optional={m.common.optional}>
            {(p) => <Textarea {...p} name="note" rows={3} maxLength={1000} />}
          </Field>
        </fieldset>

        <div className="grid gap-1.5">
          <label className="flex cursor-pointer items-start gap-3 rounded-md bg-surface p-4 ring-1 ring-line-strong ring-inset has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp">
            <input
              type="checkbox"
              name="confirmed"
              aria-invalid={errors.confirmed ? true : undefined}
              aria-describedby={errors.confirmed ? "confirm-error" : undefined}
              onChange={() =>
                errors.confirmed && setErrors((e) => ({ ...e, confirmed: undefined }))
              }
              className="mt-0.5 size-5 shrink-0 accent-stamp"
            />
            <span>{format(m.review.confirm, { org: data.organization.name })}</span>
          </label>
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
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <dt className="text-sm text-ink-3">{label}</dt>
        <dd className="mt-0.5 font-semibold">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="-me-2 inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm font-semibold text-stamp hover:bg-stamp-wash"
        aria-label={`${editLabel}: ${label}`}
      >
        <Pencil className="size-3.5" aria-hidden />
        <span className="sr-only sm:not-sr-only">{editLabel}</span>
      </button>
    </div>
  );
}
