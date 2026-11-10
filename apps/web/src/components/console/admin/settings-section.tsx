"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import type { OrganizationSettings } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { LIMITS, message, wholeNumber, type NumberKey as Key } from "./settings-limits";
import { NumberInput, SettingGroup, ToggleRow, ValueRow } from "./setting-row";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useOperator } from "@/lib/console/operator-context";
import { useResource } from "@/lib/console/use-resource";
import { useHashTarget } from "@/lib/console/use-hash-target";
import { useWarnBeforeUnload } from "@/lib/use-warn-before-unload";
import { focusFirstError } from "@/lib/validation";

type Errors = Partial<Record<Key, string>>;

const snapshotOf = (form: HTMLFormElement | null) =>
  form ? JSON.stringify([...new FormData(form).entries()]) : null;

export function SettingsSection({
  saveBar,
  onBarChange,
}: {
  /** The strip under the page title, where the bar of unsaved changes is shown. */
  saveBar: HTMLElement | null;
  onBarChange: (open: boolean) => void;
}) {
  const settings = useResource<OrganizationSettings>("/api/settings");

  return (
    <section id="parametri" aria-labelledby="settings-title">
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
        <SettingsForm
          initial={settings.data}
          onSaved={settings.setData}
          saveBar={saveBar}
          onBarChange={onBarChange}
        />
      )}
    </section>
  );
}

function SettingsForm({
  initial,
  onSaved,
  saveBar,
  onBarChange,
}: {
  initial: OrganizationSettings;
  onSaved: (settings: OrganizationSettings) => void;
  saveBar: HTMLElement | null;
  onBarChange: (open: boolean) => void;
}) {
  const [errors, setErrors] = useState<Errors>({});
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
  useEffect(() => {
    onBarChange(state !== "idle");
    return () => onBarChange(false);
  }, [state, onBarChange]);
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    if (state !== "saved") return;
    const id = window.setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 2500);
    return () => window.clearTimeout(id);
  }, [state]);
  // Requiring it before having it would lock the admin out of the console until set up.
  const canRequireMfa = useOperator().mfaEnabled;
  const selects = {
    nearReadyMode: initial.nearReadyMode,
    reminderFirst: String(initial.citizenReminderDays[0] ?? 3),
    reminderSecond: String(initial.citizenReminderDays[1] ?? 0),
  };
  // React moves an input's defaultValue when the saved value changes, but never a select's
  // defaultSelected: without this, «Annulla» after a save would go back to the values the page
  // opened with. Only the defaults move, so edits typed while saving stay on screen.
  const selectDefaults = JSON.stringify(selects);
  useEffect(() => {
    const defaults = JSON.parse(selectDefaults) as Record<string, string>;
    for (const [name, value] of Object.entries(defaults)) {
      const select = form.current?.elements.namedItem(name);
      if (!(select instanceof HTMLSelectElement)) continue;
      for (const option of select.options) option.defaultSelected = option.value === value;
    }
  }, [selectDefaults]);
  // The bar's buttons go away after «Annulla» and «Salvati»: focus must not fall to the body.
  // A save sent with Enter from a field leaves the focus in that field.
  const refocus = () => {
    const active = document.activeElement;
    if (!active || active === document.body || saveBar?.contains(active))
      form.current?.focus({ preventScroll: true });
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;
    const data = new FormData(event.currentTarget);
    const read = (key: Key) => String(data.get(key) ?? "").trim();
    const next: Errors = {};
    const values: Partial<OrganizationSettings> = {};
    for (const key of Object.keys(LIMITS) as Key[]) {
      const raw = read(key);
      // Empty means "not set": no baseline yet.
      if (key === "baselineMinutesPerCase" && raw === "") {
        values[key] = null;
        continue;
      }
      const n = wholeNumber(key, raw);
      if (n === null) next[key] = message(key);
      else if (key === "nearReadyCriticalThreshold" || key === "nearReadyOtherThreshold")
        values[key] = n / 100;
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
      const stillSame = snapshot() === submitted;
      setState(stillSame ? "saved" : "dirty");
      if (stillSame) refocus();
    } catch (error) {
      setState(snapshot() === saved.current ? "idle" : "dirty");
      setFormError(
        error instanceof ApiRequestError ? error.message : "Salvataggio non riuscito. Riprova.",
      );
    }
  }

  // Digits only, typed or pasted, and no more than the largest value has: «5 modificato» can't
  // be entered at all, and what is left out of range says so as soon as the field is left.
  const number = (name: Key) => ({
    name,
    inputMode: "numeric" as const,
    pattern: "[0-9]*",
    autoComplete: "off",
    maxLength: String(LIMITS[name].max).length,
    unit: LIMITS[name].unit,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.currentTarget.value.replace(/\D/g, "");
      if (digits !== event.currentTarget.value) event.currentTarget.value = digits;
      // An error stays until the value is right: no flicker while typing a valid one.
      setErrors((current) =>
        current[name] &&
        (digits === "" ? name === "baselineMinutesPerCase" : wholeNumber(name, digits))
          ? { ...current, [name]: undefined }
          : current,
      );
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      const raw = event.currentTarget.value.trim();
      if (raw === "" && name === "baselineMinutesPerCase") return;
      if (wholeNumber(name, raw) === null)
        setErrors((current) => ({ ...current, [name]: message(name) }));
    },
  });
  return (
    <form
      id="settings-form"
      ref={form}
      onSubmit={onSubmit}
      noValidate
      tabIndex={-1}
      aria-labelledby="settings-title"
      onChange={() => {
        if (state !== "saving") setState(snapshot() === saved.current ? "idle" : "dirty");
      }}
      className="mt-4 grid gap-7 outline-none"
    >
      <SettingGroup title="Pratiche e conservazione">
        <ValueRow
          label="Minuti per pratica prima di Avanti"
          hint="Misurati su una settimana normale: servono alle metriche per il tempo risparmiato. Facoltativo."
          error={errors.baselineMinutesPerCase}
        >
          {(p) => (
            <NumberInput
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
          {(p) => <NumberInput {...p} {...number("linkDays")} defaultValue={initial.linkDays} />}
        </ValueRow>
        <ValueRow
          label="Conservazione dei fascicoli"
          hint="Giorni dopo la chiusura o la scadenza. Non riguarda l'archivio del vostro gestionale."
          error={errors.retentionDays}
        >
          {(p) => (
            <NumberInput {...p} {...number("retentionDays")} defaultValue={initial.retentionDays} />
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
            <Select {...p} name="reminderFirst" defaultValue={selects.reminderFirst} compact>
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
            <Select {...p} name="reminderSecond" defaultValue={selects.reminderSecond} compact>
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
            <Select {...p} name="nearReadyMode" defaultValue={selects.nearReadyMode} compact>
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
            <NumberInput
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
            <NumberInput
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
      {saveBar &&
        createPortal(
          state === "idle" ? null : (
            <div className="pointer-events-auto flex h-full animate-fade-in items-center gap-2 bg-paper">
              {state === "saved" ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ok">
                  <Check className="size-4 animate-check-in" aria-hidden />
                  Salvati
                </span>
              ) : (
                <>
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-warn" />
                    <span className="truncate">Modifiche non ancora salvate</span>
                  </span>
                  <span className="ms-auto flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={state === "saving"}
                      onClick={() => {
                        form.current?.reset();
                        setErrors({});
                        setFormError(null);
                        setState("idle");
                        refocus();
                      }}
                    >
                      Annulla
                    </Button>
                    <Button
                      type="submit"
                      form="settings-form"
                      size="sm"
                      loading={state === "saving"}
                    >
                      Salva<span className="max-sm:sr-only"> parametri</span>
                    </Button>
                  </span>
                </>
              )}
            </div>
          ),
          saveBar,
        )}
    </form>
  );
}
