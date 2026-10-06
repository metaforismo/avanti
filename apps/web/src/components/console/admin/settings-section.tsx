"use client";

import { useState, type FormEvent } from "react";
import type { OrganizationSettings } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useResource } from "@/lib/console/use-resource";

const LIMITS = {
  baselineMinutesPerCase: { min: 1, max: 600 },
  linkDays: { min: 1, max: 365 },
  retentionDays: { min: 30, max: 3650 },
} as const;

type Key = keyof typeof LIMITS;

export function SettingsSection() {
  const settings = useResource<OrganizationSettings>("/api/settings");

  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title" className="font-display text-xl font-semibold">
        Parametri
      </h2>
      <p className="mt-1 text-ink-2">
        Valgono per tutto il CAF e per le pratiche create da adesso.
      </p>
      {settings.status === "error" && !settings.data ? (
        <p className="mt-4 text-danger">Parametri non disponibili: {settings.error.message}</p>
      ) : !settings.data ? (
        <div className="mt-4 h-40 animate-pulse rounded-lg bg-sunk" aria-hidden />
      ) : (
        <SettingsForm initial={settings.data} onSaved={settings.setData} />
      )}
    </section>
  );
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: OrganizationSettings;
  onSaved: (settings: OrganizationSettings) => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;
    const data = new FormData(event.currentTarget);
    const read = (key: Key) => String(data.get(key) ?? "").trim();
    const next: typeof errors = {};
    const values: Partial<OrganizationSettings> = {};
    for (const key of Object.keys(LIMITS) as Key[]) {
      const raw = read(key);
      if (key === "baselineMinutesPerCase" && raw === "") {
        values.baselineMinutesPerCase = null;
        continue;
      }
      const n = Number(raw);
      const { min, max } = LIMITS[key];
      if (!Number.isInteger(n) || n < min || n > max)
        next[key] = `Un numero intero tra ${min} e ${max}.`;
      else values[key] = n;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setState("saving");
    setFormError(null);
    try {
      onSaved(
        await apiFetch<OrganizationSettings>("/api/settings", { method: "PATCH", body: values }),
      );
      setState("saved");
    } catch (error) {
      setState("idle");
      setFormError(
        error instanceof ApiRequestError ? error.message : "Salvataggio non riuscito. Riprova.",
      );
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      onChange={() => state === "saved" && setState("idle")}
      className="mt-4 grid gap-5 rounded-lg bg-surface p-5 ring-1 ring-line"
    >
      <Field
        label="Minuti per pratica prima di Avanti"
        optional="facoltativo"
        hint="Misuratelo su una settimana di lavoro normale: serve alle metriche per calcolare il tempo risparmiato. Vuoto finché non lo avete misurato."
        error={errors.baselineMinutesPerCase}
      >
        {(p) => (
          <Input
            {...p}
            name="baselineMinutesPerCase"
            inputMode="numeric"
            defaultValue={initial.baselineMinutesPerCase ?? ""}
            className="tabular max-w-32"
          />
        )}
      </Field>
      <Field
        label="Validità dei link per i cittadini (giorni)"
        hint="Dopo questo periodo il link non funziona più e il cittadino deve chiederne uno nuovo."
        error={errors.linkDays}
      >
        {(p) => (
          <Input
            {...p}
            name="linkDays"
            inputMode="numeric"
            defaultValue={initial.linkDays}
            className="tabular max-w-32"
          />
        )}
      </Field>
      <Field
        label="Conservazione dei fascicoli (giorni)"
        hint="Dopo la chiusura o la scadenza, per quanto Avanti conserva dati e documenti. Non riguarda l'archivio del vostro gestionale."
        error={errors.retentionDays}
      >
        {(p) => (
          <Input
            {...p}
            name="retentionDays"
            inputMode="numeric"
            defaultValue={initial.retentionDays}
            className="tabular max-w-32"
          />
        )}
      </Field>
      {formError && (
        <p role="alert" className="rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={state === "saving"}>
          Salva parametri
        </Button>
        <span role="status" className="text-sm text-ok">
          {state === "saved" ? "Salvati" : ""}
        </span>
      </div>
    </form>
  );
}
