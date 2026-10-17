"use client";

import { BellRing, Link2, MessageCircle, Printer, Smartphone } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  whatsappNumber,
} from "@/lib/console/citizen-notice";
import { LANGUAGE_IT, timeAgo } from "@/lib/console/labels";

// Avanti only sees the button press: what it knows is that the message was prepared.
const CHANNEL_IT: Record<Exclude<CitizenHandoffChannel, "print">, string> = {
  whatsapp: "Avviso preparato su WhatsApp",
  sms: "Avviso preparato per SMS",
  copy: "Messaggio copiato",
};

export const printPath = (caseId: string) => `/console/stampa/${encodeURIComponent(caseId)}`;

/**
 * Records the channel. Resolves to an Italian message when the record failed (a 429 included):
 * the message itself already left, so the operator is told, never blocked.
 */
export async function recordHandoff(
  caseId: string,
  channel: CitizenHandoffChannel,
): Promise<string | null> {
  try {
    await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/citizen-handoff/events`, {
      method: "POST",
      body: { channel },
      keepalive: true,
    });
    return null;
  } catch (err) {
    return err instanceof ApiRequestError && err.status === 429
      ? `Avviso non registrato in cronologia: ${err.message}`
      : "Avviso non registrato in cronologia: scrivilo nelle note interne.";
  }
}

/** A new citizen link outlives the dialog: the old one is already dead. */
export type IssuedLink = { url: string; sent: boolean };

const coarsePointer = (notify: () => void) => {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

/**
 * In the citizen card: whether someone already prepared a notice, and the way to tell them.
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
            {CHANNEL_IT[told.channel]}
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
  link,
  onLinkChange,
  onClosedAfterChanges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dossier: CaseDossier;
  link: IssuedLink | null;
  onLinkChange: (link: IssuedLink) => void;
  /** Once per close, and only if something was recorded: each reload is an audited view. */
  onClosedAfterChanges: () => void;
}) {
  const changed = useRef(false);
  const language = LANGUAGE_IT[dossier.language].toLowerCase();

  // Leaving the page would lose the only working link: the browser asks first.
  useEffect(() => {
    if (!link || link.sent) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [link]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next && changed.current) {
          changed.current = false;
          onClosedAfterChanges();
        }
      }}
      title="Avvisa il cittadino"
      description={
        dossier.language === "it"
          ? "Il messaggio parte dal tuo WhatsApp o dal tuo telefono. Avanti registra solo che l'hai preparato."
          : `Messaggio in ${language} e in italiano. Parte dal tuo WhatsApp o dal tuo telefono; Avanti registra solo che l'hai preparato.`
      }
    >
      {open && (
        <NoticeBody
          dossier={dossier}
          link={link}
          onLinkChange={onLinkChange}
          onChanged={() => (changed.current = true)}
        />
      )}
    </Dialog>
  );
}

function NoticeBody({
  dossier,
  link,
  onLinkChange,
  onChanged,
}: {
  dossier: CaseDossier;
  link: IssuedLink | null;
  onLinkChange: (link: IssuedLink) => void;
  onChanged: () => void;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [linkStep, setLinkStep] = useState<"idle" | "confirm" | "pending">("idle");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const touch = useSyncExternalStore(
    coarsePointer,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

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
      onLinkChange({ url: issued.url, sent: false });
      onChanged();
      setLinkStep("idle");
    } catch (err) {
      setLinkError(err instanceof ApiRequestError ? err.message : "Link non creato. Riprova.");
      setLinkStep("confirm");
    }
  }

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
  // The case as the server sees it now, not as this page last loaded it.
  const kind = noticeKind(handoff.status);
  if (!kind)
    return (
      <Notice tone="info">
        La pratica non aspetta niente dal cittadino: l&apos;avviso serve quando chiedi
        un&apos;integrazione o quando la pratica è pronta.
      </Notice>
    );

  const text = noticeText(handoff, kind, link?.url);
  const phone = dossier.citizen.phone;
  const number = whatsappNumber(phone);
  const record = (channel: CitizenHandoffChannel) => {
    onChanged();
    if (link && !link.sent) onLinkChange({ ...link, sent: true });
    void recordHandoff(dossier.id, channel).then(setRecordError);
  };

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
        <Notice tone="ok" title="Nuovo link nel messaggio: si invia copiandolo">
          Il link precedente non funziona più. Un link personale non passa da indirizzi WhatsApp o
          SMS, che restano nella cronologia del browser: copia il messaggio e incollalo nella chat
          del cittadino. Il link resta qui finché non lasci la pagina.
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

      {!link && !number && (
        <p className="text-sm text-ink-3">
          {phone
            ? "Il numero lasciato dal cittadino non sembra completo: in WhatsApp scegli tu la chat."
            : "Il cittadino non ha lasciato un telefono: in WhatsApp scegli tu la chat, oppure copia il messaggio."}
        </p>
      )}
      {recordError && (
        <Notice tone="warn" role="alert">
          {recordError}
        </Notice>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {!link && (
          <Button asChild size="lg" className="sm:col-span-2">
            <a
              href={whatsappHref(phone, text)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => record("whatsapp")}
            >
              <MessageCircle className="size-4" aria-hidden />
              {number ? `WhatsApp a +${number}` : "WhatsApp"}
            </a>
          </Button>
        )}
        {/* A desk PC has no SMS app, and a long bilingual text costs several messages. */}
        {!link && touch && (
          <Button variant="secondary" asChild>
            <a href={smsHref(phone, text)} onClick={() => record("sms")}>
              <Smartphone className="size-4" aria-hidden />
              SMS
            </a>
          </Button>
        )}
        <div className={link || !touch ? "grid sm:col-span-2" : "grid"}>
          <CopyButton
            value={text}
            size={link ? "lg" : undefined}
            variant={link ? "primary" : "secondary"}
            className="w-full"
            onCopied={() => record("copy")}
            labels={{
              copy: "Copia il messaggio",
              copied: "Messaggio copiato",
              failed: "Copia non riuscita: seleziona il testo e copialo a mano.",
            }}
          />
        </div>
      </div>
    </div>
  );
}
