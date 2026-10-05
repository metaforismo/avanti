"use client";

import { Check, Copy, Printer } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
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
                  <CopyButton value={link} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      {copied ? (
        <Check className="size-4 text-ok" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      {copied ? "Copiato" : "Copia link"}
    </Button>
  );
}
