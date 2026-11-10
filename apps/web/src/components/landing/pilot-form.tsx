"use client";

import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PilotLeadRequest } from "@avanti/contracts";
import { isEmail, text } from "@/lib/validation";
import { Stamp } from "@/components/brand/desk-objects";
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
  email: "Controlla l’indirizzo email, per esempio nome@caf.it.",
  offices: "Indica un numero di sportelli tra 1 e 5000.",
  privacyAccepted: "Serve il consenso per poterti ricontattare.",
};

/** What happens after sending: no promised response time, there is no on-call rota yet. */
const NEXT_STEPS = [
  "Leggiamo la richiesta",
  "Vi scriviamo per fissare mezz’ora",
  "Demo su una famiglia inventata e prova nel vostro gestionale",
] as const;

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
    // The details open only for an error that is inside them: a send with the main fields
    // empty must not make the form grow by itself under the pointer.
    if (DETAIL_FIELDS.some((name) => next[name]) && detailsRef.current) {
      detailsRef.current.open = true;
    }
    // Focus without the browser's own scroll (it would leave the field at the screen's edge),
    // then bring the field to the middle of the screen.
    for (const element of Array.from(form.elements)) {
      const name = element.getAttribute("name");
      if (!name || !next[name]) continue;
      const field = element as HTMLElement;
      field.focus({ preventScroll: true });
      field.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      break;
    }
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
        className="relative animate-rise self-start overflow-hidden rounded-xl bg-surface p-6 shadow-raised ring-1 ring-line sm:p-8"
      >
        <Stamp
          tone="ok"
          pressed
          className="absolute end-6 top-6 text-sm [--stamp-rotate:-8deg] sm:end-8 sm:top-8"
        >
          Ricevuta
        </Stamp>
        <CheckCircle2 className="size-8 text-ok" aria-hidden />
        <h3
          ref={doneRef}
          tabIndex={-1}
          className="mt-4 font-display text-2xl font-semibold outline-none"
        >
          Richiesta ricevuta, grazie
        </h3>
        <p className="mt-2 max-w-md leading-relaxed text-ink-2">
          Vi scriviamo a <strong className="font-semibold break-all text-ink">{sentTo}</strong> per
          fissare una chiamata di mezz’ora, con voi e se possibile con un operatore. Vi mostriamo
          una pratica di prova dall’inizio alla fine e capiamo insieme se il pilota fa per il vostro
          sportello.
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
        <p className="mt-1 text-ink-2">Bastano nome, CAF ed email. Vi ricontattiamo noi.</p>
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
              Acconsento a essere ricontattato per il programma pilota, come descritto nell’
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
          <p
            id="privacy-error"
            role="alert"
            className="flex items-center gap-1.5 text-sm font-medium text-danger"
          >
            <AlertCircle className="size-3.5 shrink-0" aria-hidden />
            {errors.privacyAccepted}
          </p>
        )}
      </div>

      {formError && <Notice tone="danger">{formError}</Notice>}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          size="lg"
          loading={status === "sending"}
          className="group w-full sm:w-auto"
        >
          Parliamo del pilota
          <ArrowRight
            className="rtl-flip size-4.5 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
            aria-hidden
          />
        </Button>
        <p className="text-sm text-ink-3">Prima ci parliamo: non vi impegna a nulla.</p>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm font-semibold text-ink">Cosa succede dopo</p>
        <ol className="mt-3 grid gap-2 text-sm text-ink-2 sm:grid-cols-3 sm:gap-4">
          {NEXT_STEPS.map((step, i) => (
            <li key={step} className="flex gap-2.5 sm:block">
              <span
                aria-hidden
                className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-stamp-wash font-mono text-xs font-bold text-stamp sm:mb-2"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </Form>
  );
}
