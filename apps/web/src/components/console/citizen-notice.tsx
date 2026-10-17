"use client";

import { BellRing, Link2, MessageCircle, Printer, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  CaseDossier,
  CitizenHandoff,
  CitizenHandoffChannel,
  RegenerateLinkResponse,
} from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { directionOf } from "@/lib/citizen/document-language";
import {
  lastNotice,
  noticeKind,
  noticeText,
  smsHref,
  whatsappHref,
} from "@/lib/console/citizen-notice";
import { LANGUAGE_IT, timeAgo } from "@/lib/console/labels";

const CHANNEL_IT: Record<Exclude<CitizenHandoffChannel, "print">, string> = {
  whatsapp: "su WhatsApp",
  sms: "via SMS",
  copy: "con il messaggio copiato",
};

export const printPath = (caseId: string) => `/console/stampa/${encodeURIComponent(caseId)}`;

/** Fire and forget: the message already left; a lost record must not block the operator. */
export function recordHandoff(caseId: string, channel: CitizenHandoffChannel) {
  return apiFetch(`/api/cases/${encodeURIComponent(caseId)}/citizen-handoff/events`, {
    method: "POST",
    body: { channel },
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * In the citizen card: whether the citizen knows they have to act, and the way to tell them.
 * Email reaches only those who left one; many leave just a phone number.
 */
export function CitizenNoticeStatus({
  dossier,
  onNotify,
}: {
  dossier: CaseDossier;
  onNotify: () => void;
}) {
  const kind = noticeKind(dossier.status);
  const printable = Boolean(dossier.practice) && dossier.status !== "closed";
  if (!kind && !printable) return null;
  const told = kind ? lastNotice(dossier.timeline, kind) : null;
  return (
    <div className="mt-4 grid gap-2.5 border-t border-line pt-4">
      {kind &&
        (told ? (
          <p className="text-sm text-ink-2" role="status">
            Avvisato {CHANNEL_IT[told.channel]}
            {told.by ? ` da ${told.by}` : ""}, {timeAgo(told.at)}.
          </p>
        ) : !dossier.citizen.email ? (
          <p className="text-sm text-warn" role="status">
            {kind === "request"
              ? "Non ha lasciato l'email: nessun avviso automatico della richiesta."
              : "Non ha lasciato l'email: nessun avviso automatico che è pronta."}
          </p>
        ) : null)}
      {kind && (
        <Button
          size="sm"
          variant={told || dossier.citizen.email ? "secondary" : "primary"}
          onClick={onNotify}
        >
          <BellRing className="size-4" aria-hidden />
          Avvisa il cittadino
        </Button>
      )}
      {printable && (
        <Button size="sm" variant="ghost" asChild>
          <a href={printPath(dossier.id)} target="_blank" rel="noopener">
            <Printer className="size-4" aria-hidden />
            Stampa i documenti da portare
          </a>
        </Button>
      )}
    </div>
  );
}

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; handoff: CitizenHandoff };

/**
 * A message in the citizen's language and in Italian, sent from the operator's own WhatsApp
 * or phone. Avanti keeps no copy of the text: only that it was prepared, and on which channel.
 */
export function CitizenNoticeDialog({
  open,
  onOpenChange,
  dossier,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: CaseDossier;
  onRecorded: () => void;
}) {
  const language = LANGUAGE_IT[dossier.language].toLowerCase();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Avvisa il cittadino"
      description={
        dossier.language === "it"
          ? "Il messaggio parte dal tuo WhatsApp o dal tuo telefono. Avanti registra solo che l'hai preparato."
          : `Messaggio in ${language} e in italiano. Parte dal tuo WhatsApp o dal tuo telefono; Avanti registra solo che l'hai preparato.`
      }
    >
      {open && <NoticeBody dossier={dossier} onRecorded={onRecorded} />}
    </Dialog>
  );
}

function NoticeBody({ dossier, onRecorded }: { dossier: CaseDossier; onRecorded: () => void }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [link, setLink] = useState<string | null>(null);
  const [linkStep, setLinkStep] = useState<"idle" | "confirm" | "pending">("idle");
  const [linkError, setLinkError] = useState<string | null>(null);
  const kind = noticeKind(dossier.status);

  useEffect(() => {
    let live = true;
    apiFetch<CitizenHandoff>(`/api/cases/${encodeURIComponent(dossier.id)}/citizen-handoff`)
      .then((handoff) => live && setLoad({ state: "ready", handoff }))
      .catch(
        (err: unknown) =>
          live &&
          setLoad({
            state: "error",
            message:
              err instanceof ApiRequestError ? err.message : "Messaggio non disponibile. Riprova.",
          }),
      );
    return () => {
      live = false;
    };
  }, [dossier.id, attempt]);

  async function newLink() {
    setLinkStep("pending");
    setLinkError(null);
    try {
      const issued = await apiFetch<RegenerateLinkResponse>(
        `/api/cases/${encodeURIComponent(dossier.id)}/link`,
        { method: "POST" },
      );
      setLink(issued.url);
      setLinkStep("idle");
      onRecorded();
    } catch (err) {
      setLinkError(err instanceof ApiRequestError ? err.message : "Link non creato. Riprova.");
      setLinkStep("confirm");
    }
  }

  if (!kind)
    return (
      <Notice tone="info">
        La pratica non aspetta niente dal cittadino: l&apos;avviso serve quando chiedi
        un&apos;integrazione o quando la pratica è pronta.
      </Notice>
    );
  if (load.state === "loading")
    return (
      <div className="grid place-items-center py-10 text-ink-3">
        <Spinner label="Preparazione del messaggio" />
      </div>
    );
  if (load.state === "error")
    return (
      <Notice
        tone="danger"
        role="alert"
        title={load.message}
        action={
          <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Riprova
          </Button>
        }
      />
    );

  const { handoff } = load;
  const text = noticeText(handoff, kind, link ?? undefined);
  const phone = dossier.citizen.phone;
  const record = (channel: CitizenHandoffChannel) =>
    void recordHandoff(dossier.id, channel).then(onRecorded);

  return (
    <div className="grid gap-5">
      <div
        className="max-h-72 overflow-y-auto rounded-md bg-sunk p-4 text-body-sm"
        aria-label="Anteprima del messaggio"
        role="region"
        tabIndex={0}
      >
        {text.split("\n\n").map((paragraph, index) => {
          const lang = index === 0 ? handoff.language : "it";
          return (
            <p
              key={index}
              lang={lang}
              dir={directionOf(lang)}
              className="whitespace-pre-line not-first:mt-3 not-first:border-t not-first:border-line not-first:pt-3"
            >
              {paragraph}
            </p>
          );
        })}
      </div>

      {link ? (
        <Notice tone="ok" title="Nuovo link aggiunto al messaggio">
          Il link precedente non funziona più.
        </Notice>
      ) : linkStep === "idle" ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setLinkStep("confirm")}
        >
          <Link2 className="size-4" aria-hidden />
          Il cittadino ha perso il link? Aggiungine uno nuovo
        </Button>
      ) : (
        <Notice
          tone="warn"
          role={linkError ? "alert" : undefined}
          title={linkError ?? "Il link attuale smetterà subito di funzionare."}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" loading={linkStep === "pending"} onClick={() => void newLink()}>
                Crea il nuovo link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLinkStep("idle")}>
                Annulla
              </Button>
            </div>
          }
        >
          Risposte e documenti restano dove sono.
        </Notice>
      )}

      {!phone && (
        <p className="text-sm text-ink-3">
          Il cittadino non ha lasciato un telefono: scegli il contatto in WhatsApp o copia il
          messaggio.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild size="lg" className="sm:col-span-2">
          <a
            href={whatsappHref(phone, text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => record("whatsapp")}
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
        </Button>
        <Button variant="secondary" asChild>
          <a href={smsHref(phone, text)} onClick={() => record("sms")}>
            <Smartphone className="size-4" aria-hidden />
            SMS
          </a>
        </Button>
        <span onClickCapture={() => record("copy")} className="grid">
          <CopyButton
            value={text}
            className="w-full"
            labels={{
              copy: "Copia il messaggio",
              copied: "Messaggio copiato",
              failed: "Copia non riuscita: seleziona il testo e copialo a mano.",
            }}
          />
        </span>
      </div>
    </div>
  );
}
