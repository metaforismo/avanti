"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { FamilySearchResponse } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { PRACTICE_SHORT } from "@/lib/console/labels";

const TAX_CODE = /^[A-Z0-9]{16}$/;

/**
 * "Has this family been here before?" A tax code, or full name and date of birth: never a
 * partial match, never another CAF. From the result, the operator opens the old practice and
 * starts the new one from there, carrying over household and documents.
 */
export function FamilySearch({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<FamilySearchResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const taxCode = String(form.get("taxCode") ?? "")
      .trim()
      .toUpperCase();
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const birthDate = String(form.get("birthDate") ?? "").trim();
    const body = taxCode
      ? TAX_CODE.test(taxCode)
        ? { taxCode }
        : null
      : firstName && lastName && birthDate
        ? { firstName, lastName, birthDate }
        : null;
    if (!body) {
      setError("Scrivi un codice fiscale completo, oppure nome, cognome e data di nascita.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setResult(
        await apiFetch<FamilySearchResponse>("/api/cases/families/search", {
          method: "POST",
          body,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Ricerca non riuscita. Riprova.");
    } finally {
      setPending(false);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-stamp underline underline-offset-4"
      >
        <Users className="size-4" aria-hidden />
        Famiglia già seguita? Riparti dai suoi documenti
      </button>
    );

  return (
    <section aria-labelledby="family-title" className="grid gap-3 rounded-lg bg-paper p-4">
      <h3 id="family-title" className="font-semibold">
        Cerca una famiglia già seguita
      </h3>
      <form onSubmit={search} className="grid gap-2">
        <Input
          name="taxCode"
          aria-label="Codice fiscale del richiedente"
          placeholder="Codice fiscale del richiedente"
          autoComplete="off"
          spellCheck={false}
          className="font-code uppercase"
        />
        <p className="text-center text-xs text-ink-3">oppure</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input name="firstName" aria-label="Nome" placeholder="Nome" autoComplete="off" />
          <Input name="lastName" aria-label="Cognome" placeholder="Cognome" autoComplete="off" />
          <Input name="birthDate" type="date" aria-label="Data di nascita" />
        </div>
        <Button type="submit" variant="secondary" loading={pending} className="w-fit">
          <Search className="size-4" aria-hidden />
          Cerca
        </Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      {result && (
        <div aria-live="polite">
          {result.items.length === 0 ? (
            <p className="text-sm text-ink-2">
              Nessuna pratica per questa persona nel vostro CAF: crea una pratica nuova qui sotto.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-md bg-surface ring-1 ring-line">
              {result.items.map((item) => (
                <li key={item.caseId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">
                      {item.applicant.firstName} {item.applicant.lastName}
                    </span>
                    <span className="block text-sm text-ink-3">
                      {item.practiceId ? PRACTICE_SHORT[item.practiceId] : "Pratica"}{" "}
                      {item.practiceYear} · <span className="font-code">{item.reference}</span>
                    </span>
                  </span>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/console/pratiche/${item.caseId}`} onClick={onOpen}>
                      Apri e riparti da qui
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {result.truncated && (
            <p className="mt-2 text-xs text-ink-3">Mostrate le prime 50: restringi la ricerca.</p>
          )}
          {result.items.length > 0 && (
            <p className="mt-2 text-xs text-ink-3">
              Dalla pratica: menu «Altro» → «Nuova pratica per questa famiglia».
            </p>
          )}
        </div>
      )}
    </section>
  );
}
