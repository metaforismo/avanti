"use client";

import { useState, type FormEvent } from "react";
import type { MfaRecoveryCodesResponse, MfaSetupResponse } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { QrCode } from "@/components/ui/qr-code";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CodeField, codeError, normalizeCode } from "./code-field";
import { RecoveryCodes } from "./recovery-codes";

type Step =
  | { name: "password" }
  | { name: "scan"; setup: MfaSetupResponse }
  | { name: "codes"; codes: string[] };

const message = (err: unknown, fallback: string) =>
  err instanceof ApiRequestError ? err.message : fallback;

/**
 * Turns on two-step verification: password again (the screen may have been left unlocked), then
 * the authenticator app, then recovery codes that are shown only once.
 */
export function MfaSetupFlow({
  onDone,
  doneLabel,
  onCancel,
}: {
  onDone: () => void;
  doneLabel: string;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<Step>({ name: "password" });
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const currentPassword = String(new FormData(form).get("currentPassword") ?? "");
    setFormError(null);
    if (!currentPassword) {
      setError("Scrivi la tua password.");
      (form.elements.namedItem("currentPassword") as HTMLElement | null)?.focus();
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const setup = await apiFetch<MfaSetupResponse>("/api/auth/mfa/setup/start", {
        method: "POST",
        body: { currentPassword },
      });
      setStep({ name: "scan", setup });
    } catch (err) {
      setFormError(message(err, "Non è stato possibile iniziare. Riprova."));
    } finally {
      setPending(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const code = normalizeCode(String(new FormData(form).get("code") ?? ""), "totp");
    const invalid = codeError(code, "totp");
    setError(invalid);
    setFormError(null);
    if (invalid) {
      (form.elements.namedItem("code") as HTMLElement | null)?.focus();
      return;
    }
    setPending(true);
    try {
      const { recoveryCodes } = await apiFetch<MfaRecoveryCodesResponse>(
        "/api/auth/mfa/setup/confirm",
        { method: "POST", body: { code } },
      );
      setStep({ name: "codes", codes: recoveryCodes });
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError && err.status === 401
          ? "Il codice non corrisponde. Controlla che l'ora del telefono sia automatica e usa il codice che vedi adesso."
          : message(err, "Attivazione non riuscita. Riprova."),
      );
      (form.elements.namedItem("code") as HTMLInputElement | null)?.select();
    } finally {
      setPending(false);
    }
  }

  const alert = formError && (
    <Notice tone="danger" className="animate-fade-in">
      {formError}
    </Notice>
  );

  if (step.name === "password") {
    return (
      <form onSubmit={start} noValidate className="grid max-w-md gap-4">
        <Field
          label="La tua password"
          hint="La chiediamo di nuovo perché questa impostazione protegge l'accesso."
          error={error}
        >
          {(p) => (
            <PasswordInput
              {...p}
              name="currentPassword"
              autoComplete="current-password"
              autoFocus
            />
          )}
        </Field>
        {alert}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending}>
            Continua
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Annulla
            </Button>
          )}
        </div>
      </form>
    );
  }

  if (step.name === "scan") {
    const groups = step.setup.secret.match(/.{4}/g) ?? [step.setup.secret];
    return (
      <form onSubmit={confirm} noValidate className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start md:gap-8">
          <div className="grid justify-items-center md:justify-items-start">
            <QrCode
              value={step.setup.otpauthUri}
              label="Codice QR da inquadrare con l'app di autenticazione"
              className="size-48 overflow-hidden rounded-md ring-1 ring-line [&_svg]:size-full"
            />
          </div>
          <div className="grid gap-3">
            <p>
              <strong>1.</strong> Apri l&apos;app di autenticazione sul telefono (per esempio Google
              Authenticator, Microsoft Authenticator o Aegis) e inquadra il codice QR.
            </p>
            <details className="text-sm text-ink-2">
              <summary className="cursor-pointer text-stamp">Non puoi inquadrarlo?</summary>
              <p className="mt-2">Nell&apos;app scegli «Inserisci una chiave» e scrivi:</p>
              <p
                translate="no"
                className="font-code mt-2 w-fit rounded-sm bg-sunk px-3 py-2 text-base tracking-wider text-ink select-all"
              >
                {groups.join(" ")}
              </p>
              <p className="mt-2">Tipo: basato sul tempo. Nome account: la tua email.</p>
            </details>
            <p>
              <strong>2.</strong> Scrivi qui il codice di 6 cifre che compare nell&apos;app.
            </p>
            <div className="max-w-xs">
              <CodeField kind="totp" error={error} autoFocus label="Codice dell'app" />
            </div>
          </div>
        </div>
        {alert}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending}>
            Attiva
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Annulla
            </Button>
          )}
        </div>
      </form>
    );
  }

  return <RecoveryCodes codes={step.codes} doneLabel={doneLabel} onDone={onDone} />;
}
