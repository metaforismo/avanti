"use client";

import { useState } from "react";
import { PasswordForm } from "@/components/console/admin/password-form";
import { MfaAccountSection } from "@/components/console/mfa/account-section";
import { Notice } from "@/components/ui/notice";
import { PageContainer, PageHeader, SectionHeader } from "@/components/ui/page-header";
import { useOperator } from "@/lib/console/operator-context";

export default function AccountPage() {
  const operator = useOperator();
  const [changed, setChanged] = useState(false);

  return (
    <PageContainer width="3xl">
      <PageHeader title="Account" />
      <dl className="mt-6 grid gap-3 rounded-lg bg-surface p-5 ring-1 ring-line sm:grid-cols-3">
        <div>
          <dt className="text-sm text-ink-3">Nome</dt>
          <dd className="font-semibold">{operator.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-3">Email</dt>
          <dd className="font-semibold break-all">{operator.email}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-3">Ruolo</dt>
          <dd className="font-semibold">
            {operator.role === "admin" ? "Amministratore" : "Operatore"}
          </dd>
        </div>
      </dl>

      <section className="mt-10" aria-labelledby="password-title">
        <SectionHeader
          id="password-title"
          title="Cambia password"
          lead="Dopo il cambio resti connesso su questo dispositivo."
          className="mb-5"
        />
        {changed && (
          <Notice tone="ok" className="mb-5">
            Password aggiornata.
          </Notice>
        )}
        <PasswordForm submitLabel="Aggiorna password" onChanged={() => setChanged(true)} />
      </section>

      <MfaAccountSection />
    </PageContainer>
  );
}
