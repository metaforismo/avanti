"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { CreateCaseResponse, Language, PracticeId, PracticeSummary } from "@avanti/contracts";
import { LANGUAGES } from "@avanti/contracts/constants";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { LANGUAGE_IT } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { FamilySearch } from "./family-search";
import { ShareCitizenLink } from "./share-citizen-link";

export function NewCaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [created, setCreated] = useState<{
    response: CreateCaseResponse;
    phone?: string;
    language: Language;
  } | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) window.setTimeout(() => setCreated(null), 200);
      }}
      title={created ? "Pratica creata" : "Nuova pratica"}
      description={
        created
          ? "Manda il link al cittadino: lo apre dal telefono, senza registrarsi."
          : "Crea il fascicolo e invia al cittadino il link per compilarlo."
      }
    >
      {created ? (
        <Created {...created} onDone={() => onOpenChange(false)} />
      ) : (
        <div className="grid gap-5">
          {/* Its own form: a returning family starts from its earlier practice instead. */}
          <FamilySearch onOpen={() => onOpenChange(false)} />
          <CreateForm
            onCreated={(response, phone, language) => setCreated({ response, phone, language })}
          />
        </div>
      )}
    </Dialog>
  );
}

function CreateForm({
  onCreated,
}: {
  onCreated: (response: CreateCaseResponse, phone: string | undefined, language: Language) => void;
}) {
  const operator = useOperator();
  const [practices, setPractices] = useState<PracticeSummary[]>([]);
  const [practicesFailed, setPracticesFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PracticeSummary[]>("/api/practices?lang=it")
      .then((list) => setPractices(list.filter((p) => p.availability !== "coming_soon")))
      .catch(() => setPracticesFailed(true));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim() || undefined;
    const phone = text("phone");
    const language = (text("language") as Language | undefined) ?? "it";
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch<CreateCaseResponse>("/api/cases", {
        method: "POST",
        body: {
          officeId: text("officeId"),
          practiceId: (text("practiceId") as PracticeId | undefined) ?? undefined,
          language,
          citizen: { firstName: text("firstName"), lastName: text("lastName"), phone },
        },
      });
      onCreated(response, phone, language);
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiRequestError ? err.message : "Creazione non riuscita. Riprova.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {operator.offices.length > 1 ? (
        <Field label="Sportello">
          {(p) => (
            <Select
              {...p}
              name="officeId"

              defaultValue={operator.offices[0]?.id}
            >
              {operator.offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <input type="hidden" name="officeId" value={operator.offices[0]?.id ?? ""} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Pratica"
          hint={
            practicesFailed
              ? "Elenco non disponibile: la pratica la capirà Avanti dal racconto del cittadino."
              : "Se non la sai, la capisce Avanti."
          }
        >
          {(p) => (
            <Select {...p} name="practiceId" defaultValue="">
              <option value="">Da capire con il cittadino</option>
              {practices.map((practice) => (
                <option key={practice.id} value={practice.id}>
                  {practice.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Lingua del cittadino">
          {(p) => (
            <Select {...p} name="language" defaultValue="it">
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_IT[code]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" optional="facoltativo">
          {(p) => <Input {...p} name="firstName" autoComplete="off" />}
        </Field>
        <Field label="Cognome" optional="facoltativo">
          {(p) => <Input {...p} name="lastName" autoComplete="off" />}
        </Field>
      </div>
      <Field
        label="Cellulare"
        optional="facoltativo"
        hint="Per mandare il link via WhatsApp o SMS."
      >
        {(p) => <Input {...p} name="phone" type="tel" inputMode="tel" autoComplete="off" />}
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending} className="mt-1">
        Crea e ottieni il link
      </Button>
    </form>
  );
}

function Created({
  response,
  phone,
  language,
  onDone,
}: {
  response: CreateCaseResponse;
  phone?: string;
  language: Language;
  onDone: () => void;
}) {
  return (
    <div className="grid gap-5">
      <ShareCitizenLink
        link={response.citizenLink}
        reference={response.case.reference}
        language={language}
        phone={phone}
      />
      <Button size="lg" asChild>
        <Link href={`/console/pratiche/${response.case.id}`} onClick={onDone}>
          Apri il fascicolo
        </Link>
      </Button>
    </div>
  );
}
