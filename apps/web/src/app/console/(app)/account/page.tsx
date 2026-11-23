"use client";

import { useState } from "react";
import { PasswordForm } from "@/components/console/admin/password-form";
import { PANEL } from "@/components/console/admin/panel";
import { SplitSection } from "@/components/console/admin/setting-row";
import { MfaAccountSection } from "@/components/console/mfa/account-section";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { useOperator } from "@/lib/console/operator-context";
import { cn } from "@/lib/cn";

export default function AccountPage() {
  const operator = useOperator();
  const [changed, setChanged] = useState(false);

  return (
    <PageContainer
      width="wide"
      className="flex flex-col gap-8 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-8"
    >
      <PageHeader title="Account" lead={operator.organization.name} />
      <section aria-labelledby="profile-title">
        <SplitSection
          titleId="profile-title"
          title="Profilo"
          lead="Nome, email e ruolo li cambia un amministratore del CAF."
        >
          <dl className={cn(PANEL, "divide-y divide-line")}>
            {[
              ["Nome", operator.name],
              ["Email", operator.email],
              ["Ruolo", operator.role === "admin" ? "Amministratore" : "Operatore"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 px-5 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center"
              >
                <dt className="text-[0.8125rem] text-ink-3">{label}</dt>
                <dd className="text-sm font-semibold break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </SplitSection>
      </section>
      <section aria-labelledby="password-title">
        <SplitSection
          titleId="password-title"
          title="Cambia password"
          lead="Dopo il cambio resti connesso su questo dispositivo."
        >
          <div className={cn(PANEL, "p-5")}>
            {changed && (
              <Notice tone="ok" className="mb-5">
                Password aggiornata.
              </Notice>
            )}
            <PasswordForm submitLabel="Aggiorna password" onChanged={() => setChanged(true)} />
          </div>
        </SplitSection>
      </section>
      <MfaAccountSection />
    </PageContainer>
  );
}
