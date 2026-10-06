"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import type { MemberInput, MemberRole } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { CitizenMessages, Widen } from "@/lib/citizen/messages";
import { cn } from "@/lib/cn";

const ROLES: MemberRole[] = ["coniuge", "figlio", "genitore", "altro"];
const MAX_MEMBERS = 20;
const ADD_BUTTON_ID = "members-add";

type Draft = {
  key: string;
  /** Server id of an existing member, sent back so documents stay with the right person. */
  id?: string;
  role: MemberRole;
  firstName: string;
  lastName?: string;
  /** Raw text, validated on submit: a half-typed year must not silently become "no year". */
  yearText: string;
};

type RowErrors = { name?: string; year?: string };

const newKey = () => Math.random().toString(36).slice(2);

function toDraft(member: MemberInput): Draft {
  return {
    key: newKey(),
    id: member.id,
    role: member.role,
    firstName: member.firstName,
    lastName: member.lastName,
    yearText: member.birthYear ? String(member.birthYear) : "",
  };
}

function validYear(text: string, currentYear: number) {
  if (!/^\d{4}$/.test(text)) return null;
  const year = Number(text);
  return year >= 1900 && year <= currentYear ? year : null;
}

export function MembersEditor({
  m,
  busy,
  initial,
  expected,
  expectedRoles = [],
  onSubmit,
}: {
  m: Widen<CitizenMessages>;
  busy: boolean;
  initial: MemberInput[];
  expected?: number;
  expectedRoles?: MemberRole[];
  onSubmit: (members: MemberInput[]) => void;
}) {
  const [members, setMembers] = useState<Draft[]>(() => {
    const list = initial.map(toDraft);
    // The applicant is always part of the household, first.
    if (!list.some((member) => member.role === "richiedente")) {
      list.unshift({ key: newKey(), role: "richiedente", firstName: "", yearText: "" });
    }
    // Relatives the citizen already mentioned get a row with the right role…
    if (initial.length === 0) {
      for (const role of expectedRoles.filter((r) => r !== "richiedente")) {
        if (list.length < MAX_MEMBERS)
          list.push({ key: newKey(), role, firstName: "", yearText: "" });
      }
    }
    // …and the household size they stated decides how many rows to offer.
    while (expected && list.length < Math.min(expected, MAX_MEMBERS)) {
      list.push({ key: newKey(), role: "altro", firstName: "", yearText: "" });
    }
    return list;
  });
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const currentYear = new Date().getFullYear();

  const update = (key: string, patch: Partial<Draft>) => {
    setErrors(({ [key]: _cleared, ...rest }) => rest);
    setMembers((list) =>
      list.map((member) => (member.key === key ? { ...member, ...patch } : member)),
    );
  };

  const remove = (key: string) => {
    setMembers((list) => list.filter((item) => item.key !== key));
    // The removed row took focus with it: hand it to a stable control.
    requestAnimationFrame(() => document.getElementById(ADD_BUTTON_ID)?.focus());
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nextErrors: Record<string, RowErrors> = {};
    for (const member of members) {
      const rowErrors: RowErrors = {};
      if (!member.firstName.trim()) rowErrors.name = m.review.fieldRequired;
      if (member.yearText && validYear(member.yearText, currentYear) === null) {
        rowErrors.year = m.members.birthYearInvalid;
      }
      if (rowErrors.name || rowErrors.year) nextErrors[member.key] = rowErrors;
    }
    setErrors(nextErrors);
    const [firstKey, firstErrors] = Object.entries(nextErrors)[0] ?? [];
    if (firstKey && firstErrors) {
      const target = firstErrors.name ? `member-${firstKey}` : `member-${firstKey}-year`;
      document.getElementById(target)?.focus();
      return;
    }
    onSubmit(
      members.map((member) => ({
        ...(member.id ? { id: member.id } : {}),
        role: member.role,
        firstName: member.firstName.trim(),
        lastName: member.lastName?.trim() || undefined,
        birthYear: validYear(member.yearText, currentYear) ?? undefined,
      })),
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      <ul className="grid gap-3">
        {members.map((member) => (
          <MemberRow
            key={member.key}
            member={member}
            m={m}
            errors={errors[member.key]}
            onChange={(patch) => update(member.key, patch)}
            onRemove={member.role === "richiedente" ? undefined : () => remove(member.key)}
          />
        ))}
      </ul>
      {members.length < MAX_MEMBERS && (
        <Button
          id={ADD_BUTTON_ID}
          type="button"
          variant="secondary"
          size="lg"
          className="w-full border-dashed"
          onClick={() => {
            const key = newKey();
            setMembers((list) => [...list, { key, role: "figlio", firstName: "", yearText: "" }]);
            requestAnimationFrame(() => document.getElementById(`member-${key}`)?.focus());
          }}
        >
          <UserPlus className="size-5" aria-hidden />
          {m.members.add}
        </Button>
      )}
      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
        {m.members.confirm}
      </Button>
    </form>
  );
}

function MemberRow({
  member,
  m,
  errors,
  onChange,
  onRemove,
}: {
  member: Draft;
  m: Widen<CitizenMessages>;
  errors: RowErrors | undefined;
  onChange: (patch: Partial<Draft>) => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const isApplicant = member.role === "richiedente";
  const nameErrorId = `${id}-name-error`;
  const yearErrorId = `${id}-year-error`;

  return (
    <li className="animate-rise rounded-md bg-paper p-4 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">
          {isApplicant ? m.members.roles.richiedente : m.members.role}
        </p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="-m-2 grid size-11 place-items-center rounded-sm text-ink-3 hover:bg-danger-wash hover:text-danger"
            aria-label={
              member.firstName.trim()
                ? `${m.common.remove}: ${member.firstName.trim()}`
                : m.members.removeUnnamed
            }
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {!isApplicant && (
        <fieldset className="mt-2">
          <legend className="sr-only">{m.members.role}</legend>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((role) => (
              <label
                key={role}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center rounded-full px-3.5 text-sm ring-1 ring-line-strong ring-inset",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp",
                  member.role === role
                    ? "bg-ink font-semibold text-white ring-ink"
                    : "bg-surface hover:bg-sunk",
                )}
              >
                <input
                  type="radio"
                  name={`role-${member.key}`}
                  value={role}
                  checked={member.role === role}
                  onChange={() => onChange({ role })}
                  className="sr-only"
                />
                {m.members.roles[role]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-3 grid grid-cols-[1fr_7.5rem] gap-2">
        <div className="grid gap-1">
          <label htmlFor={`member-${member.key}`} className="text-sm text-ink-2">
            {m.members.firstName}
          </label>
          <Input
            id={`member-${member.key}`}
            value={member.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            autoComplete={isApplicant ? "given-name" : "off"}
            aria-invalid={errors?.name ? true : undefined}
            aria-describedby={errors?.name ? nameErrorId : undefined}
            maxLength={80}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`member-${member.key}-year`} className="text-sm text-ink-2">
            {m.members.birthYear}
          </label>
          <Input
            id={`member-${member.key}-year`}
            value={member.yearText}
            onChange={(e) => onChange({ yearText: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            inputMode="numeric"
            autoComplete="off"
            placeholder={m.members.birthYearPlaceholder}
            aria-invalid={errors?.year ? true : undefined}
            aria-describedby={errors?.year ? yearErrorId : undefined}
            className="tabular"
          />
        </div>
      </div>
      {errors?.name && (
        <p id={nameErrorId} role="alert" className="mt-2 text-sm font-medium text-danger">
          {errors.name}
        </p>
      )}
      {errors?.year && (
        <p id={yearErrorId} role="alert" className="mt-2 text-sm font-medium text-danger">
          {errors.year}
        </p>
      )}
    </li>
  );
}
