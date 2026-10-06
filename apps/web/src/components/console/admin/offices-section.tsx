"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Office, OfficeInput } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useOperator } from "@/lib/console/operator-context";
import { text } from "@/lib/validation";

/** Offices come with the operator profile; after a change the page reloads it. */
export function OfficesSection({ onChanged }: { onChanged: () => void }) {
  const operator = useOperator();
  const [editing, setEditing] = useState<Office | "new" | null>(null);

  return (
    <section aria-labelledby="offices-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="offices-title" className="font-display text-xl font-semibold">
            Sportelli
          </h2>
          <p className="mt-1 text-ink-2">
            Ogni sportello ha il suo link pubblico e il suo cartello con QR.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          Aggiungi sportello
        </Button>
      </div>
      <ul className="mt-4 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
        {operator.offices.map((office) => (
          <li key={office.id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{office.name}</p>
              <p className="truncate text-sm text-ink-3">
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
    };
    const next: typeof errors = {};
    if (input.name.length < 2) next.name = "Scrivi il nome dello sportello.";
    if (input.address.length < 2) next.address = "Scrivi l'indirizzo.";
    if (input.city.length < 2) next.city = "Scrivi la città.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
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
      {formError && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" loading={pending}>
        {office ? "Salva modifiche" : "Crea sportello"}
      </Button>
    </form>
  );
}
