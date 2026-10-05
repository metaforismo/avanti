"use client";

import { MessageCircle, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { CreateCaseResponse, Language, PracticeId, PracticeSummary } from "@avanti/contracts";
import { LANGUAGES } from "@avanti/contracts/constants";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { CopyButton } from "@/components/ui/copy-button";
import { FullscreenQr } from "@/components/ui/fullscreen-qr";
import { QrCode } from "@/components/ui/qr-code";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { LANGUAGE_IT } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";

/** Invitation text: Italian always, plus the citizen's language so they understand the link. */
const INVITE: Record<Language, string> = {
  it: "Per preparare la tua pratica al CAF apri questo link dal telefono:",
  en: "To prepare your application at the CAF, open this link on your phone:",
  fr: "Pour préparer ton dossier au CAF, ouvre ce lien sur ton téléphone :",
  es: "Para preparar tu trámite en el CAF, abre este enlace en el móvil:",
  ro: "Ca să îți pregătești dosarul la CAF, deschide acest link pe telefon:",
  uk: "Щоб підготувати свою справу в CAF, відкрий це посилання на телефоні:",
  ar: "لتحضير ملفك في الـ CAF، افتح هذا الرابط على هاتفك:",
  bn: "CAF-এ আপনার আবেদন প্রস্তুত করতে ফোনে এই লিংকটি খুলুন:",
};

function inviteMessage(language: Language, link: string) {
  const lines = [INVITE.it];
  if (language !== "it") lines.push(INVITE[language]);
  return `${lines.join("\n")}\n${link}`;
}

const selectClass =
  "h-11 w-full rounded-sm bg-surface px-3 text-base ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none";

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
        <CreateForm
          onCreated={(response, phone, language) => setCreated({ response, phone, language })}
        />
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
            <select
              {...p}
              name="officeId"
              className={selectClass}
              defaultValue={operator.offices[0]?.id}
            >
              {operator.offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
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
            <select {...p} name="practiceId" className={selectClass} defaultValue="">
              <option value="">Da capire con il cittadino</option>
              {practices.map((practice) => (
                <option key={practice.id} value={practice.id}>
                  {practice.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Lingua del cittadino">
          {(p) => (
            <select {...p} name="language" className={selectClass} defaultValue="it">
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_IT[code]}
                </option>
              ))}
            </select>
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
      {error && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
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
  const link = response.citizenLink;
  const message = inviteMessage(language, link);
  const digits = phone?.replace(/[^\d+]/g, "").replace(/^\+/, "");
  // Italian mobile numbers are often typed without the country code.
  const waNumber = digits
    ? digits.length === 10 && digits.startsWith("3")
      ? `39${digits}`
      : digits
    : "";

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 rounded-lg bg-sunk p-4 sm:grid-cols-[8rem_1fr] sm:items-center">
        <QrCode
          value={link}
          label="QR code del link per il cittadino"
          className="w-32 rounded-sm bg-white p-1 [&_svg]:size-full"
        />
        <div className="min-w-0">
          <p className="text-sm text-ink-3">Pratica {response.case.reference}</p>
          <p className="mt-1 font-mono text-xs break-all text-ink-2" translate="no">
            {link}
          </p>
          <div className="mt-3">
            <FullscreenQr
              value={link}
              title="Inquadra con la fotocamera del telefono"
              caption="Si apre la tua pratica: scegli la lingua e rispondi alle domande."
            />
          </div>
          <p className="mt-2 text-sm text-ink-3">
            Il link è personale: non condividerlo con altri.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <CopyButton value={link} showValueOnFailure={false} className="w-full" />
        <Button variant="secondary" asChild>
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </a>
        </Button>
        <Button variant="secondary" asChild>
          <a href={`sms:${phone ?? ""}?&body=${encodeURIComponent(message)}`}>
            <Smartphone className="size-4" />
            SMS
          </a>
        </Button>
      </div>
      <Button size="lg" asChild>
        <Link href={`/console/pratiche/${response.case.id}`} onClick={onDone}>
          Apri il fascicolo
        </Link>
      </Button>
    </div>
  );
}
