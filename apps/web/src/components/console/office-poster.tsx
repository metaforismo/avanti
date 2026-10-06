"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Office, OrganizationPublic } from "@avanti/contracts";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/ui/qr-code";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";

const HEADLINES = [
  { lang: "en", text: "Prepare your application on your phone" },
  { lang: "fr", text: "Préparez votre demande depuis votre téléphone" },
  { lang: "es", text: "Prepara tu trámite desde el móvil" },
  { lang: "ro", text: "Pregătește-ți cererea de pe telefon" },
  { lang: "uk", text: "Підготуйте свою заяву з телефона" },
  { lang: "ar", text: "حضّر طلبك من هاتفك", dir: "rtl" },
  { lang: "bn", text: "ফোন থেকেই আপনার আবেদন প্রস্তুত করুন" },
] as const;

/** A4 poster for the waiting room: one QR, eight languages, three steps. */
export function OfficePoster({ officeSlug }: { officeSlug: string }) {
  const [data, setData] = useState<
    { office: Office; organization: OrganizationPublic } | "error" | null
  >(null);
  const [link, setLink] = useState("");

  useEffect(() => {
    apiFetch<{ office: Office; organization: OrganizationPublic }>(
      `/api/offices/${encodeURIComponent(officeSlug)}`,
    )
      .then((result) => {
        setData(result);
        setLink(`${window.location.origin}/s/${result.office.slug}`);
      })
      .catch(() => setData("error"));
  }, [officeSlug]);

  if (data === null) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">
        <Spinner label="Preparazione del cartello" />
      </div>
    );
  }
  if (data === "error") {
    return (
      <div className="grid min-h-dvh place-items-center p-10 text-center">
        <div>
          <p className="font-display text-2xl font-semibold">Cartello non disponibile</p>
          <p className="mt-2 text-ink-2">
            Lo sportello non esiste o la connessione non è riuscita.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Riprova</Button>
            <Button asChild variant="secondary">
              <Link href="/console/sportelli">Torna agli sportelli</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 0 } @media print { body { background: #fff } }`}</style>
      <div className="flex justify-center gap-3 p-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Stampa
        </Button>
      </div>
      <article className="mx-auto flex aspect-[210/297] w-full max-w-[210mm] flex-col bg-white px-[14mm] py-[14mm] text-ink shadow-float print:max-w-none print:shadow-none">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="font-display text-[20pt] leading-tight font-bold">
              {data.organization.name}
            </p>
            <p className="text-[12pt] text-ink-2">{data.office.name}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[10pt] text-ink-3">
            <LogoMark className="size-5" />
            Avanti
          </span>
        </header>

        <h1 className="mt-[10mm] font-display text-[40pt] leading-[0.98] font-bold tracking-[-0.03em] [font-stretch:88%]">
          Prepara la tua pratica dal telefono
        </h1>
        <ul className="mt-[5mm] grid grid-cols-2 gap-x-6 gap-y-1 text-[11.5pt] text-ink-2">
          {HEADLINES.map((h) => (
            <li key={h.lang} lang={h.lang} dir={"dir" in h ? h.dir : "ltr"}>
              {h.text}
            </li>
          ))}
        </ul>

        <div className="mt-[8mm] flex flex-1 items-center gap-[10mm]">
          <QrCode
            value={link}
            label="QR per iniziare la pratica"
            className="w-[78mm] shrink-0 [&_svg]:size-full"
          />
          <ol className="grid gap-[6mm] text-[15pt]">
            {[
              "Inquadra il QR con la fotocamera",
              "Scegli la tua lingua",
              "Rispondi e fotografa i documenti",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="grid size-[9mm] shrink-0 place-items-center rounded-full bg-stamp font-display text-[13pt] font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5 font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <footer className="mt-[8mm] border-t border-line pt-[5mm] text-[10.5pt] text-ink-2">
          <p>
            Non serve registrarsi. Ti guida un assistente automatico basato su intelligenza
            artificiale; un operatore del CAF controlla tutto prima di fare la pratica.
          </p>
          <p className="mt-1 font-mono text-[9pt] text-ink-3">{link}</p>
        </footer>
      </article>
    </>
  );
}
