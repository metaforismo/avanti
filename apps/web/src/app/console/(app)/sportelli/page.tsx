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
import { markFirstStep } from "@/lib/console/first-steps";
import { officePlace } from "@/lib/office-place";
import { useOperator } from "@/lib/console/operator-context";
import { PANEL } from "@/components/console/admin/panel";
import { cn } from "@/lib/cn";

const subscribe = () => () => {};

export default function OfficesPage() {
  const operator = useOperator();
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Sportelli e QR"
        lead={
          <>
            Il cartello con il QR va in sala d&apos;attesa: chi aspetta inizia la pratica dal
            telefono.
          </>
        }
      />

      {/* One row per office: its QR at print size, then where it is, its link and what to do. */}
      <ul className={cn(PANEL, "mt-6 divide-y divide-line")}>
        {operator.offices.map((office) => {
          const link = origin ? `${origin}/s/${office.slug}` : "";
          return (
            <li
              key={office.id}
              className="grid gap-5 p-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start lg:grid-cols-[7rem_minmax(0,1fr)_16rem]"
            >
              <div className="size-28 shrink-0 rounded-sm border border-line bg-white p-2">
                {link ? (
                  <QrCode
                    value={link}
                    label={`QR dello sportello ${office.name}`}
                    className="[&_svg]:size-full"
                  />
                ) : (
                  <Skeleton className="aspect-square rounded-xs" />
                )}
              </div>
              <div className="grid min-w-0 gap-3">
                <div className="min-w-0">
                  <h2 className="text-base leading-snug font-semibold [overflow-wrap:anywhere]">
                    {office.name}
                  </h2>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-3">{officePlace(office)}</p>
                </div>
                <input
                  readOnly
                  dir="ltr"
                  value={link}
                  aria-label={`Link pubblico di ${office.name}`}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-8 w-full max-w-xl min-w-0 truncate rounded-xs border border-line bg-sunk/60 px-3 font-mono text-[0.8125rem] text-ink-2 outline-none focus:ring-2 focus:ring-stamp"
                />
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      href={`/stampa/${office.slug}`}
                      target="_blank"
                      onClick={() => markFirstStep(operator.id, "poster")}
                    >
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
              {/* What the citizen reads on the poster beside the QR, to check before printing. */}
              <div className="grid content-start gap-3 text-sm sm:col-start-2 lg:col-start-3">
                <dl className="grid gap-3">
                  <div>
                    <dt className="text-[0.8125rem] text-ink-3">Orari</dt>
                    <dd className={office.openingHours ? "text-ink" : "text-ink-3"}>
                      {office.openingHours || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.8125rem] text-ink-3">Telefono</dt>
                    <dd className={cn("tabular", office.phone ? "text-ink" : "text-ink-3")}>
                      {office.phone || "—"}
                    </dd>
                  </div>
                </dl>
                {operator.role === "admin" && (
                  <Link
                    href="/console/impostazioni#sportelli"
                    className="w-fit text-[0.8125rem] font-semibold text-stamp hover:underline"
                  >
                    Modifica nelle impostazioni
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
