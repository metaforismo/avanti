"use client";

import { useState } from "react";
import { OfficesSection } from "@/components/console/admin/offices-section";
import { OperatorsSection } from "@/components/console/admin/operators-section";
import { QuickRepliesSection } from "@/components/console/admin/quick-replies-section";
import { SettingsNav, type SettingsSectionLink } from "@/components/console/admin/settings-nav";
import { SettingsSection } from "@/components/console/admin/settings-section";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { useOperator, useReloadOperator } from "@/lib/console/operator-context";

const SECTIONS: readonly SettingsSectionLink[] = [
  { id: "operatori", label: "Operatori" },
  { id: "sportelli", label: "Sportelli" },
  { id: "risposte-rapide", label: "Risposte rapide" },
  { id: "parametri", label: "Parametri" },
];

// Anchors and focused fields stop below the strip (and, on the phone, the app bar), not at the
// 9 rem the other pages leave for their own sticky headers.
const ANCHOR_OFFSET = `html{scroll-padding-top:4.75rem}@media(max-width:1023.98px){html{scroll-padding-top:7.75rem}}`;

export default function SettingsPage() {
  const operator = useOperator();
  const reloadOperator = useReloadOperator();
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [barOpen, setBarOpen] = useState(false);

  if (operator.role !== "admin") {
    return (
      <PageContainer width="3xl" centered className="py-16 text-center lg:py-16">
        <h1 className="font-display text-2xl font-semibold">Impostazioni riservate</h1>
        <p className="mt-2 text-ink-2">
          Operatori, sportelli e parametri li gestisce un amministratore del tuo CAF.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      width="form"
      className="flex flex-col gap-10 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-10"
    >
      <style>{ANCHOR_OFFSET}</style>
      <PageHeader title="Impostazioni" lead={operator.organization.name} className="-mb-4" />
      <SettingsNav sections={SECTIONS} barOpen={barOpen} barRef={setBar} />
      <OperatorsSection />
      <OfficesSection onChanged={reloadOperator} />
      <QuickRepliesSection />
      <SettingsSection saveBar={bar} onBarChange={setBarOpen} />
    </PageContainer>
  );
}
