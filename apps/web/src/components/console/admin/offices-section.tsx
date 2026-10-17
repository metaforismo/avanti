"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Office, OfficeInput } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useOperator } from "@/lib/console/operator-context";
import { focusFirstError, text } from "@/lib/validation";

/** Offices come with the operator profile; after a change the page reloads it. */
export function OfficesSection({ onChanged }: { onChanged: () => void }) {
  const operator = useOperator();
  const [editing, setEditing] = useState<Office | "new" | null>(null);

  return (
    <section aria-labelledby="offices-title">
      <SectionHeader
        id="offices-title"
        title="Sportelli"
        lead="Ogni sportello ha il suo link pubblico e il suo cartello con QR."
        actions={
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            Aggiungi sportello
          </Button>
        }
      />
      <ul className="mt-4 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
        {operator.offices.map((office) => (
          <li key={office.id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{office.name}</p>
              <p
                className="truncate text-sm text-ink-3"
                title={`${office.address}, ${office.city}${office.phone ? `, ${office.phone}` : ""}`}
              >
                {office.address}, {office.city}
                {office.phone ? `, ${office.phone}` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(office)}
              aria-label={`Modifica ${office.name}`}
            >
              <Pencil className="size-4" aria-hidden />
              Modifica
            </Button>
          </li>
        ))}
      </ul>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Nuovo sportello" : "Modifica sportello"}
        description="Nome, indirizzo e orari compaiono al cittadino all'inizio della pratica e sul cartello."
      >
        {editing !== null && (
          <OfficeForm
            office={editing === "new" ? null : editing}
            onSaved={() => {
              setEditing(null);
              onChanged();
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

function OfficeForm({ office, onSaved }: { office: Office | null; onSaved: () => void }) {
  const { offices } = useOperator();
  // Citizens pick their office by name: two with the same one would be indistinguishable.
  const takenNames = new Set(
    offices
      .filter((other) => other.id !== office?.id)
      .map((other) => other.name.toLocaleLowerCase("it")),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof OfficeInput, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const input: OfficeInput = {
      name: text(data.get("name")),
      address: text(data.get("address")),
      city: text(data.get("city")),
      phone: text(data.get("phone")) || null,
      openingHours: text(data.get("openingHours")) || null,
      bookingUrl: text(data.get("bookingUrl")) || null,
      citizenNote: text(data.get("citizenNote")) || null,
    };
    const next: typeof errors = {};
    if (input.name.length < 2) next.name = "Scrivi il nome dello sportello.";
    else if (takenNames.has(input.name.toLocaleLowerCase("it")))
      next.name = "C'è già uno sportello con questo nome.";
    if (input.address.length < 2) next.address = "Scrivi l'indirizzo.";
    if (input.city.length < 2) next.city = "Scrivi la città.";
    if (input.bookingUrl && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(input.bookingUrl))
      next.bookingUrl = "Incolla l'indirizzo completo, che inizia con https://";
    setErrors(next);
    if (focusFirstError(event.currentTarget, next)) return;
    setPending(true);
    setFormError(null);
    try {
      await apiFetch(office ? `/api/offices/${office.id}` : "/api/offices", {
        method: office ? "PATCH" : "POST",
        body: input,
      });
      onSaved();
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? error.message : "Salvataggio non riuscito. Riprova.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field label="Nome" error={errors.name} hint="Per esempio: Milano Centro">
        {(p) => <Input {...p} name="name" defaultValue={office?.name} autoComplete="off" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Indirizzo" error={errors.address}>
          {(p) => (
            <Input
              {...p}
              name="address"
              defaultValue={office?.address}
              autoComplete="street-address"
            />
          )}
        </Field>
        <Field label="Città" error={errors.city}>
          {(p) => (
            <Input {...p} name="city" defaultValue={office?.city} autoComplete="address-level2" />
          )}
        </Field>
      </div>
      <Field label="Telefono" optional="facoltativo">
        {(p) => (
          <Input
            {...p}
            name="phone"
            type="tel"
            defaultValue={office?.phone ?? ""}
            autoComplete="off"
          />
        )}
      </Field>
      <Field label="Orari" optional="facoltativo" hint="Per esempio: lun–ven 9–13, 14–18">
        {(p) => (
          <Input
            {...p}
            name="openingHours"
            defaultValue={office?.openingHours ?? ""}
            autoComplete="off"
          />
        )}
      </Field>
      <Field
        label="Link per prenotare l'appuntamento"
        optional="facoltativo"
        hint="La pagina del vostro sistema di prenotazione: il cittadino la vede dopo l'invio."
        error={errors.bookingUrl}
      >
        {(p) => (
          <Input
            {...p}
            name="bookingUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={office?.bookingUrl ?? ""}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>
      <Field
        label="Nota per il cittadino"
        optional="facoltativo"
        hint="Breve, in italiano: per esempio «Porta gli originali dei documenti d'identità»."
      >
        {(p) => (
          <Textarea
            {...p}
            name="citizenNote"
            rows={2}
            maxLength={300}
            defaultValue={office?.citizenNote ?? ""}
          />
        )}
      </Field>
      {formError && <Notice tone="danger">{formError}</Notice>}
      <Button type="submit" loading={pending}>
        {office ? "Salva modifiche" : "Crea sportello"}
      </Button>
    </form>
  );
}
