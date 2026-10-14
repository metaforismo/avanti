"use client";

import { useState, type FormEvent } from "react";
import type { Operator } from "@avanti/contracts";
import { PASSWORD_MIN_LENGTH } from "@avanti/contracts/constants";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";

type Errors = { current?: string; next?: string; repeat?: string };

/** Change one's own password; used on the account page and for forced changes after a reset. */
export function PasswordForm({
  onChanged,
  submitLabel,
}: {
  onChanged: (operator: Operator) => void;
  submitLabel: string;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const repeat = String(data.get("repeat") ?? "");

    const next: Errors = {};
    if (!currentPassword) next.current = "Scrivi la password attuale.";
    if (newPassword.length < PASSWORD_MIN_LENGTH)
      next.next = `Almeno ${PASSWORD_MIN_LENGTH} caratteri.`;
    else if (newPassword === currentPassword) next.next = "Deve essere diversa da quella attuale.";
    if (repeat !== newPassword) next.repeat = "Le due password non coincidono.";
    setErrors(next);
    setFormError(null);
    const first = next.current
      ? "currentPassword"
      : next.next
        ? "newPassword"
        : next.repeat
          ? "repeat"
          : null;
    if (first) {
      (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }

    setPending(true);
    try {
      const operator = await apiFetch<Operator>("/api/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      form.reset();
      onChanged(operator);
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? error.message : "Cambio password non riuscito. Riprova.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
      <Field label="Password attuale" error={errors.current}>
        {(p) => <PasswordInput {...p} name="currentPassword" autoComplete="current-password" />}
      </Field>
      <Field
        label="Nuova password"
        hint={`Almeno ${PASSWORD_MIN_LENGTH} caratteri. Una frase lunga è più sicura e più facile da ricordare.`}
        error={errors.next}
      >
        {(p) => <PasswordInput {...p} name="newPassword" autoComplete="new-password" />}
      </Field>
      <Field label="Ripeti la nuova password" error={errors.repeat}>
        {(p) => <PasswordInput {...p} name="repeat" autoComplete="new-password" />}
      </Field>
      {formError && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-fit">
        {submitLabel}
      </Button>
    </form>
  );
}
