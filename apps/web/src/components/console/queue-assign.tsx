"use client";

import { UserRoundCheck } from "lucide-react";
import { useState } from "react";
import type { AssignCasesResponse, CaseListItem, OperatorSummary } from "@avanti/contracts";
import { ASSIGN_CASES_MAX } from "@avanti/contracts/constants";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useResource } from "@/lib/console/use-resource";

const NOBODY = "none";

export const casesLabel = (n: number) => (n === 1 ? "1 pratica" : `${n} pratiche`);

/**
 * The bar under a multiple selection in the queue and the dialog that confirms the assignment.
 * Admins only: the API refuses anyone else.
 */
export function QueueAssign({
  selected,
  currentOperatorId,
  onClear,
  onDone,
}: {
  selected: CaseListItem[];
  currentOperatorId: string;
  onClear: () => void;
  onDone: (response: AssignCasesResponse) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const team = useResource<OperatorSummary[]>("/api/operators");
  const active = (team.data ?? []).filter((operator) => operator.active);
  const chosen = active.find((operator) => operator.id === choice) ?? null;
  const count = selected.length;
  const targetId = choice === NOBODY ? null : (chosen?.id ?? undefined);
  const already =
    targetId === undefined
      ? 0
      : selected.filter((item) => (item.assignee?.id ?? null) === targetId).length;
  const fromColleagues =
    targetId === undefined
      ? 0
      : selected.filter((item) => item.assignee && item.assignee.id !== targetId).length;
  const name = (operator: OperatorSummary) =>
    operator.id === currentOperatorId ? `${operator.name} (tu)` : operator.name;

  function openDialog() {
    setChoice(null);
    setError(null);
    setOpen(true);
  }

  async function submit() {
    if (targetId === undefined || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiFetch<AssignCasesResponse>("/api/cases/assign", {
        method: "POST",
        body: {
          assigneeId: targetId,
          cases: selected.map((item) => ({ id: item.id, expectedUpdatedAt: item.updatedAt })),
        },
      });
      setOpen(false);
      onDone(response);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Assegnazione non riuscita. Riprova.",
      );
    } finally {
      setPending(false);
    }
  }

  const confirmLabel =
    targetId === undefined
      ? count === 1
        ? "Scegli a chi assegnarla"
        : "Scegli a chi assegnarle"
      : targetId === null
        ? `Togli l'assegnazione a ${casesLabel(count)}`
        : `Assegna ${casesLabel(count)} a ${chosen!.name}`;

  return (
    <>
      <div
        role="region"
        aria-label="Pratiche selezionate"
        className="fixed inset-x-0 bottom-0 z-30 animate-dock-in border-t border-line bg-surface/95 shadow-dock backdrop-blur lg:start-60"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <p className="text-sm" aria-live="polite">
            <span className="tabular font-semibold">{count}</span>{" "}
            {count === 1 ? "pratica selezionata" : "pratiche selezionate"}
            {count >= ASSIGN_CASES_MAX && (
              <span className="text-ink-3"> (al massimo {ASSIGN_CASES_MAX} per volta)</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClear}>
              Deseleziona
            </Button>
            <Button onClick={openDialog}>
              <UserRoundCheck className="size-4" aria-hidden />
              Assegna a…
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={`Assegna ${casesLabel(count)}`}
        description={`${count === 1 ? "Chi la riceve la trova" : "Chi le riceve le trova"} subito tra «Assegnate a me». Puoi cambiare in ogni momento.`}
      >
        {team.status === "error" && !team.data ? (
          <Notice
            tone="danger"
            title="Non riesco a caricare i colleghi."
            action={
              <Button variant="secondary" size="sm" onClick={() => void team.reload()}>
                Riprova
              </Button>
            }
          >
            {team.error.message}
          </Notice>
        ) : !team.data ? (
          <div className="grid gap-2" aria-busy>
            <span className="sr-only">Caricamento dei colleghi…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">A chi</legend>
            <div className="grid max-h-[45dvh] gap-2 overflow-y-auto p-0.5">
              {[
                ...active.map((o) => ({ id: o.id, label: name(o) })),
                { id: NOBODY, label: "" },
              ].map((option) => (
                <label
                  key={option.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 ring-1 ring-line-strong ring-inset has-[:checked]:ring-2 has-[:checked]:ring-stamp has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp"
                >
                  <input
                    type="radio"
                    name="assignee"
                    value={option.id}
                    checked={choice === option.id}
                    onChange={() => setChoice(option.id)}
                    className="size-4 shrink-0 accent-stamp"
                  />
                  {option.id === NOBODY ? (
                    <span>
                      <span className="block font-semibold">Nessuno</span>
                      <span className="text-sm text-ink-3">Tornano tra le non assegnate</span>
                    </span>
                  ) : (
                    <span className="min-w-0 font-semibold break-words">{option.label}</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div aria-live="polite" className="mt-4">
          {targetId !== undefined && (
            <div className="rounded-md bg-sunk px-4 py-3 text-sm">
              <p className="font-semibold">
                {targetId === null
                  ? `Togliere l'assegnazione a ${casesLabel(count)}?`
                  : `Assegnare ${casesLabel(count)} a ${chosen!.name}?`}
              </p>
              {fromColleagues > 0 && (
                <p className="mt-1 text-ink-2">
                  {fromColleagues === 1
                    ? "1 è ora di un altro collega"
                    : `${fromColleagues} sono ora di altri colleghi`}
                  {targetId === null
                    ? fromColleagues === 1
                      ? " e tornerà libera."
                      : " e torneranno libere."
                    : ` e ${fromColleagues === 1 ? "passerà" : "passeranno"} a ${chosen!.name}.`}
                </p>
              )}
              {already > 0 && (
                <p className="mt-1 text-ink-2">
                  {`${already === 1 ? "1 è già" : `${already} sono già`} ${
                    targetId === null ? "senza assegnazione" : `di ${chosen!.name}`
                  }: ${already === 1 ? "resta così" : "restano così"}.`}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <Notice tone="danger" className="mt-4">
            {error}
          </Notice>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Annulla
          </Button>
          {/* Grows to two lines for a long colleague name instead of overflowing the dialog. */}
          <Button
            loading={pending}
            disabled={targetId === undefined}
            onClick={() => void submit()}
            className="h-auto min-h-10 py-2 text-balance whitespace-normal"
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
