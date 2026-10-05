"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Route } from "next";
import { LoginRequest } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";

/** Only same-app console paths are allowed as post-login destinations (no open redirect). */
function safeNext(value: string | null): Route {
  if (value && value.startsWith("/console") && !value.startsWith("//")) return value as Route;
  return "/console";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("motivo") === "sessione" ? "La sessione è scaduta. Accedi di nuovo." : null,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = LoginRequest.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      setError("Inserisci email e password.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: parsed.data });
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiRequestError ? err.message : "Accesso non riuscito. Riprova.");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-5">
      <Field label="Email">
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            autoFocus
          />
        )}
      </Field>
      <Field label="Password">
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
