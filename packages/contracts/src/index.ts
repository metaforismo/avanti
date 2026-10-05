/**
 * Shared API contracts between @avanti/api (backend) and @avanti/web (frontend).
 * Every request body is validated with these schemas on the server; the frontend
 * imports the inferred types. Changing a schema is a breaking API change.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const LANGUAGES = ["it", "en", "fr", "es", "ro", "uk", "ar", "bn"] as const;
export const Language = z.enum(LANGUAGES);
export type Language = z.infer<typeof Language>;
export const RTL_LANGUAGES: readonly Language[] = ["ar"];

export const Id = z.string().min(1).max(64);
export const IsoDateTime = z.string().datetime({ offset: true });
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ------------------------------------------------------------------ */
/* Practice catalog                                                    */
/* ------------------------------------------------------------------ */

export const PRACTICE_IDS = [
  "isee_ordinario",
  "isee_universitario",
  "modello_730",
  "red",
  "assegno_unico",
  "successione_semplice",
  "permesso_soggiorno",
  "cittadinanza",
  "naspi",
] as const;
export const PracticeId = z.enum(PRACTICE_IDS);
export type PracticeId = z.infer<typeof PracticeId>;

export const PracticeCategory = z.enum([
  "fiscale",
  "assistenza",
  "previdenza",
  "immigrazione",
  "successioni",
]);
export type PracticeCategory = z.infer<typeof PracticeCategory>;

/** `available`: full interview + checklist. `beta`: checklist only. `coming_soon`: listed, not startable. */
export const PracticeAvailability = z.enum(["available", "beta", "coming_soon"]);
export type PracticeAvailability = z.infer<typeof PracticeAvailability>;

export const PracticeSummary = z.object({
  id: PracticeId,
  category: PracticeCategory,
  availability: PracticeAvailability,
  /** Localized, e.g. "ISEE ordinario". */
  name: z.string(),
  /** Localized one-liner shown to citizens. */
  description: z.string(),
  /** Reference year the documents refer to, when relevant (ISEE 2027 → redditi 2025). */
  referenceYear: z.number().int().nullable(),
  estimatedMinutes: z.number().int().positive(),
});
export type PracticeSummary = z.infer<typeof PracticeSummary>;

/* ------------------------------------------------------------------ */
/* Interview                                                           */
/* ------------------------------------------------------------------ */

export const QuestionKind = z.enum([
  "single_choice",
  "multi_choice",
  "yes_no",
  "number",
  "text",
  "date",
  "members",
]);
export type QuestionKind = z.infer<typeof QuestionKind>;

export const QuestionOption = z.object({
  value: z.string(),
  label: z.string(),
  hint: z.string().optional(),
});
export type QuestionOption = z.infer<typeof QuestionOption>;

export const Question = z.object({
  id: z.string(),
  kind: QuestionKind,
  /** Localized prompt in the case language. */
  prompt: z.string(),
  /** Localized short explanation of why we ask. */
  help: z.string().optional(),
  options: z.array(QuestionOption).optional(),
  required: z.boolean(),
  min: z.number().optional(),
  max: z.number().optional(),
  /** Section label for progress UI, e.g. "Nucleo familiare". */
  section: z.string(),
});
export type Question = z.infer<typeof Question>;

export const MemberRole = z.enum(["richiedente", "coniuge", "figlio", "genitore", "altro"]);
export type MemberRole = z.infer<typeof MemberRole>;

export const MemberInput = z.object({
  role: MemberRole,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(),
});
export type MemberInput = z.infer<typeof MemberInput>;

export const Member = MemberInput.extend({ id: Id });
export type Member = z.infer<typeof Member>;

export const AnswerValue = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(200)).max(50),
  z.array(MemberInput).max(20),
]);
export type AnswerValue = z.infer<typeof AnswerValue>;

/* ------------------------------------------------------------------ */
/* Findings, checklist, documents                                      */
/* ------------------------------------------------------------------ */

export const Severity = z.enum(["blocker", "warning", "info", "ok"]);
export type Severity = z.infer<typeof Severity>;

export const Finding = z.object({
  id: z.string(),
  severity: Severity,
  /** Stable machine code, e.g. "document.expired", "checklist.missing". */
  code: z.string(),
  /** Localized, human readable. */
  message: z.string(),
  checklistItemId: Id.nullable(),
  documentId: Id.nullable(),
  memberId: Id.nullable(),
});
export type Finding = z.infer<typeof Finding>;

export const ChecklistGroup = z.enum([
  "identita",
  "nucleo",
  "casa",
  "redditi",
  "patrimonio_mobiliare",
  "patrimonio_immobiliare",
  "veicoli",
  "lavoro",
  "soggiorno",
  "altro",
]);
export type ChecklistGroup = z.infer<typeof ChecklistGroup>;

export const ChecklistStatus = z.enum([
  "missing",
  "uploaded",
  "issue",
  "verified",
  "rejected",
  "waived",
]);
export type ChecklistStatus = z.infer<typeof ChecklistStatus>;

export const ChecklistItem = z.object({
  id: Id,
  requirementId: z.string(),
  group: ChecklistGroup,
  title: z.string(),
  description: z.string(),
  /** Where/how the citizen can obtain the document. */
  howToGet: z.string().nullable(),
  required: z.boolean(),
  memberId: Id.nullable(),
  memberName: z.string().nullable(),
  status: ChecklistStatus,
  documentIds: z.array(Id),
  /** Operator note when rejected/waived, visible to the citizen. */
  note: z.string().nullable(),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const DocumentAnalysis = z.object({
  engine: z.enum(["ai", "heuristic"]),
  /** Catalog requirement id the document most likely satisfies. */
  detectedRequirementId: z.string().nullable(),
  detectedLabel: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  ownerName: z.string().nullable(),
  referenceYear: z.number().int().nullable(),
  expiresOn: IsoDate.nullable(),
  legible: z.boolean(),
  pagesComplete: z.boolean().nullable(),
  findings: z.array(Finding),
});
export type DocumentAnalysis = z.infer<typeof DocumentAnalysis>;

export const DocumentStatus = z.enum(["processing", "analyzed", "failed"]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const DocumentSummary = z.object({
  id: Id,
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  pages: z.number().int().positive().nullable(),
  uploadedAt: IsoDateTime,
  checklistItemId: Id.nullable(),
  memberId: Id.nullable(),
  status: DocumentStatus,
  analysis: DocumentAnalysis.nullable(),
});
export type DocumentSummary = z.infer<typeof DocumentSummary>;

export const UPLOAD_LIMITS = {
  maxBytes: 4 * 1024 * 1024,
  mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"],
} as const;

/* ------------------------------------------------------------------ */
/* Case                                                                */
/* ------------------------------------------------------------------ */

/**
 * intake        citizen is answering / uploading
 * submitted     citizen sent the dossier, waiting for an operator
 * in_review     an operator opened it
 * needs_citizen operator asked the citizen for something
 * ready         operator verified, ready to be filed in the CAF software
 * closed        filed / archived
 */
export const CaseStatus = z.enum([
  "intake",
  "submitted",
  "in_review",
  "needs_citizen",
  "ready",
  "closed",
]);
export type CaseStatus = z.infer<typeof CaseStatus>;

export const CitizenStep = z.enum(["need", "interview", "documents", "review", "submitted"]);
export type CitizenStep = z.infer<typeof CitizenStep>;

export const ChatRole = z.enum(["citizen", "assistant", "operator", "system"]);
export const ChatMessage = z.object({
  id: Id,
  role: ChatRole,
  text: z.string(),
  createdAt: IsoDateTime,
  /** Original text before translation, for operator messages shown in another language. */
  originalText: z.string().nullable(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const Office = z.object({
  id: Id,
  slug: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string().nullable(),
  openingHours: z.string().nullable(),
});
export type Office = z.infer<typeof Office>;

export const OrganizationKind = z.enum(["caf", "patronato", "studio"]);
export const OrganizationPublic = z.object({
  id: Id,
  name: z.string(),
  kind: OrganizationKind,
});
export type OrganizationPublic = z.infer<typeof OrganizationPublic>;

export const Progress = z.object({
  questionsAnswered: z.number().int().nonnegative(),
  questionsTotal: z.number().int().nonnegative(),
  documentsDone: z.number().int().nonnegative(),
  documentsRequired: z.number().int().nonnegative(),
  /** 0–100, weighted interview 30% / documents 70%. */
  percent: z.number().min(0).max(100),
});
export type Progress = z.infer<typeof Progress>;

export const CitizenContact = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(200).optional(),
});
export type CitizenContact = z.infer<typeof CitizenContact>;

/** A previous answer rendered for humans, in the case language. */
export const AnsweredQuestion = z.object({
  questionId: z.string(),
  question: z.string(),
  answer: z.string(),
  section: z.string(),
  /** False when the answer was inferred from free text and never confirmed. */
  editable: z.boolean(),
});
export type AnsweredQuestion = z.infer<typeof AnsweredQuestion>;

/** Everything the citizen sees. Never contains operator-only notes or other cases. */
export const CitizenCase = z.object({
  id: Id,
  reference: z.string(),
  status: CaseStatus,
  step: CitizenStep,
  language: Language,
  practice: PracticeSummary.nullable(),
  organization: OrganizationPublic,
  office: Office.nullable(),
  progress: Progress,
  nextQuestion: Question.nullable(),
  answers: z.record(z.string(), AnswerValue),
  /** Same answers, readable and localized, in interview order. */
  answered: z.array(AnsweredQuestion).default([]),
  household: z.array(Member),
  checklist: z.array(ChecklistItem),
  documents: z.array(DocumentSummary),
  messages: z.array(ChatMessage),
  /** Contact details the citizen already gave, to prefill a resubmission. */
  contact: CitizenContact.nullable().default(null),
  /** Blockers/warnings the citizen can act on. */
  findings: z.array(Finding),
  submittedAt: IsoDateTime.nullable(),
  /** Link stops working after this instant (retention policy). */
  expiresAt: IsoDateTime,
});
export type CitizenCase = z.infer<typeof CitizenCase>;

/* Citizen requests ------------------------------------------------- */

export const StartIntakeRequest = z.object({
  /** Office public slug (from the CAF's link / QR code). */
  officeSlug: z.string().min(1).max(80),
  language: Language.default("it"),
  practiceId: PracticeId.optional(),
  /** Explicit consent to the privacy notice, required. */
  privacyAccepted: z.literal(true),
});
export type StartIntakeRequest = z.infer<typeof StartIntakeRequest>;

export const StartIntakeResponse = z.object({
  /** Secret capability token for /pratica/[token]. Treat like a password. */
  token: z.string(),
  case: CitizenCase,
});
export type StartIntakeResponse = z.infer<typeof StartIntakeResponse>;

export const IntakeTurn = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal("answer"), questionId: z.string(), value: AnswerValue }),
  z.object({ type: z.literal("skip"), questionId: z.string() }),
  z.object({ type: z.literal("choose_practice"), practiceId: PracticeId }),
  /** Go back and change a previous answer. */
  z.object({ type: z.literal("edit"), questionId: z.string() }),
]);
export type IntakeTurn = z.infer<typeof IntakeTurn>;

export const UpdateLanguageRequest = z.object({ language: Language });

export const CitizenContactRequest = CitizenContact;
export type CitizenContactRequest = z.infer<typeof CitizenContactRequest>;

export const SubmitCaseRequest = z.object({
  contact: CitizenContactRequest,
  /** Citizen confirms the info is truthful and accepts sending it to the CAF. */
  confirmed: z.literal(true),
  /** Free note to the operator. */
  note: z.string().trim().max(1000).optional(),
});
export type SubmitCaseRequest = z.infer<typeof SubmitCaseRequest>;

/** Multipart fields alongside `file` for POST /api/c/:token/documents. */
export const UploadDocumentFields = z.object({
  checklistItemId: Id.optional(),
});

/* ------------------------------------------------------------------ */
/* Operator console                                                    */
/* ------------------------------------------------------------------ */

export const OperatorRole = z.enum(["admin", "operator"]);
export const Operator = z.object({
  id: Id,
  name: z.string(),
  email: z.string().email(),
  role: OperatorRole,
  organization: OrganizationPublic,
  offices: z.array(Office),
});
export type Operator = z.infer<typeof Operator>;

export const LoginRequest = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const CaseListItem = z.object({
  id: Id,
  reference: z.string(),
  citizenName: z.string().nullable(),
  practice: PracticeSummary.nullable(),
  status: CaseStatus,
  language: Language,
  office: Office.nullable(),
  assignee: z.object({ id: Id, name: z.string() }).nullable(),
  progress: Progress,
  blockers: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  submittedAt: IsoDateTime.nullable(),
});
export type CaseListItem = z.infer<typeof CaseListItem>;

export const CaseListQuery = z.object({
  status: CaseStatus.optional(),
  practiceId: PracticeId.optional(),
  officeId: Id.optional(),
  assignee: z.union([Id, z.literal("me"), z.literal("none")]).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CaseListQuery = z.infer<typeof CaseListQuery>;

export const CaseListResponse = z.object({
  items: z.array(CaseListItem),
  nextCursor: z.string().nullable(),
  counts: z.record(CaseStatus, z.number().int().nonnegative()),
});
export type CaseListResponse = z.infer<typeof CaseListResponse>;

export const TimelineEvent = z.object({
  id: Id,
  at: IsoDateTime,
  actor: z.enum(["citizen", "operator", "system", "ai"]),
  actorName: z.string().nullable(),
  type: z.string(),
  /** Localized (Italian) description for the operator. */
  label: z.string(),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

/** One structured line of the dossier summary ("Nucleo: 3 persone"). */
export const DossierFact = z.object({
  label: z.string(),
  value: z.string(),
  source: z.enum(["citizen", "document", "operator"]),
});
export type DossierFact = z.infer<typeof DossierFact>;

/** Full dossier for operators. Everything is in Italian regardless of the citizen language. */
export const CaseDossier = CaseListItem.extend({
  citizen: z.object({
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  /** E.g. "ISEE ordinario 2027". */
  headline: z.string(),
  facts: z.array(DossierFact),
  household: z.array(Member),
  answers: z.array(
    z.object({
      questionId: z.string(),
      question: z.string(),
      answer: z.string(),
      section: z.string(),
    }),
  ),
  checklist: z.array(ChecklistItem),
  documents: z.array(DocumentSummary),
  findings: z.array(Finding),
  messages: z.array(ChatMessage),
  timeline: z.array(TimelineEvent),
  citizenNote: z.string().nullable(),
  internalNotes: z.string().nullable(),
  /** Minutes spent by the citizen in intake and by operators in review, measured. */
  timing: z.object({
    citizenMinutes: z.number().nullable(),
    reviewMinutes: z.number().nullable(),
  }),
  citizenLink: z.string().nullable(),
});
export type CaseDossier = z.infer<typeof CaseDossier>;

export const CreateCaseRequest = z.object({
  officeId: Id,
  practiceId: PracticeId.optional(),
  language: Language.default("it"),
  citizen: CitizenContactRequest.partial().optional(),
});
export type CreateCaseRequest = z.infer<typeof CreateCaseRequest>;

export const CreateCaseResponse = z.object({
  case: CaseDossier,
  /** Absolute citizen link to share (SMS, WhatsApp, QR). Shown once. */
  citizenLink: z.string(),
});
export type CreateCaseResponse = z.infer<typeof CreateCaseResponse>;

export const UpdateCaseRequest = z.object({
  status: CaseStatus.optional(),
  assigneeId: Id.nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
});
export type UpdateCaseRequest = z.infer<typeof UpdateCaseRequest>;

export const ReviewChecklistItemRequest = z.object({
  decision: z.enum(["verified", "rejected", "waived", "reset"]),
  note: z.string().trim().max(500).optional(),
});
export type ReviewChecklistItemRequest = z.infer<typeof ReviewChecklistItemRequest>;

export const RequestFromCitizenRequest = z.object({
  checklistItemIds: z.array(Id).max(50),
  /** Italian text; translated to the citizen language by the server. */
  message: z.string().trim().min(1).max(1000),
});
export type RequestFromCitizenRequest = z.infer<typeof RequestFromCitizenRequest>;

export const ExportFormat = z.enum(["json", "pdf"]);

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export const MetricsQuery = z.object({
  from: IsoDate,
  to: IsoDate,
  officeId: Id.optional(),
});
export type MetricsQuery = z.infer<typeof MetricsQuery>;

export const Metrics = z.object({
  from: IsoDate,
  to: IsoDate,
  casesStarted: z.number().int(),
  casesSubmitted: z.number().int(),
  casesReady: z.number().int(),
  /** % of submitted dossiers with zero blockers at first submission. Null when no data. */
  completeAtFirstSubmission: z.number().nullable(),
  avgCitizenMinutes: z.number().nullable(),
  avgReviewMinutes: z.number().nullable(),
  /** Baseline declared by the CAF in settings (manual prep minutes per case before Avanti). */
  baselineMinutesPerCase: z.number().nullable(),
  needsCitizenRate: z.number().nullable(),
  byPractice: z.array(z.object({ practiceId: PracticeId, count: z.number().int() })),
  byLanguage: z.array(z.object({ language: Language, count: z.number().int() })),
  daily: z.array(
    z.object({ date: IsoDate, started: z.number().int(), submitted: z.number().int() }),
  ),
});
export type Metrics = z.infer<typeof Metrics>;

/* ------------------------------------------------------------------ */
/* Public site                                                         */
/* ------------------------------------------------------------------ */

export const PilotLeadRequest = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(160),
  role: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional(),
  offices: z.coerce.number().int().min(1).max(5000).optional(),
  message: z.string().trim().max(2000).optional(),
  privacyAccepted: z.literal(true),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional(),
});
export type PilotLeadRequest = z.infer<typeof PilotLeadRequest>;

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const ErrorCode = z.enum([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "link_expired",
  "conflict",
  "file_too_large",
  "unsupported_file",
  "rate_limited",
  "ai_unavailable",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    /** Italian, safe to show to the end user. Never contains internals. */
    message: z.string(),
    /** Field-level validation issues, keyed by dotted path. */
    fields: z.record(z.string(), z.string()).optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
