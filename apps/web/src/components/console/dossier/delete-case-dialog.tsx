"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type RefObject } from "react";
import type { Route } from "next";
import type { CaseDossier } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";

/** GDPR erasure: irreversible, so the reference must be typed again. Admins only. */
export function DeleteCaseDialog({
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
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = value.trim().toUpperCase() === dossier.reference.toUpperCase();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!matches || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/cases/${dossier.id}`, {
        method: "DELETE",
        body: { confirmReference: dossier.reference },
      });
      router.replace(`/console?eliminata=${encodeURIComponent(dossier.reference)}` as Route);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof ApiRequestError ? err.message : "Eliminazione non riuscita. Riprova.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      returnFocusTo={returnFocusTo}
      onOpenChange={(next) => {
        if (!next) setValue("");
        onOpenChange(next);
      }}
      title="Eliminare definitivamente il fascicolo?"
      description="Risposte, documenti e messaggi vengono cancellati da Avanti e non si possono recuperare. Resta solo una traccia anonima dell'operazione. Usalo per le richieste di cancellazione degli interessati, dopo aver verificato gli obblighi di conservazione del CAF."
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label={`Per confermare scrivi il codice ${dossier.reference}`}>
          {(p) => (
            <Input
              {...p}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono"
            />
          )}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="submit" variant="danger" disabled={!matches} loading={pending}>
            Elimina definitivamente
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
