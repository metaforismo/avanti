"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { OrganizationSettings } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { SettingGroup, ToggleRow, ValueRow } from "./setting-row";
import { Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { useHashTarget } from "@/lib/console/use-hash-target";
import { useWarnBeforeUnload } from "@/lib/use-warn-before-unload";
import { cn } from "@/lib/cn";
import { focusFirstError } from "@/lib/validation";

const LIMITS = {
  baselineMinutesPerCase: { min: 1, max: 600 },
  linkDays: { min: 1, max: 365 },
  retentionDays: { min: 30, max: 3650 },
} as const;

type Key = keyof typeof LIMITS;

const snapshotOf = (form: HTMLFormElement | null) =>
  form ? JSON.stringify([...new FormData(form).entries()]) : null;

export function SettingsSection() {
  const settings = useResource<OrganizationSettings>("/api/settings");

  return (
    <section id="parametri" aria-labelledby="settings-title" className="scroll-mt-20">
      <SectionHeader
        id="settings-title"
        title="Parametri"
        lead="Valgono per tutto il CAF e per le pratiche create da adesso."
      />
      {settings.status === "error" && !settings.data ? (
        <Notice tone="danger" className="mt-4">
          Parametri non disponibili: {settings.error.message}
        </Notice>
      ) : !settings.data ? (
        <Skeleton className="mt-4 h-40 rounded-lg" />
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
  const [errors, setErrors] = useState<
    Partial<Record<Key | "nearReadyCriticalThreshold" | "nearReadyOtherThreshold", string>>
  >({});
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const form = useRef<HTMLFormElement>(null);
  // Links from the first steps, the report and the metrics land on the field to fill in.
  useHashTarget(["#baseline", "#quasi-pronta"], form, () =>
    window.location.hash === "#baseline"
      ? (form.current?.elements.namedItem("baselineMinutesPerCase") as HTMLInputElement | null)
      : (form.current?.elements.namedItem("nearReadyMode") as HTMLSelectElement | null),
  );
  // What the server has, as the form would submit it: «non ancora salvate» compares with this,
  // so typing a value back to what it was clears the warning.
  const saved = useRef<string | null>(null);
  const snapshot = () => snapshotOf(form.current);
  useEffect(() => {
    saved.current = snapshotOf(form.current);
  }, []);
  // The save button is at the end of a long form: closing the tab must not drop changes silently.
  const dirty = state === "dirty";
  useWarnBeforeUnload(dirty);
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
      // Empty means "not set": no baseline yet.
      if (key === "baselineMinutesPerCase" && raw === "") {
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
    values.notifyCitizenRenewals = data.get("notifyCitizenRenewals") === "on";
    values.aiCopilot = data.get("aiCopilot") === "on";
    values.aiCitizenAssistant = data.get("aiCitizenAssistant") === "on";
    values.nearReadyMode = data.get("nearReadyMode") as OrganizationSettings["nearReadyMode"];
    for (const key of ["nearReadyCriticalThreshold", "nearReadyOtherThreshold"] as const) {
      const percent = Number(data.get(key));
      if (!Number.isFinite(percent) || percent < 80 || percent > 100)
        next[key] = "Una percentuale tra 80 e 100.";
      else values[key] = percent / 100;
    }
    const first = Number(data.get("reminderFirst"));
    const second = Number(data.get("reminderSecond"));
    values.citizenReminderDays = second ? [first, second] : [first];
    // A disabled checkbox is not submitted: leave the policy untouched rather than turning it off.
    if (canRequireMfa) values.mfaRequired = data.get("mfaRequired") === "on";
    setErrors(next);
    if (focusFirstError(event.currentTarget, next)) return;
    const submitted = snapshot();
    setState("saving");
    setFormError(null);
    try {
      onSaved(
        await apiFetch<OrganizationSettings>("/api/settings", { method: "PATCH", body: values }),
      );
      saved.current = submitted;
      // Typed while saving: those edits are not on the server yet.
      setState(snapshot() === submitted ? "saved" : "dirty");
    } catch (error) {
      setState(snapshot() === saved.current ? "idle" : "dirty");
      setFormError(
        error instanceof ApiRequestError ? error.message : "Salvataggio non riuscito. Riprova.",
      );
    }
  }

  const number = (name: Key | "nearReadyCriticalThreshold" | "nearReadyOtherThreshold") => ({
    name,
    inputMode: "numeric" as const,
    className: "tabular w-28 text-end",
  });
  return (
    <form
      ref={form}
      onSubmit={onSubmit}
      noValidate
      onChange={() => {
        if (state !== "saving") setState(snapshot() === saved.current ? "idle" : "dirty");
      }}
      className="mt-4 grid gap-7"
    >
      <SettingGroup title="Pratiche e conservazione">
        <ValueRow
          label="Minuti per pratica prima di Avanti"
          hint="Misurati su una settimana normale: servono alle metriche per il tempo risparmiato. Facoltativo."
          error={errors.baselineMinutesPerCase}
        >
          {(p) => (
            <Input
              {...p}
              {...number("baselineMinutesPerCase")}
              defaultValue={initial.baselineMinutesPerCase ?? ""}
              placeholder="—"
            />
          )}
        </ValueRow>
        <ValueRow
          label="Validità dei link per i cittadini"
          hint="Giorni. Poi il cittadino deve chiederne uno nuovo."
          error={errors.linkDays}
        >
          {(p) => <Input {...p} {...number("linkDays")} defaultValue={initial.linkDays} />}
        </ValueRow>
        <ValueRow
          label="Conservazione dei fascicoli"
          hint="Giorni dopo la chiusura o la scadenza. Non riguarda l'archivio del vostro gestionale."
          error={errors.retentionDays}
        >
          {(p) => (
            <Input {...p} {...number("retentionDays")} defaultValue={initial.retentionDays} />
          )}
        </ValueRow>
      </SettingGroup>

      <SettingGroup title="Avvisi via email">
        <ToggleRow
          name="notifyCitizenSubmission"
          defaultChecked={initial.notifyCitizenSubmission}
          label="Ricevuta al cittadino quando invia la pratica"
          hint="Codice, sportello e prossimo passo. Nessun link né dati dei documenti; al massimo due al giorno per indirizzo."
        />
        <ToggleRow
          name="notifyCitizenReady"
          defaultChecked={initial.notifyCitizenReady}
          label="Avvisa il cittadino quando la pratica è pronta"
          hint="Solo se ha lasciato l'email. Le richieste di integrazione gli arrivano sempre."
        />
        <ToggleRow
          name="notifyCitizenRenewals"
          defaultChecked={initial.notifyCitizenRenewals}
          label="Invita al rinnovo ISEE chi l'ha chiesto"
          hint="Solo a chi ha dato il consenso con la pratica dell'anno prima."
        />
        <ToggleRow
          name="notifyOperatorDigest"
          defaultChecked={initial.notifyOperatorDigest}
          label="Riepilogo giornaliero agli operatori"
          hint="Quante pratiche aspettano la revisione, senza dati dei cittadini."
        />
        <ToggleRow
          name="notifyCitizenReminders"
          defaultChecked={initial.notifyCitizenReminders}
          label="Ricorda al cittadino l'integrazione richiesta"
          hint="Si ferma appena risponde o la pratica cambia stato."
        />
        <ValueRow label="Primo promemoria" hint="Dopo quanti giorni senza risposta.">
          {(p) => (
            <Select
              {...p}
              name="reminderFirst"
              defaultValue={String(initial.citizenReminderDays[0] ?? 3)}
              compact
            >
              {[2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>
                  Dopo {d} giorni
                </option>
              ))}
            </Select>
          )}
        </ValueRow>
        <ValueRow label="Secondo promemoria">
          {(p) => (
            <Select
              {...p}
              name="reminderSecond"
              defaultValue={String(initial.citizenReminderDays[1] ?? 0)}
              compact
            >
              <option value="0">Nessuno</option>
              {[3, 4, 7].map((d) => (
                <option key={d} value={d}>
                  Dopo altri {d} giorni
                </option>
              ))}
            </Select>
          )}
        </ValueRow>
      </SettingGroup>

      <SettingGroup title="Intelligenza artificiale">
        <ToggleRow
          name="aiCitizenAssistant"
          defaultChecked={initial.aiCitizenAssistant}
          label="AI per i cittadini"
          hint="Capisce il racconto, guida l'intervista e trascrive la voce. Spenta: domande una alla volta e nulla va a un fornitore."
        />
        <ToggleRow
          name="aiCopilot"
          defaultChecked={initial.aiCopilot}
          label="Copilota per gli operatori"
          hint="Riepilogo, controlli incrociati, importi dai documenti, bozze e domande normative. Spento: restano i controlli con le regole."
        />
      </SettingGroup>

      <SettingGroup id="quasi-pronta" title="Pratica «quasi pronta»">
        {initial.nearReadySuspendedAt && (
          <Notice tone="warn" role="none" className="rounded-none">
            Sospesa il {new Date(initial.nearReadySuspendedAt).toLocaleDateString("it-IT")} dopo un
            errore grave segnalato da un operatore. Torna «in ombra» finché non scegli di nuovo
            «Visibile agli operatori».
          </Notice>
        )}
        <ValueRow
          label="Modalità"
          hint="In ombra il suggerimento si misura senza mostrarlo: è come si inizia il pilota. Non segna mai una pratica come pronta."
        >
          {(p) => (
            <Select {...p} name="nearReadyMode" defaultValue={initial.nearReadyMode} compact>
              <option value="off">Spenta</option>
              <option value="shadow">In ombra</option>
              <option value="visible">Visibile agli operatori</option>
            </Select>
          )}
        </ValueRow>
        <ValueRow
          label="Soglia di lettura, dati critici"
          hint="Percentuale. Identità, nucleo, anni: sotto soglia la pratica non è suggerita."
          error={errors.nearReadyCriticalThreshold}
        >
          {(p) => (
            <Input
              {...p}
              {...number("nearReadyCriticalThreshold")}
              defaultValue={Math.round(initial.nearReadyCriticalThreshold * 100)}
            />
          )}
        </ValueRow>
        <ValueRow
          label="Soglia di lettura, altri dati"
          hint="Percentuale."
          error={errors.nearReadyOtherThreshold}
        >
          {(p) => (
            <Input
              {...p}
              {...number("nearReadyOtherThreshold")}
              defaultValue={Math.round(initial.nearReadyOtherThreshold * 100)}
            />
          )}
        </ValueRow>
      </SettingGroup>

      <SettingGroup title="Sicurezza degli accessi">
        <ToggleRow
          name="mfaRequired"
          defaultChecked={initial.mfaRequired}
          disabled={!canRequireMfa}
          label="Verifica in due passaggi obbligatoria per tutti"
          hint={
            canRequireMfa
              ? "Chi non l'ha ancora attivata dovrà farlo al prossimo accesso. Chi perde il telefono lo sblocchi tu da Operatori."
              : "Prima attivala per te dalla pagina Account: poi potrai richiederla a tutti."
          }
        />
      </SettingGroup>

      {formError && <Notice tone="danger">{formError}</Notice>}
      {/* Sticky: with the form taller than the screen, saving is always one click away. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-line bg-paper px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <Button type="submit" loading={state === "saving"}>
          Salva parametri
        </Button>
        <span
          role="status"
          className={cn(
            "flex items-center gap-1.5 text-sm",
            state === "saved" ? "text-ok" : "text-ink-3",
          )}
        >
          {state === "saved" && <Check className="size-4 animate-check-in" aria-hidden />}
          {state === "saved" ? "Salvati" : dirty ? "Modifiche non ancora salvate" : ""}
        </span>
      </div>
    </form>
  );
}
