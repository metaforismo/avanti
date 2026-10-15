"use client";

import { OfficesSection } from "@/components/console/admin/offices-section";
import { OperatorsSection } from "@/components/console/admin/operators-section";
import { QuickRepliesSection } from "@/components/console/admin/quick-replies-section";
import { SettingsSection } from "@/components/console/admin/settings-section";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { useOperator, useReloadOperator } from "@/lib/console/operator-context";

export default function SettingsPage() {
  const operator = useOperator();
  const reloadOperator = useReloadOperator();

  if (operator.role !== "admin") {
    return (
      <PageContainer width="3xl" className="py-16 text-center lg:py-16">
        <h1 className="font-display text-2xl font-semibold">Impostazioni riservate</h1>
        <p className="mt-2 text-ink-2">
          Operatori, sportelli e parametri li gestisce un amministratore del tuo CAF.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="4xl" className="grid gap-12">
      <PageHeader title="Impostazioni" lead={operator.organization.name} />
      <OperatorsSection />
      <OfficesSection onChanged={reloadOperator} />
      <QuickRepliesSection />
      <SettingsSection />
    </PageContainer>
  );
}
