"use client";

import type { Language } from "@avanti/contracts";
import { CopyButton } from "@/components/ui/copy-button";
import { FullscreenQr } from "@/components/ui/fullscreen-qr";
import { QrCode } from "@/components/ui/qr-code";

/**
 * Messages sent with the link: Italian always, plus the citizen's language so they understand
 * it. Terms and register follow docs/decisions/citizen-copy.md.
 */
const MESSAGES: Record<"invite" | "renewed", Record<Language, string>> = {
  invite: {
    it: "Per preparare la tua pratica al CAF apri questo link dal telefono:",
    en: "To prepare your application at the CAF, open this link on your phone:",
    fr: "Pour préparer votre demande au CAF, ouvrez ce lien sur votre téléphone :",
    es: "Para preparar tu trámite en el CAF, abre este enlace en el móvil:",
    ro: "Ca să îți pregătești cererea la CAF, deschide acest link pe telefon:",
    uk: "Щоб підготувати свою заяву в CAF, відкрийте це посилання на телефоні:",
    ar: "لتحضير طلبك في الـ CAF، افتح هذا الرابط على هاتفك:",
    bn: "CAF-এ আপনার আবেদন প্রস্তুত করতে ফোনে এই লিংকটি খুলুন:",
  },
  renewed: {
    it: "Ecco il nuovo link per la tua pratica al CAF (quello vecchio non funziona più):",
    en: "Here is the new link for your application at the CAF (the old one no longer works):",
    fr: "Voici le nouveau lien pour votre demande au CAF (l'ancien ne fonctionne plus) :",
    es: "Aquí tienes el nuevo enlace para tu trámite en el CAF (el anterior ya no funciona):",
    ro: "Iată noul link pentru cererea ta la CAF (cel vechi nu mai funcționează):",
    uk: "Ось нове посилання на Вашу заяву в CAF (старе більше не працює):",
    ar: "هذا هو الرابط الجديد لطلبك في الـ CAF (الرابط القديم لم يعد يعمل):",
    bn: "CAF-এ আপনার আবেদনের নতুন লিংক এখানে (পুরোনোটি আর কাজ করে না):",
  },
};

export function shareMessage(kind: keyof typeof MESSAGES, language: Language, link: string) {
  const lines = [MESSAGES[kind].it];
  if (language !== "it") lines.push(MESSAGES[kind][language]);
  return `${lines.join("\n")}\n${link}`;
}

/**
 * QR, link and a ready-made message to hand a citizen their personal link. Only by QR or copy:
 * a link inside a `wa.me/?text=` or `sms:` address stays in the browser history (and its sync)
 * of a desk PC that colleagues share, so WhatsApp and SMS get the message pasted by the operator.
 */
export function ShareCitizenLink({
  link,
  reference,
  language,
  phone,
  kind = "invite",
}: {
  link: string;
  reference: string;
  language: Language;
  phone?: string;
  kind?: keyof typeof MESSAGES;
}) {
  const message = shareMessage(kind, language, link);
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 rounded-lg bg-sunk p-4 sm:grid-cols-[8rem_1fr] sm:items-center">
        <QrCode
          value={link}
          label="QR code del link per il cittadino"
          className="w-32 rounded-sm bg-white p-1 [&_svg]:size-full"
        />
        <div className="min-w-0">
          <p className="text-sm text-ink-3">Pratica {reference}</p>
          <p className="mt-1 font-mono text-xs break-all text-ink-2" translate="no">
            {link}
          </p>
          <div className="mt-3">
            <FullscreenQr
              value={link}
              title="Inquadra con la fotocamera del telefono"
              caption="Si apre la tua pratica: scegli la lingua e rispondi alle domande."
            />
          </div>
          <p className="mt-2 text-sm text-ink-3">
            Il link è personale: non condividerlo con altri.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <CopyButton
            value={message}
            showValueOnFailure={false}
            variant="primary"
            className="w-full"
            labels={{
              copy: "Copia il messaggio",
              copied: "Messaggio copiato",
              failed: "Copia non riuscita: seleziona il link e copialo a mano.",
            }}
          />
          <CopyButton
            value={link}
            showValueOnFailure={false}
            variant="secondary"
            className="w-full"
          />
        </div>
        <p className="text-sm text-ink-3">
          Per WhatsApp o SMS copia il messaggio e incollalo nella chat del cittadino
          {phone ? <span translate="no"> ({phone})</span> : null}. Un link personale non passa da
          indirizzi WhatsApp o SMS, che restano nella cronologia del browser.
        </p>
      </div>
    </div>
  );
}
