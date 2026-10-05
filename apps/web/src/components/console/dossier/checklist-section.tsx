"use client";

import { Check, FileText, Image as ImageIcon, RotateCcw, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { CaseDossier, ChecklistItem } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { CHECKLIST_STATUS } from "@/lib/console/labels";
import { cn } from "@/lib/cn";
import type { DossierActions } from "./dossier-view";

export function ChecklistSection({
  dossier,
  actions,
}: {
  dossier: CaseDossier;
  actions: DossierActions;
}) {
  const groups = new Map<string, { title: string; items: ChecklistItem[] }>();
  for (const item of dossier.checklist) {
    const key = item.memberId ?? "nucleo";
    if (!groups.has(key))
      groups.set(key, { title: item.memberName ?? "Nucleo familiare", items: [] });
    groups.get(key)!.items.push(item);
  }
  const verified = dossier.checklist.filter(
    (i) => i.status === "verified" || i.status === "waived",
  ).length;
  const unmatched = dossier.documents.filter((d) => !d.checklistItemId);
  const readOnly = dossier.status === "closed" || dossier.status === "intake";

  return (
    <section aria-labelledby="checklist-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="checklist-title" className="font-display text-xl font-semibold">
          Documenti
        </h2>
        <p className="tabular text-sm text-ink-3">
          {verified} di {dossier.checklist.length} verificati
        </p>
      </div>
      {readOnly && dossier.status === "intake" && (
        <p className="mt-2 text-sm text-ink-3">
          Il cittadino sta ancora compilando: potrai verificare dopo l&apos;invio.
        </p>
      )}

      <div className="mt-4 grid gap-6">
        {[...groups.entries()].map(([key, group]) => (
          <div key={key}>
            <h3 className="mb-2 text-sm font-semibold text-ink-2">{group.title}</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface ring-1 ring-line">
              {group.items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  dossier={dossier}
                  actions={actions}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          </div>
        ))}

        {unmatched.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-2">Documenti non abbinati</h3>
            <ul className="flex flex-wrap gap-2 rounded-lg bg-surface p-3 ring-1 ring-line">
              {unmatched.map((doc) => (
                <li key={doc.id}>
                  <DocChip
                    name={doc.analysis?.detectedLabel ?? doc.fileName}
                    mime={doc.mimeType}
                    onClick={() => actions.openDocument(doc)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function ChecklistRow({
  item,
  dossier,
  actions,
  readOnly,
}: {
  item: ChecklistItem;
  dossier: CaseDossier;
  actions: DossierActions;
  readOnly: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const docs = dossier.documents.filter((d) => d.checklistItemId === item.id);
  const findings = dossier.findings.filter(
    (f) =>
      f.checklistItemId === item.id &&
      f.code !== "checklist.missing" &&
      (f.severity === "blocker" || f.severity === "warning"),
  );
  const status = CHECKLIST_STATUS[item.status];
  const busy = actions.pending === `review:${item.id}`;
  const decided =
    item.status === "verified" || item.status === "rejected" || item.status === "waived";

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    if (await actions.review(item.id, { decision: "rejected", note: note || undefined }))
      setRejecting(false);
  }

  return (
    <li id={`item-${item.id}`} className="scroll-mt-24 px-4 py-3.5 target:bg-marker-soft/50">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.title}</p>
            {!item.required && <span className="text-xs text-ink-3">facoltativo</span>}
          </div>
          {findings.map((finding) => (
            <p
              key={finding.id}
              className={cn(
                "mt-1 text-sm",
                finding.severity === "blocker" ? "text-danger" : "text-warn",
              )}
            >
              {finding.message}
            </p>
          ))}
          {item.note && <p className="mt-1 text-sm text-ink-2">Nota: {item.note}</p>}
          {docs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {docs.map((doc) => (
                <DocChip
                  key={doc.id}
                  name={doc.analysis?.detectedLabel ?? doc.fileName}
                  mime={doc.mimeType}
                  confidence={doc.analysis?.confidence}
                  onClick={() => actions.openDocument(doc)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tone={status.tone}>{status.label}</Pill>
          {!readOnly &&
            (decided ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Annulla la decisione su ${item.title}`}
                title="Annulla decisione"
                loading={busy}
                onClick={() => void actions.review(item.id, { decision: "reset" })}
              >
                <RotateCcw className="size-4" />
              </Button>
            ) : (
              <>
                {docs.length > 0 ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy && !rejecting}
                      onClick={() => void actions.review(item.id, { decision: "verified" })}
                    >
                      <Check className="size-4 text-ok" aria-hidden />
                      Verifica
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRejecting((v) => !v)}
                      aria-expanded={rejecting}
                    >
                      Rifiuta
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy}
                    title="Segna la voce come non necessaria per questo nucleo"
                    onClick={() =>
                      void actions.review(item.id, {
                        decision: "waived",
                        note: "Non necessario per questo nucleo",
                      })
                    }
                  >
                    Non serve
                  </Button>
                )}
              </>
            ))}
        </div>
      </div>
      {rejecting && (
        <form
          onSubmit={reject}
          className="mt-3 flex animate-fade-in flex-wrap gap-2 rounded-md bg-paper p-3"
        >
          <label htmlFor={`note-${item.id}`} className="sr-only">
            Motivo per il cittadino
          </label>
          <input
            id={`note-${item.id}`}
            name="note"
            autoFocus
            maxLength={500}
            placeholder="Motivo, in italiano: lo traduciamo per il cittadino"
            className="h-9 min-w-0 flex-1 basis-64 rounded-sm bg-surface px-3 text-sm ring-1 ring-line-strong ring-inset focus:ring-2 focus:ring-stamp focus:outline-none"
          />
          <Button type="submit" size="sm" variant="danger" loading={busy}>
            Rifiuta documento
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Annulla"
            onClick={() => setRejecting(false)}
          >
            <X className="size-4" />
          </Button>
        </form>
      )}
    </li>
  );
}

function DocChip({
  name,
  mime,
  confidence,
  onClick,
}: {
  name: string;
  mime: string;
  confidence?: number;
  onClick: () => void;
}) {
  const Icon = mime.startsWith("image/") ? ImageIcon : FileText;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-paper px-2 py-1 text-sm text-ink-2 ring-1 ring-line ring-inset hover:bg-sunk hover:text-ink"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
      {confidence !== undefined && confidence < 0.6 && (
        <span className="shrink-0 text-xs text-warn" title="Riconoscimento incerto">
          ?
        </span>
      )}
    </button>
  );
}
