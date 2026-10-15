import type { CaseDossier } from "@avanti/contracts";
import type { CopilotDossier } from "@avanti/core";
export function redactContact(text: string): string {
  return text
    .replace(/https?:\/\/\S+|\bwww\.\S+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[contatto omesso]")
    .replace(/(?<!\w)\+?\d[\d ().-]{7,}\d(?!\w)/g, "[contatto omesso]");
}
export function copilotDossier(d: CaseDossier): CopilotDossier {
  const clean = redactContact;
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
