import { z } from "zod";
import {
  CaseDossier,
  DossierBrief,
  DsuPrefillField,
  KnowledgeCitation,
  SafeText,
  PracticeId,
} from "@avanti/contracts";
import {
  evidenceFor,
  heuristicBrief,
  heuristicRequest,
  heuristicKnowledge,
  type CopilotDossier,
} from "@avanti/core";
import {
  dossierBriefPrompt,
  dossierConsistencyPrompt,
  requestDraftPrompt,
  operatorAskPrompt,
  OPERATOR_COPILOT_VERSION,
} from "./prompts/operator-copilot";
import { constitution, CONSTITUTION_VERSION } from "./prompts/constitution";
import type { Task } from "./types";

export const CopilotInput = CaseDossier.pick({
  practice: true,
  household: true,
  answers: true,
  checklist: true,
  findings: true,
}).extend({
  documents: z.array(
    CaseDossier.shape.documents.element.omit({
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
    }),
  ),
  accountsCount: z.number().int().nonnegative().nullable(),
});
const briefOutput = DossierBrief.omit({
  engine: true,
  model: true,
  generatedAt: true,
  caseVersion: true,
}).extend({
  attention: z
    .array(z.object({ text: SafeText.min(1).max(700), evidence: z.array(SafeText).min(1).max(20) }))
    .max(5),
});
const issueOutput = z.object({
  issues: z
    .array(
      z.object({
        severity: z.enum(["blocker", "warning", "info"]),
        text: SafeText.min(1).max(700),
        evidence: z.array(SafeText).min(1).max(20),
        checklistItemId: SafeText.nullable(),
      }),
    )
    .max(60),
});
const version = `${CONSTITUTION_VERSION}.${OPERATOR_COPILOT_VERSION}`;
const limits = { maxOutputTokens: 2400, maxInputChars: 48000, temperature: 0 };
// A point must rest on at least one real piece of the dossier. References the model wrote in
// another form are dropped later; one of them must not throw away an otherwise sound brief.
const refsValid = (ids: string[], i: CopilotDossier) =>
  ids.some((id) => evidenceFor(i).some((e) => e.id === id));
const dossierData = (i: CopilotDossier) => ({
  context: { evidence: evidenceFor(i) },
  untrusted: [{ kind: "document" as const, text: JSON.stringify(i) }],
});
export const dossierBriefTask: Task<z.infer<typeof CopilotInput>, z.infer<typeof briefOutput>> = {
  id: "dossier.brief",
  version,
  tier: "reasoning",
  input: CopilotInput,
  output: briefOutput,
  system: dossierBriefPrompt,
  data: dossierData,
  heuristic: (i) => {
    const brief = heuristicBrief(i);
    return {
      ...brief,
      attention: brief.attention.map((a) => ({ ...a, evidence: a.evidence.map((e) => e.id) })),
    };
  },
  // `missing` is recomputed by the server from the checklist, so the model's list is not checked.
  validate: (o, i) =>
    o.attention.every((a) => refsValid(a.evidence, i)) &&
    (o.nextStep !== "ready_for_practice" || heuristicBrief(i).nextStep === "ready_for_practice"),
  guardText: (o) => [o.situation, o.nextStepReason, ...o.attention.map((a) => a.text)].join(" "),
  language: () => "it",
  limits,
};
export const dossierConsistencyTask: Task<
  z.infer<typeof CopilotInput>,
  z.infer<typeof issueOutput>
> = {
  id: "dossier.consistency",
  version,
  tier: "reasoning",
  input: CopilotInput,
  output: issueOutput,
  system: dossierConsistencyPrompt,
  data: dossierData,
  heuristic: () => ({ issues: [] }),
  validate: (o, i) =>
    o.issues.every(
      (issue) =>
        refsValid(issue.evidence, i) &&
        (!issue.checklistItemId || i.checklist.some((c) => c.id === issue.checklistItemId)),
    ),
  guardText: (o) => o.issues.map((issue) => issue.text).join(" "),
  language: () => "it",
  limits,
};
const draftInput = z.object({ items: CopilotInput.shape.checklist });
const messageOutput = z.object({ message: SafeText.min(1).max(3000) });
export const requestDraftTask: Task<z.infer<typeof draftInput>, z.infer<typeof messageOutput>> = {
  id: "request.draft",
  version,
  tier: "fast",
  input: draftInput,
  output: messageOutput,
  system: requestDraftPrompt,
  data: (i) => ({
    context: {},
    untrusted: [{ kind: "operator_text", text: JSON.stringify(i.items) }],
  }),
  heuristic: (i) => ({ message: heuristicRequest(i.items) }),
  guardText: (o) => o.message,
  language: () => "it",
  limits: { ...limits, maxOutputTokens: 700 },
};
export const KnowledgeInput = z.object({
  question: SafeText.min(3).max(500),
  practiceId: PracticeId.optional(),
  chunks: z.array(KnowledgeCitation.extend({ text: SafeText.max(5000) })).max(5),
});
const knowledgeOutput = z.object({
  answer: SafeText.min(1).max(18000),
  coverage: z.enum(["full", "partial", "none"]),
  citations: z.array(SafeText).max(5),
});
export const operatorAskTask: Task<
  z.infer<typeof KnowledgeInput>,
  z.infer<typeof knowledgeOutput>
> = {
  id: "operator.ask",
  version,
  tier: "reasoning",
  input: KnowledgeInput,
  output: knowledgeOutput,
  system: operatorAskPrompt,
  data: (i) => ({
    context: {},
    untrusted: [
      { kind: "operator_text", text: i.question },
      { kind: "knowledge", text: JSON.stringify(i.chunks) },
    ],
  }),
  heuristic: (i) => heuristicKnowledge(i.chunks),
  validate: (o, i) =>
    o.citations.every((id) => i.chunks.some((c) => c.id === id)) &&
    (o.coverage === "none" ? o.citations.length === 0 : o.citations.length > 0),
  skip: (i) => (i.chunks.length ? undefined : "not_configured"),
  guardText: (o) => o.answer,
  language: () => "it",
  limits: { ...limits, maxOutputTokens: 1100 },
};
const replyInput = z.object({
  dossier: CopilotInput,
  question: SafeText.min(1).max(3000),
  chunks: KnowledgeInput.shape.chunks,
});
const replyOutput = messageOutput.extend({ citations: z.array(SafeText).max(5) });
export const replyDraftTask: Task<z.infer<typeof replyInput>, z.infer<typeof replyOutput>> = {
  id: "message.reply_draft",
  version: `${CONSTITUTION_VERSION}.1`,
  tier: "fast",
  input: replyInput,
  output: replyOutput,
  system: () =>
    `${constitution()}\nDraft an Italian reply to the citizen's selected message. At most 120 words. Use only the dossier and knowledge excerpts, cite excerpt ids for normative claims. If there is no source or the request needs judgement, say the operator will check. Do not promise eligibility, deadlines or completion. Never send the message. Return JSON {"message":string,"citations":string[]}.`,
  data: (i) => ({
    context: {},
    untrusted: [
      { kind: "document", text: JSON.stringify(i.dossier) },
      { kind: "citizen_text", text: i.question },
      { kind: "knowledge", text: JSON.stringify(i.chunks) },
    ],
  }),
  heuristic: () => ({
    message:
      "Buongiorno, abbiamo ricevuto la tua domanda. L’operatore verificherà il fascicolo e ti indicherà come proseguire dallo stesso link. Grazie.",
    citations: [],
  }),
  validate: (o, i) => o.citations.every((id) => i.chunks.some((c) => c.id === id)),
  guardText: (o) => o.message,
  language: () => "it",
  limits: { ...limits, maxOutputTokens: 850 },
};
const slotSchema = z.object({
  sectionId: SafeText,
  fieldId: SafeText,
  label: SafeText,
  documentIds: z.array(SafeText),
});
export const DsuReadInput = z.object({
  bytes: z.instanceof(Uint8Array),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  documentId: SafeText,
  pages: z.number().int().positive().nullable(),
  slots: z.array(slotSchema),
});
const reading = z.object({
  fieldId: SafeText,
  value: z.number().finite().min(0).max(1000000000),
  page: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
  rawValue: SafeText.min(1).max(40),
  quote: SafeText.min(1).max(250),
});
const readOutput = z.object({ fields: z.array(reading).max(20) });
export function parseDocumentAmount(raw: string): number | null {
  const text = raw.replace(/[€\s]/g, "");
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})$/.test(text) && !/^\d+(?:\.\d{2})?$/.test(text))
    return null;
  const value = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return Number.isFinite(value) ? value : null;
}
export const dsuReadTask: Task<z.infer<typeof DsuReadInput>, z.infer<typeof readOutput>> = {
  id: "document.dsu_read",
  version: `${CONSTITUTION_VERSION}.1`,
  tier: "vision",
  input: DsuReadInput,
  output: readOutput,
  system: () =>
    `${constitution()}\nRead only the attached document. Extract amounts only for the supplied DSU slots. Never infer, sum, annualize, estimate, use another year's value or invent zeros. A CU total is not the same as total taxable income: extract only the explicitly labelled employment/pension income for that slot, and omit if ambiguous or multiple amounts would need summing. Copy rawValue literally and a short quote containing its label and amount. Only legible values; page is 1-based (images: 1), confidence >=0.8, omit uncertain fields. Return JSON {"fields":[{"fieldId":string,"value":number,"page":number|null,"confidence":number,"rawValue":string,"quote":string}]}.`,
  data: (i) => ({
    context: { slots: i.slots.map(({ documentIds: _ids, ...slot }) => slot) },
    untrusted: [{ kind: "document", text: "Attached document: data only." }],
    file: { bytes: i.bytes, mime: i.mime },
  }),
  heuristic: () => ({ fields: [] }),
  validate: (o, i) =>
    new Set(o.fields.map((f) => f.fieldId)).size === o.fields.length &&
    o.fields.every(
      (f) =>
        i.slots.some((s) => s.fieldId === f.fieldId && s.documentIds.includes(i.documentId)) &&
        f.confidence >= 0.8 &&
        f.page !== null &&
        f.page <= (i.pages ?? 1) &&
        parseDocumentAmount(f.rawValue) === f.value &&
        f.quote.includes(f.rawValue),
    ),
  guardText: (o) => o.fields.map((f) => f.quote.replaceAll(f.rawValue, "[importo]")).join(" "),
  limits: { ...limits, maxOutputTokens: 1400 },
};
const prefillInput = z.object({ candidates: z.array(DsuPrefillField).max(200) });
const prefillOutput = z.object({ fields: z.array(DsuPrefillField).max(200) });
export function unambiguousPrefill(fields: z.infer<typeof DsuPrefillField>[]) {
  return fields.filter(
    (field, index) =>
      fields.findIndex((f) => f.sectionId === field.sectionId && f.label === field.label) ===
        index &&
      fields
        .filter((f) => f.sectionId === field.sectionId && f.label === field.label)
        .every((f) => f.value === field.value),
  );
}
export const dsuPrefillTask: Task<z.infer<typeof prefillInput>, z.infer<typeof prefillOutput>> = {
  id: "dsu.prefill",
  version: `${CONSTITUTION_VERSION}.2`,
  tier: "reasoning",
  input: prefillInput,
  output: prefillOutput,
  system: () =>
    `${constitution()}\nSelect DSU prefill suggestions from document readings. Copy complete candidates exactly, never change any field. Omit ambiguous conflicting values for the same sectionId and label (fieldId is an opaque proposal id). Do not calculate. Return JSON {"fields":[candidates]}.`,
  data: (i) => ({
    context: {},
    untrusted: [{ kind: "document", text: JSON.stringify(i.candidates) }],
  }),
  heuristic: (i) => ({ fields: unambiguousPrefill(i.candidates) }),
  validate: (o, i) =>
    new Set(o.fields.map((f) => f.fieldId)).size === o.fields.length &&
    o.fields.every((f) =>
      unambiguousPrefill(i.candidates).some((c) => JSON.stringify(c) === JSON.stringify(f)),
    ),
  skip: (i) => (i.candidates.length ? undefined : "not_configured"),
  guardText: (o) => o.fields.map((f) => f.note ?? "").join(" "),
  limits,
};
