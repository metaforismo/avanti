"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isEmail, text } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { safeNext } from "@/lib/console/safe-next";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("motivo") === "sessione" ? "La sessione è scaduta. Accedi di nuovo." : null,
  );
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = text(data.get("email")).toLowerCase();
    const password = typeof data.get("password") === "string" ? String(data.get("password")) : "";
    const next: typeof fieldErrors = {};
    if (!isEmail(email)) next.email = "Scrivi un'email valida.";
    if (!password) next.password = "Scrivi la password.";
    if (next.email || next.password) {
      setFieldErrors(next);
      setError(null);
      (form.elements.namedItem(next.email ? "email" : "password") as HTMLElement | null)?.focus();
      return;
    }
    setFieldErrors({});
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiRequestError ? err.message : "Accesso non riuscito. Riprova.");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
      <Field label="Email" error={fieldErrors.email}>
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            spellCheck={false}
            autoCapitalize="none"
            required
            autoFocus
          />
        )}
      </Field>
      <Field label="Password" error={fieldErrors.password}>
        {(p) => (
          <Input {...p} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>
      {error && (
        <p
          role="alert"
          className="animate-fade-in rounded-md bg-danger-wash px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Accedi
      </Button>
      <p className="text-sm text-ink-3">
        Password dimenticata? Chiedi al responsabile del tuo CAF di reimpostarla.
      </p>
    </form>
  );
}
