import {
  PilotReport,
  PilotReportQuery,
  type PilotReportGroup,
  type PilotCount,
  type PilotThreshold,
  type Language,
  type PracticeId,
} from "@avanti/contracts";
import { romeMidnight, type MetricCase, type MetricEvent } from "./operator-metrics";
import { minutes } from "./dossier";

export type PilotCase = MetricCase & { officeId: string };
export type PilotOffice = { id: string; name: string };

export function pilotReportRange(query: PilotReportQuery) {
  const q = PilotReportQuery.parse(query);
  const next = new Date(`${q.to}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  // A leap-year calendar window can span 366 days plus an hour at the DST boundary.
  // The query schema bounds calendar dates; do not reapply an elapsed-hours limit.
  return { start: romeMidnight(q.from), end: romeMidnight(next.toISOString().slice(0, 10)) };
}
const small = (n: number) => n > 0 && n < 5;
const count = (n: number, suppress = false): PilotCount =>
  small(n) ? "<5" : n > 0 && suppress ? null : n;
const method = [
  "Avvio: una pratica creata nel periodo, anche se abbandonata o chiusa. Il rapporto include tutti i tipi di pratica; non isola la coorte ISEE ordinario del protocollo. Gli inviti mai aperti non sono registrati.",
  "Consegna: primo invio all'operatore entro la fine del periodo, fra le pratiche avviate nello stesso periodo. I reinvii non contano di nuovo. Non è una trasmissione agli enti. Le consegne di avvii precedenti sono escluse.",
  "Completezza alla consegna: quota di primi invii con zero segnalazioni bloccanti, salvata al primo invio. Non è la verifica umana al primo appuntamento. I valori mancanti sono esclusi dal denominatore e dichiarati.",
  "Integrazioni: eventi case.requested o citizen.requested dopo il primo invio, entro il periodo, e numero di pratiche consegnate interessate. Non contiamo il testo dei messaggi o contatti fuori Avanti.",
  "Tempi: medie degli intervalli creazione-primo invio e inizio revisione-ultimo pronto registrato nel periodo sulla coorte. Includono pause e attese; non sono minuti attivi del cittadino o lavoro netto dell'operatore. Le revisioni prive di durata registrata sono escluse: il timestamp mutabile della pratica non ricostruisce un vecchio inizio revisione.",
  "Baseline: minuti manuali dichiarati nelle impostazioni attuali del CAF, comuni agli sportelli. Campione, periodo, completezza verificata e timer attivi con assistenza e copia nel gestionale non sono registrati. Nessuna differenza fra baseline e tempi di calendario dimostra risparmio netto.",
  "Soglie operative: 5 minuti netti risparmiati, +15 punti di completezza verificata, 70% consegne/avvii. Minimo 50 casi per gruppo e 50 nel confronto, proposto dal playbook; non garantisce significatività statistica. Per la conversione servono 50 avvii e periodo concluso. Nessun arrotondamento prima della decisione.",
  "Lingue e tipi: distribuzione degli avvii secondo la lingua e il tipo attualmente salvati; tipo non classificato incluso. Non è lo storico dei cambi di lingua.",
  "Riservatezza: conteggi positivi inferiori a 5 sono <5. null indica dato non misurato o oscurato; le altre celle di una distribuzione e i totali ricostruibili sono oscurati. Quote con numeratore o complemento piccolo e tempi con meno di 5 osservazioni sono oscurati. Zero resta zero. Il minimo di 50 è pubblico, non è un conteggio di cittadini.",
  "Limiti: solo dati ancora conservati in Avanti alla generazione, osservati fino al minore fra fine periodo e ora di generazione; cancellazioni e retention riducono la coorte. Periodi futuri o incompleti non producono un esito di conversione. Confronti fra esportazioni sovrapposte richiedono cautela: la soppressione delle celle non garantisce anonimato contro interrogazioni ripetute.",
];

function partition<K extends string | null>(values: K[]) {
  const groups = new Map<K, number>();
  for (const key of values) groups.set(key, (groups.get(key) ?? 0) + 1);
  const suppress = [...groups.values()].some(small);
  return [...groups]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([key, n]) => ({ key, count: count(n, suppress) }));
}
function summary(label: string, values: number[], suppress: boolean) {
  return {
    label,
    sample: count(values.length, suppress),
    value:
      values.length >= 5 && !suppress ? values.reduce((a, b) => a + b, 0) / values.length : null,
  };
}
function group(
  office: PilotOffice | null,
  rows: PilotCase[],
  events: MetricEvent[],
  end: number,
  periodFinished: boolean,
  suppress = false,
): PilotReportGroup {
  const delivered = rows.filter((r) => r.submittedAt !== null && Date.parse(r.submittedAt) < end);
  const known = delivered.filter((r) => r.firstSubmissionComplete !== null);
  const complete = known.filter((r) => r.firstSubmissionComplete === true).length;
  // Every repeated sample can disclose a masked complement; suppress the group together.
  suppress ||=
    small(rows.length - delivered.length) ||
    small(delivered.length - known.length) ||
    small(known.length - complete);
  const deliveredById = new Map(delivered.map((r) => [r.id, r]));
  const requests = events.filter(
    (e) =>
      ["case.requested", "citizen.requested"].includes(e.type) &&
      e.caseId !== null &&
      deliveredById.has(e.caseId) &&
      Date.parse(e.at) >= Date.parse(deliveredById.get(e.caseId)!.submittedAt!) &&
      Date.parse(e.at) < end,
  );
  const requestedCases = new Set(requests.map((e) => e.caseId)).size;
  const latest = new Map<string, MetricEvent>();
  for (const event of events) {
    if (!event.caseId || event.type !== "review.completed" || Date.parse(event.at) >= end) continue;
    const previous = latest.get(event.caseId);
    if (!previous || Date.parse(previous.at) < Date.parse(event.at))
      latest.set(event.caseId, event);
  }
  const review = delivered.flatMap((r) => {
    const event = latest.get(r.id);
    const duration = event?.metadata.durationMinutes;
    return event &&
      Date.parse(event.at) >= Date.parse(r.submittedAt!) &&
      typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration >= 0
      ? [duration]
      : [];
  });
  const citizen = delivered.flatMap((r) => {
    const duration = minutes(r.createdAt, r.submittedAt);
    return duration !== null && Number.isFinite(duration) && duration >= 0 ? [duration] : [];
  });
  const ratio = (numerator: number, denominator: number) =>
    !suppress && denominator >= 5 && !small(numerator) && !small(denominator - numerator)
      ? numerator / denominator
      : null;
  const conversion = ratio(delivered.length, rows.length);
  const threshold = (
    id: PilotThreshold["id"],
    target: number,
    unit: PilotThreshold["unit"],
    reason: string,
  ): PilotThreshold => ({
    id,
    target,
    unit,
    minimumSample: 50,
    sample: 0,
    baselineSample: null,
    observed: null,
    outcome: "dati_insufficienti",
    reason,
  });
  const conversionThreshold = threshold(
    "delivery_rate",
    0.7,
    "ratio",
    "Servono almeno 50 avvii, un periodo concluso e celle pubblicabili.",
  );
  conversionThreshold.sample = count(rows.length, suppress);
  if (rows.length >= 50 && periodFinished && conversion !== null) {
    conversionThreshold.observed = conversion;
    conversionThreshold.outcome =
      delivered.length * 10 >= rows.length * 7 ? "raggiunta" : "non_raggiunta";
    conversionThreshold.reason =
      "Consegne della stessa coorte / avvii; confronto esatto con 70%. Risultato operativo, non prova causale.";
  }
  return {
    office,
    starts: count(rows.length, suppress),
    deliveries: count(delivered.length, suppress || small(rows.length - delivered.length)),
    deliveryRate: {
      label: "Primi invii della coorte / avvii",
      value: conversion,
      sample: count(rows.length, suppress),
    },
    completeness: {
      label:
        "Primi invii senza segnalazioni bloccanti / primi invii con valore registrato (proxy automatico)",
      value: small(delivered.length - known.length) ? null : ratio(complete, known.length),
      sample: count(known.length, suppress || small(delivered.length - known.length)),
      complete: count(complete, suppress || small(known.length - complete)),
      missing: count(delivered.length - known.length, suppress),
    },
    integrations: {
      requests: count(requests.length, suppress || small(requestedCases)),
      cases: count(requestedCases, suppress),
    },
    times: [
      {
        id: "creation_to_submission",
        unit: "minutes",
        ...summary(
          "Tempo di calendario creazione-primo invio (incluse pause e attese)",
          citizen,
          suppress || small(rows.length - citizen.length),
        ),
      },
      {
        id: "review_to_ready",
        unit: "minutes",
        ...summary(
          "Tempo di calendario inizio revisione-ultimo pronto (durata registrata, incluse pause e attese)",
          review,
          suppress || small(delivered.length - review.length),
        ),
      },
    ],
    byLanguage: partition<Language>(rows.map((r) => r.language)).map(({ key, count: n }) => ({
      language: key,
      count: suppress && typeof n === "number" && n > 0 ? null : n,
    })),
    byPractice: partition<PracticeId | null>(rows.map((r) => r.practiceId)).map(
      ({ key, count: n }) => ({
        practiceId: key,
        count: suppress && typeof n === "number" && n > 0 ? null : n,
      }),
    ),
    thresholds: [
      threshold(
        "net_minutes_saved",
        5,
        "minutes",
        "Minuti attivi netti, handoff e numerosità della baseline non registrati; i tempi di calendario non sono confrontabili.",
      ),
      threshold(
        "completeness_gain_pp",
        15,
        "percentage_points",
        "Baseline di completezza e completezza verificata al primo appuntamento non registrate; il proxy automatico non dimostra +15 punti.",
      ),
      conversionThreshold,
    ],
  };
}

export function calculatePilotReport(
  query: PilotReportQuery,
  rows: PilotCase[],
  events: MetricEvent[],
  offices: PilotOffice[],
  baselineMinutesPerCase: number | null,
  now: Date,
): PilotReport {
  const q = PilotReportQuery.parse(query);
  const { start, end } = pilotReportRange(q);
  const observedEnd = Math.min(end.getTime(), now.getTime());
  const ids = new Set(offices.map((o) => o.id));
  const cohort = rows.filter(
    (r) =>
      ids.has(r.officeId) &&
      (!q.office || r.officeId === q.office) &&
      Date.parse(r.createdAt) >= start.getTime() &&
      Date.parse(r.createdAt) < observedEnd,
  );
  const relevant = new Set(cohort.map((r) => r.id));
  const cohortEvents = events.filter(
    (e) =>
      e.caseId &&
      relevant.has(e.caseId) &&
      Date.parse(e.at) >= start.getTime() &&
      Date.parse(e.at) < observedEnd,
  );
  const officeByCase = new Map(cohort.map((r) => [r.id, r.officeId]));
  const rowsByOffice = new Map<string, PilotCase[]>();
  const eventsByOffice = new Map<string, MetricEvent[]>();
  for (const row of cohort) {
    const bucket = rowsByOffice.get(row.officeId) ?? [];
    bucket.push(row);
    rowsByOffice.set(row.officeId, bucket);
  }
  for (const event of cohortEvents) {
    const officeId = officeByCase.get(event.caseId!)!;
    const bucket = eventsByOffice.get(officeId) ?? [];
    bucket.push(event);
    eventsByOffice.set(officeId, bucket);
  }
  const groups = offices
    .filter((o) => !q.office || o.id === q.office)
    .map((o) =>
      group(
        o,
        rowsByOffice.get(o.id) ?? [],
        eventsByOffice.get(o.id) ?? [],
        observedEnd,
        now >= end,
      ),
    );
  // A total and other offices must not reveal a suppressed office by subtraction (including weighted means).
  const sensitive = groups.some(
    (g) =>
      JSON.stringify(g).includes('"<5"') ||
      g.deliveries === null ||
      g.completeness.sample === null ||
      g.times.some((t) => t.sample === null) ||
      g.byLanguage.some((v) => v.count === null) ||
      g.byPractice.some((v) => v.count === null),
  );
  return PilotReport.parse({
    version: 1,
    generatedAt: now.toISOString(),
    period: {
      from: q.from,
      to: q.to,
      timeZone: "Europe/Rome",
      startInclusive: start.toISOString(),
      endExclusive: end.toISOString(),
      observedUntilExclusive: new Date(observedEnd).toISOString(),
    },
    baseline: {
      manualMinutesPerCase: baselineMinutesPerCase,
      sample: null,
      completeAtFirstAppointment: null,
      label:
        "Baseline manuale dichiarata dal CAF nelle impostazioni attuali; campione e periodo non registrati",
    },
    method,
    total: group(null, cohort, cohortEvents, observedEnd, now >= end, sensitive),
    offices: groups,
  });
}
