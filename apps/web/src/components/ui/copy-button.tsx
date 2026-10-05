"use client";

import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";
import { Button, type ButtonProps } from "./button";

type Labels = { copy: string; copied: string; failed: string };

const ITALIAN: Labels = {
  copy: "Copia link",
  copied: "Link copiato",
  failed: "Copia non riuscita: seleziona il link e copialo a mano.",
};

/**
 * Copies a value and says so out loud (role=status). When the clipboard is unavailable
 * (insecure context, permissions) it reveals the value, selected, so it can be copied by hand.
 */
export function CopyButton({
  value,
  labels = ITALIAN,
  showValueOnFailure = true,
  ...props
}: Omit<ButtonProps, "onClick" | "value"> & {
  value: string;
  labels?: Labels;
  showValueOnFailure?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const fallbackId = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2400);
    } catch {
      setState("failed");
      requestAnimationFrame(() =>
        (document.getElementById(fallbackId) as HTMLInputElement | null)?.select(),
      );
    }
  }

  return (
    <span className="inline-grid gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={!value}
        onClick={() => void copy()}
        {...props}
      >
        {state === "copied" ? (
          <Check className="size-4 text-ok" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        {state === "copied" ? labels.copied : labels.copy}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? labels.copied : ""}
      </span>
      {state === "failed" && showValueOnFailure && (
        <span className="grid gap-1">
          <span className="text-sm text-danger">{labels.failed}</span>
          <input
            id={fallbackId}
            readOnly
            value={value}
            dir="ltr"
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 w-full rounded-sm bg-surface px-2 font-mono text-xs ring-1 ring-line-strong ring-inset"
          />
        </span>
      )}
    </span>
  );
}
