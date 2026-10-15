"use client";

import { useRouter } from "next/navigation";
import { useState, type RefObject } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";

/**
 * The data subject's erasure request covers every practice linked to the family, not only the
 * one on screen. Typing the reference is the deliberate step before something irreversible.
 */
export function FamilyErasureDialog({
  open,
  onOpenChange,
  dossier,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: CaseDossier;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toUpperCase() === dossier.reference.toUpperCase();

  async function erase() {
    setPending(true);
    setError(null);
    try {
      const { deletedCases } = await apiFetch<{ deletedCases: number }>(
        `/api/cases/${dossier.id}/family-erasure`,
        { method: "POST", body: { confirmReference: typed.trim(), confirmed: true } },
      );
      router.replace(
        `/console?eliminata=${encodeURIComponent(`${deletedCases} pratiche della famiglia`)}`,
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Cancellazione non riuscita. Riprova.",
      );
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTyped("");
          setError(null);
        }
        onOpenChange(next);
      }}
      title="Cancellare tutta la famiglia?"
      description="Per una richiesta di cancellazione dell'interessato: elimina questa pratica e tutte quelle collegate alla stessa famiglia, con documenti, messaggi e link."
      returnFocusTo={returnFocusTo}
    >
      <div className="grid gap-4">
        <p className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          Non si può annullare. Restano solo le tracce minime nel registro attività, come previsto
          dalla conservazione del registro.
        </p>
        <Field label={`Scrivi il codice della pratica (${dossier.reference}) per confermare`}>
          {(p) => (
            <Input
              {...p}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-code"
            />
          )}
        </Field>
        {error && (
          <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            disabled={!matches}
            loading={pending}
            onClick={() => void erase()}
          >
            Cancella tutta la famiglia
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
