"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { MfaRecoveryCodesResponse, MfaStatus } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useReloadOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { CodeField, codeError, normalizeCode, type CodeKind } from "./code-field";
import { RecoveryCodes } from "./recovery-codes";
import { MfaSetupFlow } from "./setup-flow";

type Mode = "idle" | "setup" | "regenerate" | "disable" | { codes: string[] };

export function MfaAccountSection() {
  const status = useResource<MfaStatus>("/api/auth/mfa/status");
  const reloadOperator = useReloadOperator();
  const [mode, setMode] = useState<Mode>("idle");
  const [notice, setNotice] = useState<string | null>(null);

  const finish = (text: string | null) => {
    setMode("idle");
    setNotice(text);
    void status.reload();
    void reloadOperator();
  };

  return (
    <section className="mt-10" aria-labelledby="mfa-title">
      <h2 id="mfa-title" className="font-display text-xl font-semibold">
        Verifica in due passaggi
      </h2>
      <p className="mt-1 mb-5 max-w-2xl text-ink-2">
        Oltre alla password, all&apos;accesso chiede un codice dall&apos;app sul tuo telefono. Se
        qualcuno scopre la password, senza il telefono non entra nei fascicoli delle famiglie.
      </p>
      {notice && (
        <p role="status" className="mb-5 rounded-md bg-ok-wash px-4 py-3 text-ok">
          {notice}
        </p>
      )}
      {status.status === "error" && !status.data ? (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {status.error.message}
        </p>
      ) : !status.data ? (
        <Spinner label="Caricamento" />
      ) : typeof mode === "object" ? (
        <RecoveryCodes
          codes={mode.codes}
          doneLabel="Fatto"
          onDone={() => finish("Nuovi codici di recupero salvati. Quelli vecchi non valgono più.")}
        />
      ) : mode === "setup" ? (
        <MfaSetupFlow
          doneLabel="Fatto"
          onDone={() => finish(null)}
          onCancel={() => setMode("idle")}
        />
      ) : mode === "regenerate" || mode === "disable" ? (
        <SensitiveForm
          mode={mode}
          onCancel={() => setMode("idle")}
          onDone={(codes) =>
            codes ? setMode({ codes }) : finish("Verifica in due passaggi disattivata.")
          }
        />
      ) : status.data.enabled ? (
        <Enabled
          status={status.data}
          onRegenerate={() => {
            setNotice(null);
            setMode("regenerate");
          }}
          onDisable={() => {
            setNotice(null);
            setMode("disable");
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-surface p-5 ring-1 ring-line">
          <ShieldAlert className="size-6 shrink-0 text-warn" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">Non attiva.</span>{" "}
            <span className="text-ink-2">Serve un&apos;app di autenticazione sul telefono.</span>
          </p>
          <Button
            onClick={() => {
              setNotice(null);
              setMode("setup");
            }}
          >
            Attiva
          </Button>
        </div>
      )}
    </section>
  );
}

function Enabled({
  status,
  onRegenerate,
  onDisable,
}: {
  status: MfaStatus;
  onRegenerate: () => void;
  onDisable: () => void;
}) {
  const few = status.recoveryCodesRemaining <= 3;
  return (
    <div className="grid gap-4 rounded-lg bg-surface p-5 ring-1 ring-line">
      <p className="flex items-center gap-3">
        <ShieldCheck className="size-6 shrink-0 text-ok" aria-hidden />
        <span>
          <span className="font-semibold">Attiva.</span>{" "}
          <span className={few ? "text-warn" : "text-ink-2"}>
            {status.recoveryCodesRemaining === 1
              ? "Ti resta 1 codice di recupero."
              : `Ti restano ${status.recoveryCodesRemaining} codici di recupero.`}
            {few && " Creane di nuovi."}
          </span>
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onRegenerate}>
          Nuovi codici di recupero
        </Button>
        {status.required ? (
          <p className="self-center text-sm text-ink-3">
            Il tuo CAF la richiede per tutti: non si può disattivare.
          </p>
        ) : (
          <Button variant="danger" onClick={onDisable}>
            Disattiva
          </Button>
        )}
      </div>
    </div>
  );
}

function SensitiveForm({
  mode,
  onCancel,
  onDone,
}: {
  mode: "regenerate" | "disable";
  onCancel: () => void;
  onDone: (codes?: string[]) => void;
}) {
  const [kind, setKind] = useState<CodeKind>("totp");
  const [errors, setErrors] = useState<{ password?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const code = normalizeCode(String(data.get("code") ?? ""), kind);
    const next = {
      password: currentPassword ? undefined : "Scrivi la tua password.",
      code: codeError(code, kind),
    };
    setErrors(next);
    setFormError(null);
    if (next.password || next.code) {
      (
        form.elements.namedItem(next.password ? "currentPassword" : "code") as HTMLElement | null
      )?.focus();
      return;
    }
    setPending(true);
    try {
      const path =
        mode === "disable" ? "/api/auth/mfa/disable" : "/api/auth/mfa/recovery-codes/regenerate";
      const result = await apiFetch<MfaRecoveryCodesResponse | { ok: true }>(path, {
        method: "POST",
        body: { currentPassword, code },
      });
      onDone("recoveryCodes" in result ? result.recoveryCodes : undefined);
    } catch (err) {
      setPending(false);
      setFormError(
        err instanceof ApiRequestError && err.status === 401
          ? "Password o codice non corretti."
          : err instanceof ApiRequestError
            ? err.message
            : "Operazione non riuscita. Riprova.",
      );
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
      <p className="text-ink-2">
        {mode === "disable"
          ? "Per disattivarla conferma password e codice. Dopo, all'accesso basterà la password."
          : "I codici attuali smetteranno di funzionare. Conferma password e codice."}
      </p>
      <Field label="La tua password" error={errors.password}>
        {(p) => <PasswordInput {...p} name="currentPassword" autoComplete="current-password" />}
      </Field>
      <CodeField kind={kind} error={errors.code} />
      <button
        type="button"
        className="w-fit text-sm text-stamp underline underline-offset-2"
        onClick={() => setKind((k) => (k === "totp" ? "recovery" : "totp"))}
      >
        {kind === "totp" ? "Usa un codice di recupero" : "Usa il codice dell'app"}
      </button>
      {formError && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant={mode === "disable" ? "danger" : "primary"} loading={pending}>
          {mode === "disable" ? "Disattiva" : "Crea nuovi codici"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
