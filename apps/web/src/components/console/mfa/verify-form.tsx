"use client";

import { useState, type FormEvent } from "react";
import type { Operator } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CodeField, codeError, normalizeCode, type CodeKind } from "./code-field";

/** Second step of the login: the password was right, the session waits for a code. */
export function MfaVerifyForm({
  onVerified,
  onCancel,
}: {
  onVerified: (operator: Operator) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<CodeKind>("totp");
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const code = normalizeCode(String(new FormData(form).get("code") ?? ""), kind);
    const invalid = codeError(code, kind);
    setError(invalid);
    setFormError(null);
    if (invalid) {
      (form.elements.namedItem("code") as HTMLElement | null)?.focus();
      return;
    }
    setPending(true);
    try {
      onVerified(
        await apiFetch<Operator>("/api/auth/mfa/verify", { method: "POST", body: { code } }),
      );
    } catch (err) {
      setPending(false);
      // A 401 here means the five minutes after the password are over: start again.
      if (err instanceof ApiRequestError && err.status === 401 && err.code === "unauthorized") {
        setFormError("Codice non valido o tempo scaduto. Riprova; se continua, accedi di nuovo.");
      } else {
        setFormError(
          err instanceof ApiRequestError ? err.message : "Verifica non riuscita. Riprova.",
        );
      }
      const input = form.elements.namedItem("code") as HTMLInputElement | null;
      input?.select();
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <CodeField kind={kind} error={error} autoFocus />
      {formError && (
        <p
          role="alert"
          className="animate-fade-in rounded-md bg-danger-wash px-4 py-3 text-sm text-danger"
        >
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Verifica ed entra
      </Button>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button
          type="button"
          className="text-stamp underline underline-offset-2"
          onClick={() => {
            setKind((k) => (k === "totp" ? "recovery" : "totp"));
            setError(undefined);
            setFormError(null);
          }}
        >
          {kind === "totp"
            ? "Non hai il telefono? Usa un codice di recupero"
            : "Usa il codice dell'app"}
        </button>
        <button
          type="button"
          className="text-ink-2 underline underline-offset-2"
          onClick={onCancel}
        >
          Annulla
        </button>
      </div>
      {kind === "recovery" && (
        <p className="text-sm text-ink-3">
          Hai perso telefono e codici? Il responsabile del tuo CAF può azzerare la verifica.
        </p>
      )}
    </form>
  );
}
