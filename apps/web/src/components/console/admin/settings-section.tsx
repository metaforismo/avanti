"use client";

import { useState, type FormEvent } from "react";
import type { OrganizationSettings } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { focusFirstError } from "@/lib/validation";

const LIMITS = {
  baselineMinutesPerCase: { min: 1, max: 600 },
  aiMonthlyBudgetEur: { min: 0, max: 100000 },
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
  // Requiring it before having it would lock the admin out of the console until set up.
  const canRequireMfa = useOperator().mfaEnabled;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;
    const data = new FormData(event.currentTarget);
    const read = (key: Key) => String(data.get(key) ?? "").trim();
    const next: typeof errors = {};
    const values: Partial<OrganizationSettings> = {};
    for (const key of Object.keys(LIMITS) as Key[]) {
      const raw = read(key);
      // Empty means "not set": no baseline yet, or the server's default AI budget.
      if ((key === "baselineMinutesPerCase" || key === "aiMonthlyBudgetEur") && raw === "") {
        values[key] = null;
        continue;
      }
      const n = Number(raw);
      const { min, max } = LIMITS[key];
      if (!Number.isInteger(n) || n < min || n > max)
        next[key] = `Un numero intero tra ${min} e ${max}.`;
      else values[key] = n;
    }
    values.notifyCitizenReady = data.get("notifyCitizenReady") === "on";
    values.notifyCitizenSubmission = data.get("notifyCitizenSubmission") === "on";
    values.notifyOperatorDigest = data.get("notifyOperatorDigest") === "on";
    values.notifyCitizenReminders = data.get("notifyCitizenReminders") === "on";
    values.aiCopilot = data.get("aiCopilot") === "on";
    values.aiCitizenAssistant = data.get("aiCitizenAssistant") === "on";
    const first = Number(data.get("reminderFirst"));
    const second = Number(data.get("reminderSecond"));
    values.citizenReminderDays = second ? [first, second] : [first];
    // A disabled checkbox is not submitted: leave the policy untouched rather than turning it off.
    if (canRequireMfa) values.mfaRequired = data.get("mfaRequired") === "on";
    setErrors(next);
    if (focusFirstError(event.currentTarget, next)) return;
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
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">Avvisi via email</legend>
        <Toggle
          name="notifyCitizenSubmission"
          defaultChecked={initial.notifyCitizenSubmission}
          label="Ricevuta al cittadino quando invia la pratica"
          hint="Va all'email che il cittadino scrive, nella sua lingua: codice della pratica, sportello e cosa succede adesso. Nessun link e nessun dato dei documenti; al massimo due al giorno per indirizzo."
        />
        <Toggle
          name="notifyCitizenReady"
          defaultChecked={initial.notifyCitizenReady}
          label="Avvisa il cittadino quando la pratica è pronta"
          hint="Solo se ha lasciato l'email, nella sua lingua: gli dice di prendere appuntamento allo sportello. Le richieste di integrazione gli arrivano sempre."
        />
        <Toggle
          name="notifyOperatorDigest"
          defaultChecked={initial.notifyOperatorDigest}
          label="Riepilogo giornaliero agli operatori"
          hint="Quante pratiche aspettano la revisione, senza dati dei cittadini."
        />
        <Toggle
          name="notifyCitizenReminders"
          defaultChecked={initial.notifyCitizenReminders}
          label="Ricorda al cittadino l'integrazione richiesta"
          hint="Se dopo qualche giorno non ha ancora risposto, gli arriva un promemoria nella sua lingua (solo se ha lasciato l'email). Si ferma appena risponde o la pratica cambia stato."
        />
        <div className="flex flex-wrap gap-4 ps-3">
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Primo promemoria dopo</span>
            <Select
              name="reminderFirst"
              defaultValue={String(initial.citizenReminderDays[0] ?? 3)}
              compact
            >
              {[2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>
                  {d} giorni
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-ink-2">Secondo promemoria</span>
            <Select
              name="reminderSecond"
              defaultValue={String(initial.citizenReminderDays[1] ?? 0)}
              compact
            >
              <option value="0">Nessuno</option>
              {[3, 4, 7].map((d) => (
                <option key={d} value={d}>
                  dopo altri {d} giorni
                </option>
              ))}
            </Select>
          </label>
        </div>
      </fieldset>
      <Field
        label="Budget mensile per l'intelligenza artificiale (€)"
        optional="facoltativo"
        hint="Oltre questa cifra nel mese Avanti continua con le regole, senza AI, e lo segnala. Vuoto: il valore predefinito del server. I consumi sono nella pagina Intelligenza artificiale."
        error={errors.aiMonthlyBudgetEur}
      >
        {(p) => (
          <Input
            {...p}
            name="aiMonthlyBudgetEur"
            inputMode="numeric"
            defaultValue={initial.aiMonthlyBudgetEur ?? ""}
            className="tabular max-w-32"
          />
        )}
      </Field>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">Intelligenza artificiale</legend>
        <Toggle
          name="aiCitizenAssistant"
          defaultChecked={initial.aiCitizenAssistant}
          label="AI per i cittadini"
          hint="Capisce il racconto, guida l'intervista, risponde alle domande e trascrive la voce. Spenta: l'intervista funziona con le domande una alla volta e nulla di ciò che scrive il cittadino va a un fornitore."
        />
        <Toggle
          name="aiCopilot"
          defaultChecked={initial.aiCopilot}
          label="Copilota per gli operatori"
          hint="Riepilogo del fascicolo, controlli incrociati, importi letti dai documenti, bozze di messaggi e domande normative. Spento: restano i controlli con le regole."
        />
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">Sicurezza degli accessi</legend>
        <Toggle
          name="mfaRequired"
          defaultChecked={initial.mfaRequired}
          disabled={!canRequireMfa}
          label="Verifica in due passaggi obbligatoria per tutti"
          hint={
            canRequireMfa
              ? "Al prossimo accesso chi non l'ha ancora attivata dovrà farlo prima di entrare. Chi perde il telefono lo sblocchi tu da Operatori."
              : "Prima attivala per te dalla pagina Account: poi potrai richiederla a tutti."
          }
        />
      </fieldset>
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

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
  disabled = false,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md p-3 ring-1 ring-line ring-inset has-[:disabled]:cursor-not-allowed has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stamp">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 size-4.5 shrink-0 accent-stamp disabled:opacity-50"
      />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-ink-2">{hint}</span>
      </span>
    </label>
  );
}
