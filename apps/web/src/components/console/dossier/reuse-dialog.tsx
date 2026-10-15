"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type {
  CaseDossier,
  CreateCaseResponse,
  MemberInput,
  MemberRole,
  PracticeId,
  PracticeSummary,
} from "@avanti/contracts";
import { LANGUAGES } from "@avanti/contracts/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { LANGUAGE_IT } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { ShareCitizenLink } from "../share-citizen-link";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "coniuge", label: "Coniuge o partner" },
  { value: "figlio", label: "Figlio o figlia" },
  { value: "genitore", label: "Genitore" },
  { value: "altro", label: "Altra persona" },
];

type Draft = MemberInput & { key: string; keep: boolean };

/**
 * A new practice for a family the CAF already follows: next year's ISEE, the 730 after the ISEE.
 * The operator confirms who still lives there and which documents carry over; nothing is linked
 * or shown to the citizen without that confirmation.
 */
export function ReuseDialog({
  open,
  onOpenChange,
  dossier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: CaseDossier;
}) {
  const [created, setCreated] = useState<CreateCaseResponse | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCreated(null);
        onOpenChange(next);
      }}
      title={created ? "Pratica creata" : "Nuova pratica per questa famiglia"}
      description={
        created
          ? "Manda il link al cittadino: ritrova il nucleo e i documenti ancora validi."
          : "Il nucleo e i documenti ancora validi passano alla nuova pratica. Il cittadino controlla e aggiorna il resto."
      }
      className="sm:max-w-2xl"
    >
      {created ? (
        <div className="grid gap-5">
          <ShareCitizenLink
            link={created.citizenLink}
            reference={created.case.reference}
            language={created.case.language}
          />
          <Button size="lg" asChild>
            <Link href={`/console/pratiche/${created.case.id}`} onClick={() => onOpenChange(false)}>
              Apri la nuova pratica
            </Link>
          </Button>
        </div>
      ) : (
        open && <ReuseForm dossier={dossier} onCreated={setCreated} />
      )}
    </Dialog>
  );
}

function ReuseForm({
  dossier,
  onCreated,
}: {
  dossier: CaseDossier;
  onCreated: (response: CreateCaseResponse) => void;
}) {
  const operator = useOperator();
  const [practices, setPractices] = useState<PracticeSummary[]>([]);
  const [members, setMembers] = useState<Draft[]>(() =>
    dossier.household.map((m) => ({ ...m, key: m.id, keep: true })),
  );
  const [documents, setDocuments] = useState(() =>
    dossier.documents.map((doc) => {
      const owner = dossier.household.find((m) => m.id === doc.memberId);
      return {
        id: doc.id,
        label: doc.analysis?.detectedLabel ?? doc.fileName,
        memberId: doc.memberId,
        ownerName: owner?.firstName ?? null,
        applicant: owner?.role === "richiedente",
        reuse: true,
        // Another person's document is never shown to the citizen unless granted here.
        visible: owner?.role === "richiedente",
      };
    }),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PracticeSummary[]>("/api/practices?lang=it")
      .then((list) => setPractices(list.filter((p) => p.availability !== "coming_soon")))
      .catch(() => setPractices([]));
  }, []);

  const keptIds = new Set(members.filter((m) => m.keep && m.id).map((m) => m.id));
  // Documents of people who left the household stay behind.
  const eligible = documents.filter((d) => !d.memberId || keptIds.has(d.memberId));
  const defaultYear = (dossier.practiceYear ?? new Date().getFullYear()) + 1;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!confirmed) {
      setError("Conferma di aver verificato il nucleo con il cittadino.");
      return;
    }
    const kept = members
      .filter((m) => m.keep && m.firstName.trim())
      .map(({ key: _key, keep: _keep, ...member }) => member);
    setPending(true);
    setError(null);
    try {
      onCreated(
        await apiFetch<CreateCaseResponse>(`/api/cases/${dossier.id}/reuse`, {
          method: "POST",
          body: {
            officeId: String(form.get("officeId")),
            practiceId: String(form.get("practiceId")) as PracticeId,
            practiceYear: Number(form.get("practiceYear")),
            language: String(form.get("language")),
            confirmed: true,
            members: kept,
            documentIds: eligible.filter((d) => d.reuse).map((d) => d.id),
            citizenVisibleDocumentIds: eligible
              .filter((d) => d.reuse && d.visible)
              .map((d) => d.id),
          },
        }),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Creazione non riuscita. Riprova.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pratica">
          {(p) => (
            <Select
              {...p}
              name="practiceId"
              defaultValue={dossier.practice?.id ?? practices[0]?.id}
              key={practices.length}
            >
              {practices.map((practice) => (
                <option key={practice.id} value={practice.id}>
                  {practice.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Anno della pratica">
          {(p) => (
            <Input
              {...p}
              name="practiceYear"
              inputMode="numeric"
              defaultValue={defaultYear}
              className="tabular"
            />
          )}
        </Field>
        <Field label="Lingua del cittadino">
          {(p) => (
            <Select {...p} name="language" defaultValue={dossier.language}>
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_IT[code]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {operator.offices.length > 1 ? (
        <Field label="Sportello">
          {(p) => (
            <Select
              {...p}
              name="officeId"
              defaultValue={dossier.office?.id ?? operator.offices[0]?.id}
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

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Chi vive ancora nel nucleo</legend>
        <ul className="divide-y divide-line rounded-md ring-1 ring-line">
          {members.map((member, index) => (
            <li key={member.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              {member.id ? (
                <Checkbox
                  className="flex-1"
                  checked={member.keep}
                  disabled={member.role === "richiedente"}
                  onChange={(e) =>
                    setMembers((list) =>
                      list.map((m, i) => (i === index ? { ...m, keep: e.target.checked } : m)),
                    )
                  }
                  label={
                    <>
                      <span className="font-semibold">
                        {member.firstName} {member.lastName}
                      </span>
                      <span className="text-sm text-ink-3">
                        {" "}
                        · {member.role === "richiedente" ? "richiedente" : member.role}
                        {member.birthYear ? `, ${member.birthYear}` : ""}
                      </span>
                    </>
                  }
                />
              ) : (
                <div className="grid flex-1 gap-2 sm:grid-cols-[10rem_1fr_6rem]">
                  <Select
                    aria-label="Ruolo"
                    compact
                    value={member.role}
                    onChange={(e) =>
                      setMembers((list) =>
                        list.map((m, i) =>
                          i === index ? { ...m, role: e.target.value as MemberRole } : m,
                        ),
                      )
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label="Nome"
                    placeholder="Nome"
                    value={member.firstName}
                    onChange={(e) =>
                      setMembers((list) =>
                        list.map((m, i) => (i === index ? { ...m, firstName: e.target.value } : m)),
                      )
                    }
                    className="h-9 text-sm"
                  />
                  <Input
                    aria-label="Anno di nascita"
                    placeholder="Anno"
                    inputMode="numeric"
                    value={member.birthYear ?? ""}
                    onChange={(e) =>
                      setMembers((list) =>
                        list.map((m, i) =>
                          i === index
                            ? { ...m, birthYear: Number(e.target.value) || undefined }
                            : m,
                        ),
                      )
                    }
                    className="tabular h-9 text-sm"
                  />
                </div>
              )}
              {!member.id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Togli questa persona"
                  onClick={() => setMembers((list) => list.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() =>
            setMembers((list) => [
              ...list,
              { key: `new-${list.length}`, role: "figlio", firstName: "", keep: true },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          Aggiungi una persona (per esempio una nascita)
        </Button>
      </fieldset>

      {eligible.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Documenti da portare nella nuova pratica
          </legend>
          <p className="mb-2 text-sm text-ink-3">
            Avanti segnala nella nuova pratica quelli scaduti o da aggiornare. I documenti degli
            altri componenti il cittadino li vede solo se lo indichi.
          </p>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-md ring-1 ring-line">
            {eligible.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                <Checkbox
                  className="min-w-0 flex-1"
                  checked={doc.reuse}
                  onChange={(e) =>
                    setDocuments((list) =>
                      list.map((d) => (d.id === doc.id ? { ...d, reuse: e.target.checked } : d)),
                    )
                  }
                  label={
                    <span className="block truncate">
                      {doc.label}
                      {doc.ownerName && (
                        <span className="text-sm text-ink-3"> · {doc.ownerName}</span>
                      )}
                    </span>
                  }
                />
                {!doc.applicant && doc.reuse && (
                  <Checkbox
                    className="text-sm text-ink-2"
                    checked={doc.visible}
                    onChange={(e) =>
                      setDocuments((list) =>
                        list.map((d) =>
                          d.id === doc.id ? { ...d, visible: e.target.checked } : d,
                        ),
                      )
                    }
                    label="Visibile al cittadino"
                  />
                )}
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <Checkbox
        className="rounded-md bg-paper p-3"
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
        label="Ho verificato con il cittadino che il nucleo è aggiornato"
        hint="Le pratiche collegate restano della stessa famiglia anche per le cancellazioni su richiesta."
      />

      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        Crea la nuova pratica
      </Button>
    </form>
  );
}
