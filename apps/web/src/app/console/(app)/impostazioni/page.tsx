"use client";

import { OfficesSection } from "@/components/console/admin/offices-section";
import { OperatorsSection } from "@/components/console/admin/operators-section";
import { QuickRepliesSection } from "@/components/console/admin/quick-replies-section";
import { SettingsSection } from "@/components/console/admin/settings-section";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { useOperator, useReloadOperator } from "@/lib/console/operator-context";

const SECTIONS = [
  ["#operatori", "Operatori"],
  ["#sportelli", "Sportelli"],
  ["#risposte-rapide", "Risposte rapide"],
  ["#parametri", "Parametri"],
] as const;

export default function SettingsPage() {
  const operator = useOperator();
  const reloadOperator = useReloadOperator();

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
      width="4xl"
      className="grid gap-10 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-10"
    >
      <div>
        <PageHeader title="Impostazioni" lead={operator.organization.name} />
        <nav aria-label="Sezioni" className="mt-4 flex flex-wrap gap-1">
          {SECTIONS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-sm px-2.5 py-1 text-sm text-ink-2 transition-colors duration-100 hover:bg-sunk hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
      <OperatorsSection />
      <OfficesSection onChanged={reloadOperator} />
      <QuickRepliesSection />
      <SettingsSection />
    </PageContainer>
  );
}
