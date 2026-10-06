"use client";

import { useState } from "react";
import { PasswordForm } from "@/components/console/admin/password-form";
import { useOperator } from "@/lib/console/operator-context";

export default function AccountPage() {
  const operator = useOperator();
  const [changed, setChanged] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <h1 className="font-display text-3xl font-bold tracking-[-0.025em]">Account</h1>
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
        <h2 id="password-title" className="font-display text-xl font-semibold">
          Cambia password
        </h2>
        <p className="mt-1 mb-5 text-ink-2">Dopo il cambio resti connesso su questo dispositivo.</p>
        {changed && (
          <p role="status" className="mb-5 rounded-md bg-ok-wash px-4 py-3 text-ok">
            Password aggiornata.
          </p>
        )}
        <PasswordForm submitLabel="Aggiorna password" onChanged={() => setChanged(true)} />
      </section>
    </div>
  );
}
