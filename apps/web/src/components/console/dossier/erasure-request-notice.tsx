"use client";

import { useState } from "react";
import type { CaseDossier } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { erasureDeadline, formatDeadline } from "@/lib/console/erasure-deadline";
import { formatDateTime } from "@/lib/console/labels";

/**
 * The citizen asked, from their link, to erase a case already sent. The CAF is the controller:
 * an admin checks identity and retention duties, then erases (this case or the family) or
 * closes the request after telling the citizen why it keeps the data.
 */
export function ErasureRequestNotice({
  dossier,
  isAdmin,
  onDelete,
  onEraseFamily,
  onChanged,
}: {
  dossier: CaseDossier;
  isAdmin: boolean;
  onDelete: () => void;
  onEraseFamily: () => void;
  onChanged: () => void;
}) {
  const [decline, setDecline] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!dossier.erasureRequestedAt) return null;
  const deadline = formatDeadline(erasureDeadline(dossier.erasureRequestedAt));

  return (
    <>
      <Notice
        tone="warn"
        size="md"
        className="mt-4"
        title="Il cittadino chiede di cancellare i suoi dati"
      >
        <p>
          Richiesta inviata dal link il {formatDateTime(dossier.erasureRequestedAt)}. Rispondi entro
          il <strong>{deadline}</strong>: verifica chi la fa e se un obbligo di legge impone di
          conservare la pratica.
        </p>
        {isAdmin ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={onDelete}>
              Elimina definitivamente…
            </Button>
            <Button variant="secondary" size="sm" onClick={onEraseFamily}>
              Cancella tutta la famiglia…
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDecline(true)}>
              Conserva la pratica…
            </Button>
          </div>
        ) : (
          <p className="mt-2">Solo un amministratore del CAF può cancellare: avvisalo.</p>
        )}
      </Notice>
      <Dialog
        open={decline}
        onOpenChange={setDecline}
        title="Conservare la pratica?"
        description="La richiesta esce dalla coda e il fascicolo resta. Prima scrivi al cittadino perché lo conservi e come può reclamare al Garante: è un obbligo (art. 12, par. 4 GDPR)."
      >
        {error && (
          <Notice tone="danger" className="mb-4">
            {error}
          </Notice>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDecline(false)}>
            Annulla
          </Button>
          <Button
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                await apiFetch(`/api/cases/${encodeURIComponent(dossier.id)}/erasure-request`, {
                  method: "DELETE",
                });
                setDecline(false);
                onChanged();
              } catch (err) {
                setError(
                  err instanceof ApiRequestError
                    ? err.message
                    : "Operazione non riuscita. Riprova.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            Ho risposto, conserva
          </Button>
        </div>
      </Dialog>
    </>
  );
}
