"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { PilotLeadRequest } from "@avanti/contracts";
import { isEmail, text } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";

type Errors = Partial<Record<string, string>>;

const FIELD_MESSAGES: Record<string, string> = {
  name: "Scrivi nome e cognome.",
  organization: "Scrivi il nome del CAF o del patronato.",
  email: "Controlla l'indirizzo email.",
  offices: "Indica un numero di sportelli valido.",
  privacyAccepted: "Serve il consenso per poterti ricontattare.",
};

export function PilotForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const officesText = text(data.get("offices"));
    const offices = officesText ? Number(officesText) : undefined;
    const lead: PilotLeadRequest = {
      name: text(data.get("name")),
      organization: text(data.get("organization")),
      role: text(data.get("role")) || undefined,
      email: text(data.get("email")),
      phone: text(data.get("phone")) || undefined,
      offices,
      message: text(data.get("message")) || undefined,
      privacyAccepted: true,
      website: text(data.get("website")) || undefined,
    };

    const next: Errors = {};
    if (lead.name.length < 2) next.name = FIELD_MESSAGES.name;
    if (lead.organization.length < 2) next.organization = FIELD_MESSAGES.organization;
    if (!isEmail(lead.email)) next.email = FIELD_MESSAGES.email;
    if (offices !== undefined && (!Number.isInteger(offices) || offices < 1 || offices > 5000)) {
      next.offices = FIELD_MESSAGES.offices;
    }
    if (data.get("privacyAccepted") !== "on") next.privacyAccepted = FIELD_MESSAGES.privacyAccepted;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      setFormError(null);
      const first = Object.keys(next)[0];
      if (first) (event.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus("sending");
    try {
      await apiFetch("/api/leads", { method: "POST", body: lead });
      setStatus("sent");
    } catch (error) {
      setStatus("idle");
      if (error instanceof ApiRequestError && error.fields) {
        setErrors(error.fields);
      }
      setFormError(
        error instanceof ApiRequestError
          ? error.message
          : "Invio non riuscito. Controlla la connessione e riprova.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="animate-rise rounded-xl bg-surface p-8 shadow-raised ring-1 ring-line"
      >
        <CheckCircle2 className="size-8 text-ok" aria-hidden />
        <h3 className="mt-4 font-display text-2xl font-semibold">Richiesta ricevuta</h3>
        <p className="mt-2 max-w-md text-ink-2">
          Ti ricontattiamo per fissare una chiamata di mezz’ora e capire se il pilota fa per il tuo
          sportello.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="grid gap-5 rounded-xl bg-surface p-6 shadow-raised ring-1 ring-line sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome e cognome" error={errors.name}>
          {(p) => <Input {...p} name="name" autoComplete="name" required />}
        </Field>
        <Field label="Ruolo" optional="facoltativo">
          {(p) => (
            <Input
              {...p}
              name="role"
              placeholder="es. Responsabile di sede…"
              autoComplete="organization-title"
            />
          )}
        </Field>
      </div>
      <Field label="CAF o patronato" error={errors.organization}>
        {(p) => <Input {...p} name="organization" autoComplete="organization" required />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email di lavoro" error={errors.email}>
          {(p) => (
            <Input
              {...p}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              required
            />
          )}
        </Field>
        <Field label="Telefono" optional="facoltativo">
          {(p) => <Input {...p} name="phone" type="tel" autoComplete="tel" inputMode="tel" />}
        </Field>
      </div>
      <Field
        label="Quanti sportelli?"
        optional="facoltativo"
        error={errors.offices}
        className="sm:max-w-[12rem]"
      >
        {(p) => <Input {...p} name="offices" type="number" min={1} inputMode="numeric" />}
      </Field>
      <Field
        label="Cosa vi fa perdere più tempo oggi?"
        optional="facoltativo"
        hint="Ci aiuta a preparare la prima chiamata. Non inserire nomi o documenti dei cittadini."
      >
        {(p) => <Textarea {...p} name="message" rows={3} maxLength={2000} />}
      </Field>

      {/* Honeypot for bots: hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Sito web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-1.5">
        <label className="flex items-start gap-3 text-sm text-ink-2">
          <input
            type="checkbox"
            name="privacyAccepted"
            aria-invalid={errors.privacyAccepted ? true : undefined}
            aria-describedby={errors.privacyAccepted ? "privacy-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-stamp"
          />
          <span>
            Acconsento a essere ricontattato per il programma pilota, come descritto nell&apos;
            <Link href="/privacy" className="font-semibold text-stamp underline underline-offset-2">
              informativa privacy
            </Link>
            .
          </span>
        </label>
        {errors.privacyAccepted && (
          <p id="privacy-error" role="alert" className="text-sm font-medium text-danger">
            {errors.privacyAccepted}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={status === "sending"}>
          Candida il tuo sportello
        </Button>
        <p className="text-sm text-ink-3">Nessun impegno: prima ci parliamo.</p>
      </div>
    </form>
  );
}
