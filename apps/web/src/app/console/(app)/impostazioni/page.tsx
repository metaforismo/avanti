"use client";

import { OfficesSection } from "@/components/console/admin/offices-section";
import { OperatorsSection } from "@/components/console/admin/operators-section";
import { SettingsSection } from "@/components/console/admin/settings-section";
import { useOperator, useReloadOperator } from "@/lib/console/operator-context";

export default function SettingsPage() {
  const operator = useOperator();
  const reloadOperator = useReloadOperator();

  if (operator.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl font-semibold">Impostazioni riservate</h1>
        <p className="mt-2 text-ink-2">
          Operatori, sportelli e parametri li gestisce un amministratore del tuo CAF.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-12 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Impostazioni</h1>
        <p className="mt-1 text-ink-2">{operator.organization.name}</p>
      </div>
      <OperatorsSection />
      <OfficesSection onChanged={reloadOperator} />
      <SettingsSection />
    </div>
  );
}
