import { AlertOctagon, AlertTriangle, CheckCircle2, FileQuestion } from "lucide-react";
import type { CaseDossier, Finding } from "@avanti/contracts";
import { cn } from "@/lib/cn";

const MISSING_CODE = "checklist.missing";

/**
 * Blockers first, then warnings: the operator's reading order. Missing documents are
 * collapsed into one line, otherwise they bury the findings that need judgement.
 */
export function FindingsSummary({ dossier }: { dossier: CaseDossier }) {
  const missing = dossier.checklist.filter((item) => item.required && item.status === "missing");
  const others = dossier.findings.filter((f) => f.code !== MISSING_CODE);
  const blockers = others.filter((f) => f.severity === "blocker");
  const warnings = others.filter((f) => f.severity === "warning");

  if (missing.length === 0 && blockers.length === 0 && warnings.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-lg bg-ok-wash px-5 py-4 font-semibold text-ok">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden />
        Nessun problema rilevato. Verifica le voci e segna la pratica come pronta.
      </p>
    );
  }

  const summary = [
    missing.length &&
      `${missing.length} ${missing.length === 1 ? "documento mancante" : "documenti mancanti"}`,
    blockers.length && `${blockers.length} ${blockers.length === 1 ? "bloccante" : "bloccanti"}`,
    warnings.length && `${warnings.length} ${warnings.length === 1 ? "avviso" : "avvisi"}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section
      aria-labelledby="findings-title"
      className="overflow-hidden rounded-lg ring-1 ring-line"
    >
      <h2
        id="findings-title"
        className="flex flex-wrap items-baseline gap-x-3 bg-surface px-5 pt-4 pb-3 font-display text-xl font-semibold"
      >
        Da guardare
        <span className="text-sm font-normal text-ink-3">{summary}</span>
      </h2>
      <ul className="divide-y divide-line bg-surface">
        {missing.length > 0 && (
          <li className="flex gap-3 bg-danger-wash/40 px-5 py-3">
            <FileQuestion className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {missing.length === 1
                  ? "Manca 1 documento obbligatorio"
                  : `Mancano ${missing.length} documenti obbligatori`}
              </p>
              {/* Grouped by person: "what is Giulia still missing?" is the operator's question. */}
              <dl className="mt-2 grid gap-2 text-[0.9375rem]">
                {groupByMember(missing, dossier.household).map(([member, items]) => (
                  <div key={member ?? ""}>
                    <dt className="text-sm font-semibold text-ink-2">
                      {member ?? "Tutto il nucleo familiare"}
                    </dt>
                    <dd>
                      <ul className="mt-0.5 grid gap-0.5">
                        {items.map((item) => (
                          <li key={item.id} className="flex gap-2">
                            <span aria-hidden className="text-ink-3">
                              ·
                            </span>
                            <a
                              href={`#item-${item.id}`}
                              className="text-ink-2 hover:text-ink hover:underline"
                            >
                              {item.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        )}
        {groupByCode([...blockers, ...warnings]).map((group) =>
          group.length === 1 ? (
            <FindingRow key={group[0]!.id} finding={group[0]!} />
          ) : (
            <FindingGroup key={group[0]!.code} findings={group} />
          ),
        )}
      </ul>
    </section>
  );
}

/** Summaries for findings that repeat per document; anything else lists its first message. */
const GROUP_TITLES: Record<string, (n: number) => string> = {
  "document.unchecked": (n) =>
    `${n} documenti da controllare a vista: il controllo automatico non ha verificato tutti i dati`,
  "document.expiring": (n) => `${n} documenti in scadenza`,
  "document.wrong_year": (n) => `${n} documenti con un anno diverso da quello richiesto`,
  "document.unmatched": (n) => `${n} documenti non abbinati a una voce`,
};

/** Same-code findings become one line: three identical warnings hide the one that differs. */
function groupByCode(findings: Finding[]) {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    groups.set(finding.code, [...(groups.get(finding.code) ?? []), finding]);
  }
  return [...groups.values()];
}

function FindingGroup({ findings }: { findings: Finding[] }) {
  const first = findings[0]!;
  const blocker = first.severity === "blocker";
  const Icon = blocker ? AlertOctagon : AlertTriangle;
  const title =
    GROUP_TITLES[first.code]?.(findings.length) ??
    `${first.message} (e altri ${findings.length - 1})`;
  return (
    <li className={cn(blocker && "bg-danger-wash/40")}>
      <details className="group">
        <summary className="flex cursor-pointer list-none gap-3 px-5 py-3 transition-colors hover:bg-paper [&::-webkit-details-marker]:hidden">
          <Icon
            className={cn("mt-0.5 size-4.5 shrink-0", blocker ? "text-danger" : "text-warn")}
            aria-hidden
          />
          <span className="flex-1">{title}</span>
          <span className="text-sm text-ink-3 group-open:hidden">Mostra</span>
        </summary>
        <ul className="grid gap-1 px-5 ps-12 pb-3 text-[0.9375rem] text-ink-2">
          {findings.map((finding) => (
            <li key={finding.id}>
              {finding.checklistItemId ? (
                <a
                  href={`#item-${finding.checklistItemId}`}
                  className="hover:text-ink hover:underline"
                >
                  {finding.message}
                </a>
              ) : (
                finding.message
              )}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const blocker = finding.severity === "blocker";
  const Icon = blocker ? AlertOctagon : AlertTriangle;
  const content = (
    <>
      <Icon
        className={cn("mt-0.5 size-4.5 shrink-0", blocker ? "text-danger" : "text-warn")}
        aria-hidden
      />
      <span className="flex-1">{finding.message}</span>
      <span className="sr-only">{blocker ? "Bloccante" : "Avviso"}</span>
    </>
  );
  return (
    <li>
      {finding.checklistItemId ? (
        <a
          href={`#item-${finding.checklistItemId}`}
          className={cn(
            "flex gap-3 px-5 py-3 transition-colors hover:bg-paper",
            blocker && "bg-danger-wash/40",
          )}
        >
          {content}
        </a>
      ) : (
        <div className={cn("flex gap-3 px-5 py-3", blocker && "bg-danger-wash/40")}>{content}</div>
      )}
    </li>
  );
}

/** People in household order (applicant first), then the items that concern everyone. */
function groupByMember(items: CaseDossier["checklist"], household: CaseDossier["household"]) {
  const groups = new Map<string | null, CaseDossier["checklist"]>();
  for (const item of items) {
    const key = item.memberName ?? null;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const names = household.map((member) =>
    [member.firstName, member.lastName].filter(Boolean).join(" "),
  );
  const rank = (name: string | null) => {
    if (name === null) return Number.MAX_SAFE_INTEGER;
    const index = names.indexOf(name);
    return index === -1 ? names.length : index;
  };
  return [...groups].sort(([a], [b]) => rank(a) - rank(b));
}
