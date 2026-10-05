"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FullscreenQr } from "@/components/ui/fullscreen-qr";
import { CopyButton } from "@/components/ui/copy-button";
import { QrCode } from "@/components/ui/qr-code";
import { useOperator } from "@/lib/console/operator-context";

const subscribe = () => () => {};

export default function OfficesPage() {
  const operator = useOperator();
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Sportelli e QR</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">
        Ogni sportello ha un link pubblico. Stampa il cartello con il QR e mettilo in sala
        d&apos;attesa: chi aspetta può iniziare a preparare la pratica dal telefono.
      </p>

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {operator.offices.map((office) => {
          const link = origin ? `${origin}/s/${office.slug}` : "";
          return (
            <li key={office.id} className="flex gap-5 rounded-lg bg-surface p-5 ring-1 ring-line">
              <div className="w-28 shrink-0">
                {link ? (
                  <QrCode
                    value={link}
                    label={`QR dello sportello ${office.name}`}
                    className="rounded-sm bg-white [&_svg]:size-full"
                  />
                ) : (
                  <div className="aspect-square animate-pulse rounded-sm bg-sunk" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-semibold">{office.name}</h2>
                <p className="text-ink-2">
                  {office.address}, {office.city}
                </p>
                <p className="mt-2 truncate font-mono text-xs text-ink-3">{link}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/stampa/${office.slug}`} target="_blank">
                      <Printer className="size-4" aria-hidden />
                      Stampa il cartello
                    </Link>
                  </Button>
                  <CopyButton value={link} size="sm" />
                  {link && (
                    <FullscreenQr
                      value={link}
                      title="Prepara la tua pratica dal telefono"
                      caption={`${office.name}: inquadra il QR, scegli la lingua e inizia.`}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
