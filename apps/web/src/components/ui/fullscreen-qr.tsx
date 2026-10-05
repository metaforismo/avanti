"use client";

import { Maximize2, X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import { Button } from "./button";
import { QrCode } from "./qr-code";

/** Big QR on the operator's screen, for the citizen sitting at the desk to scan. */
export function FullscreenQr({
  value,
  title,
  caption,
}: {
  value: string;
  title: string;
  caption: string;
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Maximize2 className="size-4" aria-hidden />
          Mostra al cittadino
        </Button>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className="fixed inset-0 z-[60] grid animate-fade-in place-items-center bg-white p-6 outline-none">
          <div className="grid max-w-lg justify-items-center gap-6 text-center">
            <Primitive.Title className="font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              {title}
            </Primitive.Title>
            <QrCode value={value} label={title} className="w-[min(70vw,24rem)] [&_svg]:size-full" />
            <Primitive.Description className="text-lg text-ink-2">{caption}</Primitive.Description>
          </div>
          <Primitive.Close asChild>
            <Button variant="secondary" className="fixed top-4 right-4" aria-label="Chiudi">
              <X className="size-4" aria-hidden />
              Chiudi
            </Button>
          </Primitive.Close>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
