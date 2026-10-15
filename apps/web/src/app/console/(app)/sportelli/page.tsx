"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FullscreenQr } from "@/components/ui/fullscreen-qr";
import { CopyButton } from "@/components/ui/copy-button";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { QrCode } from "@/components/ui/qr-code";
import { Skeleton } from "@/components/ui/skeleton";
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
    <PageContainer width="5xl">
      <PageHeader
        title="Sportelli e QR"
        lead={
          <>
            Ogni sportello ha un link pubblico. Stampa il cartello con il QR e mettilo in sala
            d&apos;attesa: chi aspetta può iniziare a preparare la pratica dal telefono.
          </>
        }
      />

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
                  <Skeleton className="aspect-square rounded-sm" />
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
    </PageContainer>
  );
}
