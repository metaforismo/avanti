"use client";

import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CitizenCase, Language } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { apiDownload, apiFetch, ApiRequestError } from "@/lib/api";
import {
  errorMessage,
  format,
  plural,
  type CitizenMessages,
  type Widen,
} from "@/lib/citizen/messages";

/** A date the citizen reads, in their language and in the CAF's time zone. */
export function citizenDate(language: Language, iso: string) {
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "Europe/Rome" }).format(
    new Date(iso),
  );
}

type Confirm = "delete" | "request" | null;

/**
 * The second layer of the privacy notice, in the citizen's language: who holds the data, what,
 * for how long, and the rights the link can exercise directly. Before the practice exists (the
 * QR page) it shows the notice alone; inside it adds the copy, the erasure and its request.
 */
export function PrivacySheet({
  open,
  onOpenChange,
  m,
  language,
  orgName,
  practice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  m: Widen<CitizenMessages>;
  language: Language;
  orgName: string;
  practice?: {
    data: CitizenCase;
    token: string;
    onChanged: () => void;
    onErased: () => void;
  };
}) {
  const p = m.privacy;
  const privacy = practice?.data.privacy;
  const [pending, setPending] = useState<"copy" | "delete" | "request" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const org = { org: orgName };

  const fail = (err: unknown) =>
    setError(errorMessage(m, err instanceof ApiRequestError ? err.code : "network"));

  async function downloadCopy() {
    if (!practice) return;
    setPending("copy");
    setError(null);
    try {
      const { blob, fileName } = await apiDownload(
        `/api/c/${encodeURIComponent(practice.token)}/export`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName ?? `avanti-${practice.data.reference}.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      fail(err);
    } finally {
      setPending(null);
    }
  }

  async function act(kind: "delete" | "request") {
    if (!practice) return;
    setPending(kind);
    setError(null);
    const path = `/api/c/${encodeURIComponent(practice.token)}`;
    try {
      if (kind === "delete") await apiFetch(path, { method: "DELETE", body: { confirmed: true } });
      else await apiFetch(`${path}/erasure-request`, { method: "POST" });
      setConfirm(null);
      if (kind === "delete") practice.onErased();
      else practice.onChanged();
    } catch (err) {
      // A retry after a lost response finds the case already gone: that is the success.
      if (kind === "delete" && err instanceof ApiRequestError && err.code === "not_found")
        practice.onErased();
      else fail(err);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Dialog
        open={open && confirm === null}
        onOpenChange={onOpenChange}
        title={p.title}
        description={p.lead}
        closeLabel={m.common.close}
      >
        <div className="grid gap-6 text-ink-2">
          <Section title={p.whoTitle}>
            <p>{format(p.who, org)}</p>
          </Section>
          <Section title={p.whatTitle}>
            <p>{p.what}</p>
            {practice && (
              <p className="mt-1">
                {plural(language, practice.data.documents.length, p.documents)}
              </p>
            )}
            <p className="mt-2">{p.ai}</p>
          </Section>
          <Section title={p.keepTitle}>
            {practice && privacy ? (
              <>
                <p>
                  {format(p.linkUntil, { date: citizenDate(language, practice.data.expiresAt) })}
                </p>
                <p className="mt-1">{plural(language, privacy.retentionDays, p.retention)}</p>
              </>
            ) : (
              <p>{format(p.retentionGeneric, org)}</p>
            )}
            <p className="mt-1">{p.officeArchive}</p>
          </Section>

          {practice && privacy && (
            <>
              <Section title={p.copyTitle}>
                <p>{p.copy}</p>
                <Button
                  variant="secondary"
                  size="touch"
                  className="mt-3"
                  loading={pending === "copy"}
                  disabled={pending !== null}
                  onClick={() => void downloadCopy()}
                >
                  <Download className="size-4" aria-hidden />
                  {p.copyAction}
                </Button>
              </Section>
              {privacy.canDelete ? (
                <Section title={p.deleteTitle}>
                  <p>{p.deleteSelf}</p>
                  <Button
                    variant="danger"
                    size="touch"
                    className="mt-3"
                    disabled={pending !== null}
                    onClick={() => setConfirm("delete")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {p.deleteAction}
                  </Button>
                </Section>
              ) : (
                <Section title={p.requestTitle}>
                  {privacy.erasureRequestedAt ? (
                    <Notice tone="info" size="md">
                      {format(p.requested, {
                        date: citizenDate(language, privacy.erasureRequestedAt),
                      })}
                    </Notice>
                  ) : (
                    <>
                      <p>{format(p.request, org)}</p>
                      <Button
                        variant="secondary"
                        size="touch"
                        className="mt-3"
                        disabled={pending !== null}
                        onClick={() => setConfirm("request")}
                      >
                        {p.requestAction}
                      </Button>
                    </>
                  )}
                </Section>
              )}
            </>
          )}

          <Section title={p.rightsTitle}>
            <p>{format(p.rights, org)}</p>
          </Section>
          {error && (
            <Notice tone="danger" size="md">
              {error}
            </Notice>
          )}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener"
            className="font-semibold text-stamp underline underline-offset-2"
          >
            {p.fullNotice}
          </a>
        </div>
      </Dialog>

      <Dialog
        open={open && confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm === "delete" ? p.deleteConfirmTitle : p.requestConfirmTitle}
        closeLabel={m.common.close}
      >
        <p className="text-ink-2">{confirm === "delete" ? p.deleteConfirm : p.requestConfirm}</p>
        {error && (
          <Notice tone="danger" size="md" className="mt-4">
            {error}
          </Notice>
        )}
        <div className="mt-6 grid gap-2 sm:flex sm:flex-row-reverse">
          <Button
            variant={confirm === "delete" ? "danger" : "primary"}
            size="lg"
            loading={pending === confirm}
            disabled={pending !== null}
            onClick={() => confirm && void act(confirm)}
          >
            {confirm === "delete" ? p.deleteConfirmAction : p.requestConfirmAction}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setConfirm(null)}>
            {m.common.cancel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

/** The way into the sheet, at the foot of every step. */
export function PrivacyLink({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <div className="mt-12 border-t border-line pt-4">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-ink-2 hover:text-ink"
      >
        <ShieldCheck className="size-4" aria-hidden />
        {label}
      </button>
    </div>
  );
}
