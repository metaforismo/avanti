"use client";

import { Field, Input } from "@/components/ui/field";

export type CodeKind = "totp" | "recovery";

/** Six digits from the app, or a recovery code; spaces and dashes typed by hand are tolerated. */
export function normalizeCode(raw: string, kind: CodeKind) {
  if (kind === "totp") return raw.replace(/\s+/g, "");
  const hex = raw.replace(/[\s-]+/g, "").toLowerCase();
  return hex.length === 32 ? (hex.match(/.{8}/g) ?? []).join("-") : raw.trim();
}

export function codeError(code: string, kind: CodeKind) {
  if (kind === "totp")
    return /^\d{6}$/.test(code) ? undefined : "Scrivi le 6 cifre che vedi nell'app.";
  return /^[a-f\d]{8}(-[a-f\d]{8}){3}$/.test(code)
    ? undefined
    : "Il codice di recupero ha 32 caratteri, come quello che hai salvato.";
}

export function CodeField({
  kind,
  error,
  autoFocus = false,
  label,
}: {
  kind: CodeKind;
  error?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  return (
    <Field
      label={label ?? (kind === "totp" ? "Codice dell'app" : "Codice di recupero")}
      hint={
        kind === "totp"
          ? "Cambia ogni 30 secondi: usa quello che vedi adesso."
          : "Ogni codice di recupero funziona una sola volta."
      }
      error={error}
    >
      {(p) =>
        kind === "totp" ? (
          <Input
            {...p}
            key="totp"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            spellCheck={false}
            autoFocus={autoFocus}
            className="tabular h-12 text-xl tracking-[0.3em]"
          />
        ) : (
          <Input
            {...p}
            key="recovery"
            name="code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            translate="no"
            autoFocus={autoFocus}
            className="font-code text-sm"
          />
        )
      }
    </Field>
  );
}
