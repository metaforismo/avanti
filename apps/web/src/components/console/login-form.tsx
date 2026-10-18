"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { LoginResponse } from "@avanti/contracts";
import { isEmail, text } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { safeNext } from "@/lib/console/safe-next";
import { clearResourceCache } from "@/lib/console/use-resource";
import { MfaVerifyForm } from "./mfa/verify-form";

/**
 * The page reads `next` and `motivo` on the server and passes them in: reading them here would
 * render the form only after hydration and push the page down as it appears.
 */
export function LoginForm({ nextPath, expired }: { nextPath: string | null; expired: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? "La sessione è scaduta. Accedi di nuovo." : null,
  );
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [challenged, setChallenged] = useState(false);

  const enter = () => {
    clearResourceCache();
    router.replace(safeNext(nextPath));
    router.refresh();
  };

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
      const result = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      if ("mfaRequired" in result) {
        setPending(false);
        setChallenged(true);
        return;
      }
      enter();
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiRequestError ? err.message : "Accesso non riuscito. Riprova.");
    }
  }

  if (challenged) {
    return (
      <div className="mt-8 grid gap-5">
        <p className="text-ink-2">
          Password corretta. Ora apri l&apos;app di autenticazione sul telefono e scrivi il codice
          di Avanti.
        </p>
        <MfaVerifyForm
          onVerified={enter}
          onCancel={() => {
            void apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
            setChallenged(false);
          }}
        />
      </div>
    );
  }

  return (
    <Form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
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
        {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" required />}
      </Field>
      {error && (
        <Notice tone="danger" className="animate-fade-in">
          {error}
        </Notice>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Accedi
      </Button>
      <p className="text-sm text-ink-3">
        Password dimenticata? Chiedi al responsabile del tuo CAF di reimpostarla.
      </p>
    </Form>
  );
}
