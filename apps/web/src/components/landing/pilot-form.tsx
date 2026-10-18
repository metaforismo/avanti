"use client";

import { CheckCircle2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PilotLeadRequest } from "@avanti/contracts";
import { focusFirstError, isEmail, text } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";

type Errors = Partial<Record<string, string>>;

const FIELD_MESSAGES: Record<string, string> = {
  name: "Scrivi nome e cognome.",
  organization: "Scrivi il nome del CAF o del patronato.",
  email: "Controlla l'indirizzo email, per esempio nome@caf.it.",
  offices: "Indica un numero di sportelli tra 1 e 5000.",
  privacyAccepted: "Serve il consenso per poterti ricontattare.",
};

/** Optional details, folded away so the form reads as four fields. */
const DETAIL_FIELDS = ["role", "offices", "message"];

export function PilotForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // The form is replaced by the confirmation: move focus there, or it falls back to <body>.
  useEffect(() => {
    if (status === "sent") doneRef.current?.focus();
  }, [status]);

  function showErrors(form: HTMLFormElement, next: Errors) {
    setErrors(next);
    // A field with an error must be visible before it can take focus.
    if (DETAIL_FIELDS.some((name) => next[name]) && detailsRef.current) {
      detailsRef.current.open = true;
    }
    focusFirstError(form, next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
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
      setFormError(null);
      showErrors(form, next);
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus("sending");
    try {
      await apiFetch("/api/leads", { method: "POST", body: lead });
      setSentTo(lead.email);
      setStatus("sent");
    } catch (error) {
      setStatus("idle");
      if (error instanceof ApiRequestError && error.fields) showErrors(form, error.fields);
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
        className="animate-rise self-start rounded-xl bg-surface p-6 shadow-raised ring-1 ring-line sm:p-8"
      >
        <CheckCircle2 className="size-8 text-ok" aria-hidden />
        <h3
          ref={doneRef}
          tabIndex={-1}
          className="mt-4 font-display text-2xl font-semibold outline-none"
        >
          Richiesta ricevuta, grazie
        </h3>
        <p className="mt-2 max-w-md leading-relaxed text-ink-2">
          Ti scriviamo a <strong className="font-semibold break-all text-ink">{sentTo}</strong> per
          fissare una chiamata di mezz&apos;ora, con te e se possibile con un operatore. Ti
          mostriamo una pratica di prova dall&apos;inizio alla fine e capiamo insieme se il pilota
          fa per il vostro sportello.
        </p>
        <p className="mt-4 text-ink-2">
          Nel frattempo:{" "}
          <Link href="/sicurezza" className="font-semibold text-stamp underline underline-offset-2">
            come trattiamo i dati
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <Form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="pilot-form-title"
      className="grid content-start gap-5 self-start rounded-xl bg-surface p-6 shadow-raised ring-1 ring-line sm:p-8"
    >
      <div>
        <h3 id="pilot-form-title" className="font-display text-2xl font-semibold">
          Parliamo del pilota
        </h3>
        <p className="mt-1 text-ink-2">
          Bastano nome, CAF ed email. Ti ricontattiamo noi, senza impegno.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome e cognome" error={errors.name}>
          {(p) => <Input {...p} name="name" autoComplete="name" maxLength={120} required />}
        </Field>
        <Field label="CAF o patronato" error={errors.organization}>
          {(p) => (
            <Input
              {...p}
              name="organization"
              autoComplete="organization"
              maxLength={160}
              required
            />
          )}
        </Field>
      </div>
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
              maxLength={200}
              required
            />
          )}
        </Field>
        <Field label="Telefono" optional="facoltativo" error={errors.phone}>
          {(p) => (
            <Input
              {...p}
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={30}
            />
          )}
        </Field>
      </div>

      <details ref={detailsRef} className="group rounded-md ring-1 ring-line">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-4 py-2.5 text-body-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span>
            Aggiungi qualche dettaglio <span className="font-normal text-ink-3">(facoltativo)</span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-(--ease-out) group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="grid gap-5 border-t border-line px-4 pt-4 pb-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
            <Field label="Ruolo" error={errors.role}>
              {(p) => (
                <Input
                  {...p}
                  name="role"
                  placeholder="es. Responsabile di sede…"
                  autoComplete="organization-title"
                  maxLength={120}
                />
              )}
            </Field>
            <Field label="Quanti sportelli?" error={errors.offices}>
              {(p) => <Input {...p} name="offices" type="number" min={1} inputMode="numeric" />}
            </Field>
          </div>
          <Field
            label="Cosa vi fa perdere più tempo oggi?"
            error={errors.message}
            hint="Anche il gestionale che usate. Non inserire nomi o documenti dei cittadini."
          >
            {(p) => <Textarea {...p} name="message" rows={3} maxLength={2000} />}
          </Field>
        </div>
      </details>

      {/* Honeypot for bots: hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -start-[9999px] h-0 overflow-hidden">
        <label>
          Sito web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-1.5">
        <Checkbox
          name="privacyAccepted"
          aria-invalid={errors.privacyAccepted ? true : undefined}
          aria-describedby={errors.privacyAccepted ? "privacy-error" : undefined}
          className="text-sm text-ink-2"
          label={
            <>
              Acconsento a essere ricontattato per il programma pilota, come descritto nell&apos;
              <Link
                href="/privacy"
                className="font-semibold text-stamp underline underline-offset-2"
              >
                informativa privacy
              </Link>
              .
            </>
          }
        />
        {errors.privacyAccepted && (
          <p id="privacy-error" role="alert" className="text-sm font-medium text-danger">
            {errors.privacyAccepted}
          </p>
        )}
      </div>

      {formError && <Notice tone="danger">{formError}</Notice>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={status === "sending"} className="w-full sm:w-auto">
          Candida il tuo sportello
        </Button>
        <p className="text-sm text-ink-3">Prima ci parliamo: candidarsi non impegna a nulla.</p>
      </div>
    </Form>
  );
}
