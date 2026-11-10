"use client";

import {
  Building2,
  CalendarClock,
  ChevronDown,
  Download,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import type { CitizenCase, Language } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Sheet } from "./sheet";
import { Notice } from "@/components/ui/notice";
import { apiDownload, apiFetch, ApiRequestError } from "@/lib/api";
import { zipComplete } from "@/lib/console/zip-complete";
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
  const deleteResponseLost = useRef(false);
  const org = { org: orgName };

  const fail = (err: unknown) =>
    setError(errorMessage(m, err instanceof ApiRequestError ? err.code : "network"));

  async function downloadCopy() {
    if (!practice) return;
    setPending("copy");
    setError(null);
    try {
      // Held in memory like the desk's archive (at most the case's 120 MB), so a refusal or a
      // cut-off copy shows here in the citizen's language instead of saving an error as a file.
      const { blob, fileName } = await apiDownload(
        `/api/c/${encodeURIComponent(practice.token)}/export`,
      );
      if (await zipComplete(blob)) {
        setError(errorMessage(m, "network"));
        return;
      }
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
    // A 404 alone also means a rotated link (the desk issued a new one): only a DELETE this page
    // already sent, whose answer never arrived, lets a 404 confirm the erasure.
    const retryOfLostDelete = kind === "delete" && deleteResponseLost.current;
    try {
      if (kind === "delete") {
        deleteResponseLost.current = true;
        await apiFetch(path, { method: "DELETE", body: { confirmed: true } });
      } else await apiFetch(`${path}/erasure-request`, { method: "POST" });
      setConfirm(null);
      if (kind === "delete") practice.onErased();
      else practice.onChanged();
    } catch (err) {
      const answered = err instanceof ApiRequestError;
      if (kind === "delete" && answered && err.code === "not_found") {
        if (retryOfLostDelete) practice.onErased();
        else setError(p.deleteGone);
      } else fail(err);
      // The server answered: whatever it said, this attempt did not erase anything.
      if (kind === "delete" && answered) deleteResponseLost.current = false;
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Sheet
        open={open && confirm === null}
        onOpenChange={onOpenChange}
        title={p.title}
        description={p.lead}
        closeLabel={m.common.close}
      >
        <div className="grid gap-5 text-ink-2">
          {/* The answer in three lines, the two actions right under them; the long version
              stays one tap away instead of nine paragraphs above the buttons. */}
          <ul className="grid gap-3">
            <FactRow icon={Building2} label={p.whoTitle} value={orgName} />
            <FactRow
              icon={CalendarClock}
              label={p.keepTitle}
              value={
                practice
                  ? citizenDate(language, practice.data.expiresAt)
                  : format(p.retentionGeneric, org)
              }
              plain={!practice}
            />
          </ul>

          {practice && privacy && (
            <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <Button
                variant="secondary"
                size="lg"
                className="min-h-12 rounded-xl"
                loading={pending === "copy"}
                disabled={pending !== null}
                onClick={() => void downloadCopy()}
              >
                <Download className="size-4" aria-hidden />
                {p.copyAction}
              </Button>
              {privacy.canDelete ? (
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-h-12 rounded-xl text-danger"
                  disabled={pending !== null}
                  onClick={() => setConfirm("delete")}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {p.deleteAction}
                </Button>
              ) : privacy.erasureRequestedAt ? null : (
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-h-12 rounded-xl"
                  disabled={pending !== null}
                  onClick={() => setConfirm("request")}
                >
                  {p.requestAction}
                </Button>
              )}
            </div>
          )}
          {privacy?.erasureRequestedAt && (
            <Notice tone="info" size="md">
              {format(p.requested, { date: citizenDate(language, privacy.erasureRequestedAt) })}
            </Notice>
          )}
          {error && (
            <Notice tone="danger" size="md">
              {error}
            </Notice>
          )}

          <div className="divide-y divide-line border-y border-line">
            <Section title={p.whoTitle} open={!practice}>
              <p>{format(p.who, org)}</p>
            </Section>
            <Section title={p.whatTitle} open={!practice}>
              <p>{p.what}</p>
              {practice && (
                <p className="mt-1">
                  {plural(language, practice.data.documents.length, p.documents)}
                </p>
              )}
              <p className="mt-2">{p.ai}</p>
            </Section>
            <Section title={p.keepTitle} open={!practice}>
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
              <Section title={privacy.canDelete ? p.deleteTitle : p.requestTitle}>
                <p>
                  {privacy.canDelete ? p.deleteSelf : format(p.request, org)} {p.copy}
                </p>
              </Section>
            )}
            <Section title={p.rightsTitle} open={!practice}>
              <p>{format(p.rights, org)}</p>
            </Section>
          </div>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 w-fit items-center font-semibold text-stamp underline underline-offset-2"
          >
            {p.fullNotice}
          </a>
        </div>
      </Sheet>

      <Sheet
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
      </Sheet>
    </>
  );
}

function Section({
  title,
  open = false,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-5 shrink-0 text-ink-3 transition-transform duration-200 ease-(--ease-out) group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

/** One fact with its tile: what the citizen wants to know first, in a line. */
function FactRow({
  icon: Icon,
  label,
  value,
  plain = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** A sentence rather than a name or a date: regular weight. */
  plain?: boolean;
}) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-[0.75rem] bg-ok-wash text-ok">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-ink-3">{label}</span>
        <span className={plain ? "block text-ink-2" : "block font-semibold text-ink"}>
          <bdi>{value}</bdi>
        </span>
      </span>
    </li>
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
