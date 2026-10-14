"use client";

import { useState, type RefObject } from "react";
import type { CaseDossier, RegenerateLinkResponse } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { formatDateTime } from "@/lib/console/labels";
import { ShareCitizenLink } from "../share-citizen-link";

/**
 * Citizen links are shown once and only their hash is stored: when one is lost, the only way
 * back in is a new one, which immediately disables the old.
 */
export function NewLinkDialog({
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
  const [issued, setIssued] = useState<RegenerateLinkResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setPending(true);
    setError(null);
    try {
      setIssued(
        await apiFetch<RegenerateLinkResponse>(
          `/api/cases/${encodeURIComponent(dossier.id)}/link`,
          { method: "POST" },
        ),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Link non creato. Riprova tra poco.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // The new link is shown once: closing forgets it.
        if (!next) {
          setIssued(null);
          setError(null);
        }
        onOpenChange(next);
      }}
      returnFocusTo={returnFocusTo}
      title={issued ? "Nuovo link creato" : "Creare un nuovo link per il cittadino?"}
      description={
        issued
          ? `Mandalo al cittadino: è l'unico valido, fino al ${formatDateTime(issued.expiresAt)}.`
          : "Il link attuale smette subito di funzionare. Usalo quando il cittadino l'ha perso o non lo trova più: risposte e documenti restano dove sono."
      }
    >
      {issued ? (
        <div className="grid gap-5">
          <ShareCitizenLink
            kind="renewed"
            link={issued.url}
            reference={dossier.reference}
            language={dossier.language}
            phone={dossier.citizen.phone ?? undefined}
          />
          <Button size="lg" onClick={() => onOpenChange(false)}>
            Fatto
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {error && (
            <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button loading={pending} onClick={() => void regenerate()}>
              Crea il nuovo link
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
