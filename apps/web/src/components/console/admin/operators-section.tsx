"use client";

import { KeyRound, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { OperatorSummary, TemporaryPasswordResponse } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { timeAgo } from "@/lib/console/labels";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { isEmail, text } from "@/lib/validation";

export function OperatorsSection() {
  const me = useOperator();
  const list = useResource<OperatorSummary[]>("/api/operators");
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<TemporaryPasswordResponse | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, run: () => Promise<unknown>) {
    setPending(key);
    setError(null);
    try {
      await run();
      list.reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Operazione non riuscita. Riprova.");
    } finally {
      setPending(null);
    }
  }

  const resetPassword = (operator: OperatorSummary) =>
    act(`reset:${operator.id}`, async () => {
      setIssued(
        await apiFetch<TemporaryPasswordResponse>(`/api/operators/${operator.id}/reset-password`, {
          method: "POST",
        }),
      );
    });

  const update = (
    operator: OperatorSummary,
    body: Partial<Pick<OperatorSummary, "role" | "active">>,
  ) =>
    act(`update:${operator.id}`, () =>
      apiFetch(`/api/operators/${operator.id}`, { method: "PATCH", body }),
    );

  return (
    <section aria-labelledby="operators-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="operators-title" className="font-display text-xl font-semibold">
            Operatori
          </h2>
          <p className="mt-1 text-ink-2">Chi può accedere alla console di questo CAF.</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <UserPlus className="size-4" aria-hidden />
          Aggiungi operatore
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {list.status === "error" && !list.data ? (
        <p className="mt-4 text-danger">Elenco non disponibile: {list.error.message}</p>
      ) : !list.data ? (
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-sunk" aria-hidden />
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
                      loading={pending === `reset:${operator.id}`}
                      onClick={() => void resetPassword(operator)}
                      disabled={!operator.active}
                    >
                      <KeyRound className="size-4" aria-hidden />
                      Nuova password
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={pending === `update:${operator.id}`}
                      onClick={() =>
                        void update(operator, {
                          role: operator.role === "admin" ? "operator" : "admin",
                        })
                      }
                    >
                      {operator.role === "admin" ? "Rendi operatore" : "Rendi amministratore"}
                    </Button>
                    <Button
                      variant={operator.active ? "danger" : "secondary"}
                      size="sm"
                      onClick={() => void update(operator, { active: !operator.active })}
                    >
                      {operator.active ? "Disattiva" : "Riattiva"}
                    </Button>
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
        open={issued !== null}
        onOpenChange={(open) => !open && setIssued(null)}
        title="Password temporanea"
        description="Comunicala di persona o per telefono, non per email. Non la vedrai più: al primo accesso l'operatore dovrà sceglierne una nuova."
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
    if (next.name || next.email) return;
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
      {formError && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Crea operatore
      </Button>
    </form>
  );
}
