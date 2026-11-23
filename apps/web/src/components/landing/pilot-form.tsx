"use client";

import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
      <Coupon>
        <div role="status" className="relative animate-rise">
          <Stamp tone="ok" pressed className="absolute end-0 top-0 text-sm [--stamp-rotate:-8deg]">
            Ricevuta
          </Stamp>
          <CheckCircle2 className="size-8 text-ok" aria-hidden />
          <h3 ref={doneRef} tabIndex={-1} className="t-sub mt-4 max-w-[18ch] outline-none">
            Richiesta ricevuta, grazie
          </h3>
          <p className="t-body mt-3 max-w-md text-ink">
            Vi scriviamo a <strong className="font-semibold break-all">{sentTo}</strong> per fissare
            una chiamata di mezz’ora, con voi e se possibile con un operatore. Vi mostriamo una
            pratica di prova dall’inizio alla fine e capiamo insieme se il pilota fa per il vostro
            sportello.
          </p>
          <p className="t-body mt-4 text-ink">
            Nel frattempo:{" "}
            <Link
              href="/sicurezza"
              className="font-semibold text-stamp underline decoration-[0.07em] underline-offset-[0.2em]"
            >
              come trattiamo i dati
            </Link>
            .
          </p>
        </div>
      </Coupon>
    );
  }

  return (
    <Coupon>
      <Form
        noValidate
        onSubmit={onSubmit}
        aria-labelledby="pilot-form-title"
        className="grid content-start gap-5"
      >
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

        <details ref={detailsRef} className="group rounded-md bg-surface/70">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-4 py-2.5 text-[0.9375rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span>
              Aggiungi qualche dettaglio{" "}
              <span className="font-normal text-ink-2">(facoltativo)</span>
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-ink-2 transition-transform duration-200 ease-(--ease-out) group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="grid gap-5 px-4 pt-2 pb-5">
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
            className="text-[0.9375rem] text-ink"
            label={
              <>
                Acconsento a essere ricontattato per il programma pilota, come descritto nell’
                <Link
                  href="/privacy"
                  className="font-semibold text-stamp underline decoration-[0.07em] underline-offset-[0.2em]"
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

        <div className="grid gap-3">
          <Button
            type="submit"
            size="lg"
            loading={status === "sending"}
            className="ticket-btn group t-body min-h-14 w-full"
          >
            Parliamo del pilota
            <ArrowRight
              className="rtl-flip size-4.5 text-marker transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5"
              aria-hidden
            />
          </Button>
          <p className="text-[0.9375rem] text-ink-2">Prima ci parliamo: non vi impegna a nulla.</p>
        </div>
      </Form>
    </Coupon>
  );
}

/**
 * The form as a slip to tear off: a stamp-blue stub with what happens next, a perforation of
 * dots, the fields on the folder-blue body. Each half carries half of the two notches, so they
 * meet at the perforation whatever the heights (side by side from lg, stacked below).
 */
function Coupon({ children }: { children: ReactNode }) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="coupon-stub relative flex flex-col justify-between gap-10 rounded-t-[14px] bg-stamp p-7 text-on-stamp sm:p-10 lg:rounded-s-[14px] lg:rounded-tr-none lg:p-12">
        <div>
          <h3 id="pilot-form-title" className="t-sub max-w-[12ch] font-bold">
            Parliamo del pilota
          </h3>
          <p className="t-body mt-4 max-w-[30ch]">
            Bastano nome, CAF ed email. Vi ricontattiamo noi.
          </p>
        </div>
        <div>
          <p className="t-body font-semibold">Cosa succede dopo</p>
          <ol className="t-body mt-3 grid gap-2.5">
            {NEXT_STEPS.map((step) => (
              <li key={step} className="flex items-baseline gap-3">
                <span aria-hidden className="ticket-dot translate-y-[0.06em] text-marker" />
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="coupon-body relative rounded-b-[14px] bg-folder p-7 text-ink sm:p-10 lg:rounded-e-[14px] lg:rounded-bl-none lg:p-12">
        <Perforation />
        {children}
      </div>
    </div>
  );
}

/** The dots between stub and body, in the colour of the page under the coupon. */
function Perforation() {
  return (
    <svg
      aria-hidden
      className="absolute inset-x-6 top-0 h-1.5 w-[calc(100%-3rem)] lg:inset-x-auto lg:start-0 lg:top-6 lg:h-[calc(100%-3rem)] lg:w-1.5"
    >
      <line
        x1="3"
        y1="3"
        x2="100%"
        y2="3"
        className="lg:hidden"
        stroke="var(--paper)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="0 13"
      />
      <line
        x1="3"
        y1="3"
        x2="3"
        y2="100%"
        className="max-lg:hidden"
        stroke="var(--paper)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="0 13"
      />
    </svg>
  );
}
