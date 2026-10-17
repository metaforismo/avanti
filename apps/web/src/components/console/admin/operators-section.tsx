"use client";

import { KeyRound, ShieldOff, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { OperatorSummary, TemporaryPasswordResponse } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { timeAgo } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { focusFirstError, isEmail, text } from "@/lib/validation";

type Risky = "password" | "mfa" | "deactivate" | "promote" | "demote";

/** Every change to someone's access is confirmed, naming the person and what happens to them. */
const RISKY: Record<
  Risky,
  { title: string; description: string; effect: string; action: string; danger: boolean }
> = {
  password: {
    title: "Dare una nuova password?",
    description: "Quella attuale smette di funzionare subito.",
    effect:
      "viene disconnesso da tutti i dispositivi e al prossimo accesso sceglie una password sua.",
    action: "Crea password temporanea",
    danger: false,
  },
  mfa: {
    title: "Azzerare la verifica in due passaggi?",
    description:
      "Fallo solo se hai riconosciuto la persona: per esempio ha perso il telefono e i codici di recupero.",
    effect:
      "entrerà con la sola password e, se il CAF la richiede, dovrà riattivarla subito. L'azione finisce nel registro attività.",
    action: "Azzera verifica",
    danger: true,
  },
  deactivate: {
    title: "Disattivare l'operatore?",
    description: "Le sue pratiche restano, assegnate come prima.",
    effect: "viene disconnesso subito e non può più accedere finché non lo riattivi.",
    action: "Disattiva",
    danger: true,
  },
  promote: {
    title: "Rendere amministratore?",
    description:
      "Gli amministratori gestiscono operatori, sportelli, parametri e registro attività.",
    effect: "potrà creare e disattivare operatori e cambiare le impostazioni del CAF.",
    action: "Rendi amministratore",
    danger: false,
  },
  demote: {
    title: "Togliere il ruolo di amministratore?",
    description: "Continuerà a lavorare sulle pratiche.",
    effect: "non potrà più gestire operatori, sportelli e impostazioni.",
    action: "Rendi operatore",
    danger: false,
  },
};

export function OperatorsSection() {
  const me = useOperator();
  const list = useResource<OperatorSummary[]>("/api/operators");
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<TemporaryPasswordResponse | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ kind: Risky; operator: OperatorSummary } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function act(key: string, run: () => Promise<unknown>, inDialog = false) {
    setPending(key);
    setError(null);
    setConfirmError(null);
    try {
      await run();
      list.reload();
      return true;
    } catch (err) {
      // An open dialog hides the rest of the page from assistive tech: say it where they are.
      (inDialog ? setConfirmError : setError)(
        err instanceof ApiRequestError ? err.message : "Operazione non riuscita. Riprova.",
      );
      return false;
    } finally {
      setPending(null);
    }
  }

  const ask = (kind: Risky, operator: OperatorSummary) => {
    setError(null);
    setConfirmError(null);
    setConfirming({ kind, operator });
  };

  async function confirm() {
    if (!confirming) return;
    const { kind, operator } = confirming;
    const base = `/api/operators/${operator.id}`;
    const done = await act(
      `${kind}:${operator.id}`,
      async () => {
        if (kind === "password")
          setIssued(
            await apiFetch<TemporaryPasswordResponse>(`${base}/reset-password`, { method: "POST" }),
          );
        else if (kind === "mfa") await apiFetch(`${base}/reset-mfa`, { method: "POST", body: {} });
        else
          await apiFetch(base, {
            method: "PATCH",
            body:
              kind === "deactivate"
                ? { active: false }
                : { role: kind === "promote" ? "admin" : "operator" },
          });
      },
      true,
    );
    if (done) setConfirming(null);
  }

  const reactivate = (operator: OperatorSummary) =>
    act(`activate:${operator.id}`, () =>
      apiFetch(`/api/operators/${operator.id}`, { method: "PATCH", body: { active: true } }),
    );

  return (
    <section aria-labelledby="operators-title">
      <SectionHeader
        id="operators-title"
        title="Operatori"
        lead="Chi può accedere alla console di questo CAF."
        actions={
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden />
            Aggiungi operatore
          </Button>
        }
      />

      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}

      {list.status === "error" && !list.data ? (
        <Notice tone="danger" className="mt-4">
          Elenco non disponibile: {list.error.message}
        </Notice>
      ) : !list.data ? (
        <Skeleton className="mt-4 h-32 rounded-lg" />
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
          {list.data.map((operator) => {
            const isMe = operator.id === me.id;
            return (
              <li
                key={operator.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {operator.name}
                    {isMe && <span className="text-sm font-normal text-ink-3">(tu)</span>}
                    {operator.role === "admin" && <Pill tone="stamp">Amministratore</Pill>}
                    {!operator.active && <Pill tone="muted">Disattivato</Pill>}
                    {operator.mfaEnabled && <Pill tone="ok">Verifica in due passaggi</Pill>}
                  </p>
                  <p className="truncate text-sm text-ink-3">
                    {operator.email},{" "}
                    {operator.lastLoginAt
                      ? `ultimo accesso ${timeAgo(operator.lastLoginAt)}`
                      : "mai entrato"}
                  </p>
                </div>
                {!isMe && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => ask("password", operator)}
                      disabled={!operator.active}
                    >
                      <KeyRound className="size-4" aria-hidden />
                      Nuova password
                    </Button>
                    {operator.mfaEnabled && (
                      <Button variant="secondary" size="sm" onClick={() => ask("mfa", operator)}>
                        <ShieldOff className="size-4" aria-hidden />
                        Azzera verifica
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        ask(operator.role === "admin" ? "demote" : "promote", operator)
                      }
                    >
                      {operator.role === "admin" ? "Rendi operatore" : "Rendi amministratore"}
                    </Button>
                    {operator.active ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => ask("deactivate", operator)}
                      >
                        Disattiva
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={pending === `activate:${operator.id}`}
                        onClick={() => void reactivate(operator)}
                      >
                        Riattiva
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={adding}
        onOpenChange={setAdding}
        title="Nuovo operatore"
        description="Riceverà una password temporanea da cambiare al primo accesso."
      >
        <AddOperatorForm
          onCreated={(result) => {
            setAdding(false);
            setIssued(result);
            list.reload();
          }}
        />
      </Dialog>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? RISKY[confirming.kind].title : ""}
        description={confirming ? RISKY[confirming.kind].description : undefined}
      >
        {confirming && (
          <div className="grid gap-4">
            <p className="text-ink-2">
              <span className="font-semibold text-ink">{confirming.operator.name}</span>{" "}
              {RISKY[confirming.kind].effect}
            </p>
            {confirmError && <Notice tone="danger">{confirmError}</Notice>}
            <div className="flex flex-wrap gap-3">
              <Button
                variant={RISKY[confirming.kind].danger ? "danger" : "primary"}
                loading={pending === `${confirming.kind}:${confirming.operator.id}`}
                onClick={() => void confirm()}
              >
                {RISKY[confirming.kind].action}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                Annulla
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={issued !== null}
        onOpenChange={(open) => !open && setIssued(null)}
        dismissible={false}
        title="Password temporanea"
        description="Comunicala di persona o per telefono, non per email. Non la vedrai più e vale 7 giorni: al primo accesso l'operatore dovrà sceglierne una nuova."
      >
        {issued && (
          <div className="grid gap-4">
            <p className="text-ink-2">
              Per <span className="font-semibold text-ink">{issued.operator.name}</span> (
              {issued.operator.email})
            </p>
            <p
              className="rounded-md bg-sunk px-4 py-3 text-center font-mono text-xl tracking-wider select-all"
              translate="no"
            >
              {issued.temporaryPassword}
            </p>
            <CopyButton
              value={issued.temporaryPassword}
              labels={{
                copy: "Copia password",
                copied: "Copiata",
                failed: "Copia non riuscita: selezionala a mano.",
              }}
            />
            <Button onClick={() => setIssued(null)}>Fatto</Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}

function AddOperatorForm({
  onCreated,
}: {
  onCreated: (result: TemporaryPasswordResponse) => void;
}) {
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const name = text(data.get("name"));
    const email = text(data.get("email")).toLowerCase();
    const role = data.get("role") === "admin" ? "admin" : "operator";
    const next: typeof errors = {};
    if (name.length < 2) next.name = "Scrivi nome e cognome.";
    if (!isEmail(email)) next.email = "Controlla l'email.";
    setErrors(next);
    if (focusFirstError(event.currentTarget, next)) return;
    setPending(true);
    setFormError(null);
    try {
      onCreated(
        await apiFetch<TemporaryPasswordResponse>("/api/operators", {
          method: "POST",
          body: { name, email, role },
        }),
      );
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? error.message : "Creazione non riuscita. Riprova.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field label="Nome e cognome" error={errors.name}>
        {(p) => <Input {...p} name="name" autoComplete="off" />}
      </Field>
      <Field label="Email di lavoro" error={errors.email}>
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Ruolo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "operator", label: "Operatore", hint: "Lavora le pratiche" },
            {
              value: "admin",
              label: "Amministratore",
              hint: "Anche operatori, sportelli e impostazioni",
            },
          ].map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-md p-3 ring-1 ring-line-strong ring-inset has-[:checked]:ring-2 has-[:checked]:ring-stamp"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                defaultChecked={option.value === "operator"}
                className="mt-1 accent-stamp"
              />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="text-sm text-ink-3">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {formError && <Notice tone="danger">{formError}</Notice>}
      <Button type="submit" loading={pending}>
        Crea operatore
      </Button>
    </form>
  );
}
