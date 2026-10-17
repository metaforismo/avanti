import type { PilotCount, PilotReport, PilotReportGroup } from "@avanti/contracts";
import { csvCell } from "./audit-log";

const display = (value: string | number | null) =>
  value === null ? "Non misurato / oscurato" : String(value);
const counted = (value: PilotCount, one: string, other: string) =>
  value === null ? display(null) : `${value} ${value === 1 ? one : other}`;
const percentage = (value: number | null) =>
  value === null ? display(null) : `${(value * 100).toFixed(2)}%`;

/** A long-form sheet retains every field of the JSON, including method, samples and reasons. */
export function pilotReportCsv(report: PilotReport): string {
  const rows: string[][] = [["Sezione", "Sportello", "Campo", "Valore"]];
  function flatten(section: string, office: string, path: string, value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach((v, i) => flatten(section, office, `${path}[${i}]`, v));
    } else if (typeof value === "object" && value !== null) {
      for (const [key, v] of Object.entries(value))
        flatten(section, office, path ? `${path}.${key}` : key, v);
    } else rows.push([section, office, path, value === null ? display(null) : String(value)]);
  }
  const { total, offices, ...metadata } = report;
  flatten("Metodo e periodo", "", "", metadata);
  flatten("Totale", "", "", total);
  for (const group of offices) flatten("Sportello", group.office!.name, "", group);
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function pilotReportPdf(report: PilotReport): Promise<Uint8Array> {
  const [{ PDFDocument }, { loadFonts, UnicodePrinter }] = await Promise.all([
    import("pdf-lib"),
    import("./export"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Avanti - Rapporto del pilota");
  pdf.setAuthor("Avanti");
  pdf.setProducer("Avanti / pdf-lib");
  pdf.setCreationDate(new Date(report.generatedAt));
  pdf.setModificationDate(new Date(report.generatedAt));
  const printer = new UnicodePrinter(pdf, await loadFonts(pdf, JSON.stringify(report)), {
    header: "Avanti - Rapporto del pilota",
    subtitle: `${report.period.from} / ${report.period.to} - Europe/Rome`,
    footer: "Rapporto aggregato - risultati operativi, non prova causale",
  });
  printer.paragraph("Rapporto del pilota", 19);
  printer.paragraph(
    `Generato: ${report.generatedAt}. Osservato fino a: ${report.period.observedUntilExclusive}.`,
    9,
  );
  printer.paragraph(
    `${report.baseline.label}: ${counted(report.baseline.manualMinutesPerCase, "minuto", "minuti")} per caso.`,
    10,
  );
  const printGroup = (group: PilotReportGroup) => {
    printer.section(
      group.office ? `Sportello: ${group.office.name}` : "Totale degli sportelli selezionati",
    );
    printer.paragraph(
      `Avvii: ${display(group.starts)}; consegne: ${display(group.deliveries)}; consegne/avvii: ${percentage(group.deliveryRate.value)} (campione: ${display(group.deliveryRate.sample)}).`,
    );
    printer.paragraph(
      `Completezza alla consegna: ${percentage(group.completeness.value)}; senza blocchi: ${display(group.completeness.complete)}; campione: ${display(group.completeness.sample)}; valori mancanti: ${display(group.completeness.missing)}. Proxy automatico, da verificare.`,
    );
    printer.paragraph(
      `Integrazioni: ${counted(group.integrations.requests, "richiesta", "richieste")} su ${counted(group.integrations.cases, "pratica", "pratiche")}.`,
    );
    for (const time of group.times)
      printer.paragraph(
        `${time.label}: ${time.value === null ? display(null) : time.value.toFixed(2)} minuti; campione: ${display(time.sample)}.`,
      );
    printer.paragraph(
      `Lingue degli avvii: ${group.byLanguage.map((v) => `${v.language}: ${display(v.count)}`).join("; ") || "Nessun avvio"}.`,
    );
    printer.paragraph(
      `Tipi di pratica: ${group.byPractice.map((v) => `${v.practiceId ?? "Non classificata"}: ${display(v.count)}`).join("; ") || "Nessun avvio"}.`,
    );
    const titles = {
      net_minutes_saved: "Risparmio netto >=5 minuti",
      completeness_gain_pp: "Completezza verificata +15 punti",
      delivery_rate: "Consegne/avvii >=70%",
    };
    for (const threshold of group.thresholds) {
      printer.paragraph(
        `${titles[threshold.id]}: ${threshold.outcome.replaceAll("_", " ")}. Minimo: ${threshold.minimumSample}; campione: ${display(threshold.sample)}; campione baseline: ${display(threshold.baselineSample)}; valore: ${display(threshold.observed)}. ${threshold.reason}`,
        9,
      );
    }
  };
  printGroup(report.total);
  for (const group of report.offices) {
    printer.newPage();
    printGroup(group);
  }
  printer.newPage();
  printer.section("Come leggere il rapporto");
  for (const text of report.method) printer.paragraph(text, 9);
  printer.finish();
  return pdf.save();
}
