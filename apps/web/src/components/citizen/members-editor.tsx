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

type Draft = MemberInput & { key: string };

const newKey = () => Math.random().toString(36).slice(2);

export function MembersEditor({
  m,
  busy,
  initial,
  onSubmit,
}: {
  m: Widen<CitizenMessages>;
  busy: boolean;
  initial: MemberInput[];
  onSubmit: (members: MemberInput[]) => void;
}) {
  const [members, setMembers] = useState<Draft[]>(() => {
    const list = initial.map((member) => ({ ...member, key: newKey() }));
    // The applicant is always part of the household, first.
    if (!list.some((member) => member.role === "richiedente")) {
      list.unshift({ role: "richiedente", firstName: "", key: newKey() });
    }
    return list;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const currentYear = new Date().getFullYear();

  const update = (key: string, patch: Partial<MemberInput>) => {
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
    setMembers((list) =>
      list.map((member) => (member.key === key ? { ...member, ...patch } : member)),
    );
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const member of members) {
      if (!member.firstName.trim()) nextErrors[member.key] = m.review.fieldRequired;
    }
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`member-${firstInvalid}`)?.focus();
      return;
    }
    onSubmit(
      members.map(({ key: _key, ...member }) => ({
        ...member,
        firstName: member.firstName.trim(),
        lastName: member.lastName?.trim() || undefined,
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
            error={errors[member.key]}
            currentYear={currentYear}
            onChange={(patch) => update(member.key, patch)}
            onRemove={
              member.role === "richiedente"
                ? undefined
                : () => setMembers((list) => list.filter((item) => item.key !== member.key))
            }
          />
        ))}
      </ul>
      {members.length < MAX_MEMBERS && (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full border-dashed"
          onClick={() => {
            const key = newKey();
            setMembers((list) => [...list, { role: "figlio", firstName: "", key }]);
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
  error,
  currentYear,
  onChange,
  onRemove,
}: {
  member: Draft;
  m: Widen<CitizenMessages>;
  error: string | undefined;
  currentYear: number;
  onChange: (patch: Partial<MemberInput>) => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const [yearText, setYearText] = useState(member.birthYear ? String(member.birthYear) : "");
  const isApplicant = member.role === "richiedente";
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
            className="-m-2 rounded-sm p-2 text-ink-3 hover:bg-danger-wash hover:text-danger"
            aria-label={`${m.common.remove} ${member.firstName}`.trim()}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {!isApplicant && (
        <div role="radiogroup" aria-label={m.members.role} className="mt-2 flex flex-wrap gap-1.5">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={member.role === role}
              onClick={() => onChange({ role })}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm ring-1 ring-line-strong ring-inset",
                member.role === role
                  ? "bg-ink font-semibold text-white ring-ink"
                  : "bg-surface hover:bg-sunk",
              )}
            >
              {m.members.roles[role]}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-[1fr_7rem] gap-2">
        <div className="grid gap-1">
          <label htmlFor={`member-${member.key}`} className="text-sm text-ink-2">
            {m.members.firstName}
          </label>
          <Input
            id={`member-${member.key}`}
            value={member.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            autoComplete={isApplicant ? "given-name" : "off"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            maxLength={80}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-year`} className="text-sm text-ink-2">
            {m.members.birthYear}
          </label>
          <Input
            id={`${id}-year`}
            value={yearText}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
              const year = Number(digits);
              setYearText(digits);
              onChange({
                birthYear:
                  digits.length === 4 && year >= 1900 && year <= currentYear ? year : undefined,
              });
            }}
            inputMode="numeric"
            placeholder={m.common.optional}
            className="tabular"
          />
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
