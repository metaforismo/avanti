import type { CaseDossier } from "@avanti/contracts";
import type { CopilotDossier } from "@avanti/core";
export function redactContact(text: string): string {
  return text
    .replace(/https?:\/\/\S+|\bwww\.\S+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[contatto omesso]")
    .replace(/(?<!\w)\+?\d[\d ().-]{7,}\d(?!\w)/g, "[contatto omesso]");
}
/**
 * Model text sometimes quotes the evidence ids it was told to cite ("(answer account_owner_0)",
 * a uuid). Those mean nothing to an operator: they are removed before anything is shown.
 */
export function stripInternalIds(text: string): string {
  return (
    text
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
      // Italian prose never contains underscores: any such token is a key or an id.
      .replace(/[^\s(),;]*_[^\s(),;]*/g, "")
      .replace(/\b(?:answer|checklist|document|finding)\b(?=[\s,;)]*(?:[,;)]|$))/gi, "")
      .replace(/\(\s*[,;\s]*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,;:)])/g, "$1")
      .trim()
  );
}

export function copilotDossier(d: CaseDossier): CopilotDossier {
  // Rule findings also embed filenames; omitting only documents.fileName is insufficient.
  const names = d.documents
    .map((doc) => doc.fileName)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const clean = (text: string) =>
    redactContact(
      names.reduce((value, name) => value.split(name).join("Documento caricato"), text),
    );
  const count = d.answers.find((a) => a.questionId === "accounts_count")?.answer;
  return {
    practice: d.practice,
    household: d.household.map((m) => ({
      ...m,
      firstName: clean(m.firstName),
      lastName: m.lastName ? clean(m.lastName) : undefined,
    })),
    answers: d.answers.map((a) => ({ ...a, answer: clean(a.answer), question: clean(a.question) })),
    checklist: d.checklist.map((i) => ({
      ...i,
      title: clean(i.title),
      description: clean(i.description),
      howToGet: i.howToGet ? clean(i.howToGet) : null,
      memberName: i.memberName ? clean(i.memberName) : null,
      note: i.note ? clean(i.note) : null,
    })),
    documents: d.documents.map(
      ({ fileName: _name, mimeType: _mime, sizeBytes: _size, uploadedAt: _at, ...doc }) => ({
        ...doc,
        // Citizen-facing check messages quote the file name: only the status reaches the model.
        citizenCheck: { status: doc.citizenCheck.status, messages: [] },
        analysis: doc.analysis
          ? {
              ...doc.analysis,
              ownerName: doc.analysis.ownerName ? clean(doc.analysis.ownerName) : null,
              detectedLabel: doc.analysis.detectedLabel ? clean(doc.analysis.detectedLabel) : null,
              findings: doc.analysis.findings.map((f) => ({
                ...f,
                message: clean(f.message),
                operatorMessage: f.operatorMessage ? clean(f.operatorMessage) : undefined,
              })),
            }
          : null,
      }),
    ),
    findings: d.findings.map((f) => ({
      ...f,
      message: clean(f.message),
      operatorMessage: f.operatorMessage ? clean(f.operatorMessage) : undefined,
    })),
    accountsCount: count && /^\d+$/.test(count) ? Number(count) : null,
  };
}
