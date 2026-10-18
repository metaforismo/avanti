import { CommercialUsage } from "./platform";
/**
 * Shared API contracts between @avanti/api (backend) and @avanti/web (frontend).
 * Every request body is validated with these schemas on the server; the frontend
 * imports the inferred types. Changing a schema is a breaking API change.
 */
import { z } from "zod";
import { NearReady } from "./near-ready";
export * from "./near-ready";
import { ASSIGN_CASES_MAX, LANGUAGES, PASSWORD_MIN_LENGTH, PRACTICE_IDS } from "./constants";

export {
  ASSIGN_CASES_MAX,
  IDEMPOTENCY_HEADER,
  LANGUAGES,
  PASSWORD_MIN_LENGTH,
  PRACTICE_IDS,
  RTL_LANGUAGES,
  UPLOAD_LIMITS,
} from "./constants";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

// Preserve Indic joiners and Unicode names; reject storage-invalid controls and bidi overrides.
export const SafeText = z
  .string()
  .regex(
    /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\p{Surrogate}]*$/u,
  );
const SafeName = SafeText.regex(/^[^\r\n\t]*$/u);

export const Language = z.enum(LANGUAGES);
export type Language = z.infer<typeof Language>;

export const Id = SafeName.min(1).max(64);
export const IsoDateTime = z.string().datetime({ offset: true });
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ------------------------------------------------------------------ */
/* Practice catalog                                                    */
/* ------------------------------------------------------------------ */

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
  id: Id.optional(),
  role: MemberRole,
  firstName: SafeName.trim().min(1).max(80),
  lastName: SafeName.trim().max(80).optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(),
  birthDate: z.iso.date().optional(),
  taxCode: SafeName.trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{16}$/)
    .optional(),
});
export type MemberInput = z.infer<typeof MemberInput>;

/** Retention allowlist: no fiscal code, full birth date or document identity. */
export const RenewalReminderMember = MemberInput.pick({
  role: true,
  firstName: true,
  lastName: true,
  birthYear: true,
}).strict();
export type RenewalReminderMember = z.infer<typeof RenewalReminderMember>;

export const Member = MemberInput.extend({ id: Id });
export type Member = z.infer<typeof Member>;

export const AnswerValue = z.union([
  SafeText.max(2000),
  z.number(),
  z.boolean(),
  z.array(SafeText.max(200)).max(50),
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
  message: SafeText,
  /** Italian review instructions; optional for findings persisted before this field existed. */
  operatorMessage: SafeText.min(1).optional(),
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
  detectedLabel: SafeText.nullable(),
  confidence: z.number().min(0).max(1),
  ownerName: SafeName.nullable(),
  referenceYear: z.number().int().nullable(),
  expiresOn: IsoDate.nullable(),
  legible: z.boolean(),
  pagesComplete: z.boolean().nullable(),
  findings: z.array(Finding),
});
export type DocumentAnalysis = z.infer<typeof DocumentAnalysis>;

export const DocumentStatus = z.enum(["processing", "analyzed", "failed"]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const DocumentReuseAssessment = z.object({
  status: z.enum(["valido", "da_aggiornare", "da_verificare"]),
  reason: SafeText,
  code: z.enum(["expired", "wrong_year", "annual", "uncertain", "member_changed", "valid"]),
  checkedAt: IsoDateTime,
});
export type DocumentReuseAssessment = z.infer<typeof DocumentReuseAssessment>;
export const CitizenCheck = z.object({
  status: z.enum(["ok", "warning", "problem", "pending"]),
  messages: z.array(SafeText),
});
export type CitizenCheck = z.infer<typeof CitizenCheck>;

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
  reuse: DocumentReuseAssessment.nullable().optional(),
  citizenCheck: CitizenCheck.default({ status: "pending", messages: [] }),
  citizenKeptAt: IsoDateTime.nullable().default(null),
});
export type DocumentSummary = z.infer<typeof DocumentSummary>;

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
  text: SafeText,
  createdAt: IsoDateTime,
  /** Original text before translation, for operator messages shown in another language. */
  originalText: SafeText.nullable(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const AssistantIntent = z.enum([
  "answer",
  "needs_operator",
  "off_topic",
  "manipulation",
  "emergency",
]);
export type AssistantIntent = z.infer<typeof AssistantIntent>;
export const AssistantAction = z.enum(["none", "explain_question", "open_documents", "ask_desk"]);
export const AssistantSource = z.object({ id: z.string(), title: z.string() });
export const AssistantAsk = z.object({
  message: SafeText.trim().min(1).max(600),
  focus: z
    .object({
      questionId: z.string().max(160).optional(),
      checklistItemId: z.string().max(160).optional(),
    })
    .optional(),
});
export type AssistantAsk = z.infer<typeof AssistantAsk>;
export const AssistantReply = z.object({
  id: Id,
  reply: SafeText.min(1),
  intent: AssistantIntent,
  action: AssistantAction,
  sources: z.array(AssistantSource),
  engine: z.enum(["ai", "heuristic"]),
  createdAt: IsoDateTime,
});
export type AssistantReply = z.infer<typeof AssistantReply>;
export const AssistantTurn = z.object({
  id: Id,
  role: z.enum(["citizen", "assistant"]),
  text: SafeText,
  intent: AssistantIntent.optional(),
  action: AssistantAction.optional(),
  sources: z.array(AssistantSource).optional(),
  createdAt: IsoDateTime,
});
export type AssistantTurn = z.infer<typeof AssistantTurn>;
export const AssistantHistory = z.object({
  messages: z.array(AssistantTurn),
  remainingToday: z.number().int().min(0).max(80),
});
export const AskDesk = z.object({ message: SafeText.trim().min(1).max(600) });
export const TranscribeFields = z.object({ language: Language });
export const Transcription = z.object({
  text: SafeText.min(1).max(6000),
  language: Language,
  engine: z.enum(["ai", "heuristic"]),
});
export type Transcription = z.infer<typeof Transcription>;

/** External destination, never fetched by Avanti or included in notification emails. */
export const BookingUrl = SafeName.trim()
  .max(2048)
  .url()
  .refine((value) => {
    if (!/^https:\/\//i.test(value) || /[\s\\]/u.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Inserisci un link HTTPS valido, senza credenziali.");

export const Office = z.object({
  id: Id,
  slug: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string().nullable(),
  openingHours: z.string().nullable(),
  bookingUrl: BookingUrl.nullable().optional(),
  citizenNote: SafeText.trim().max(300).nullable().optional(),
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
  /** Exact total; 0 while conditional branches still make a single count misleading. */
  questionsTotal: z.number().int().nonnegative(),
  /** Planning range: declared counts prevail; unknown branch sizes use moderate assumptions. */
  questionsRemaining: z
    .object({
      min: z.number().int().nonnegative(),
      max: z.number().int().nonnegative(),
    })
    .optional(),
  documentsDone: z.number().int().nonnegative(),
  documentsRequired: z.number().int().nonnegative(),
  /** 0–100, weighted interview 30% / documents 70%. */
  percent: z.number().min(0).max(100),
});
export type Progress = z.infer<typeof Progress>;

export const CitizenContact = z.object({
  firstName: SafeName.trim().min(1).max(80),
  lastName: SafeName.trim().min(1).max(80),
  phone: SafeName.trim().max(30).optional(),
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

export const ConversationTurn = z.object({
  id: Id,
  role: z.enum(["citizen", "assistant"]),
  text: SafeText,
  kind: z.enum(["message", "question", "confirmation", "summary"]),
  questionId: z.string().nullable(),
  createdAt: IsoDateTime,
});
export type ConversationTurn = z.infer<typeof ConversationTurn>;
export const Proposal = z.object({
  id: Id,
  questionId: z.string(),
  questionText: SafeText,
  value: AnswerValue,
  display: SafeText,
  evidence: SafeText.max(1000),
  confidence: z.number().min(0).max(1),
});
export type Proposal = z.infer<typeof Proposal>;
export const ConversationState = z.object({
  turns: z.array(ConversationTurn),
  proposals: z.array(Proposal),
  ask: z.array(Question).max(2),
  progress: Progress,
  complete: z.boolean(),
  engine: z.enum(["ai", "heuristic"]),
});
export type ConversationState = z.infer<typeof ConversationState>;
export const ConversationRequest = z.object({ text: SafeText.trim().min(1).max(1000) });
export const ConversationConfirmRequest = z
  .object({
    accept: z.array(z.object({ proposalId: Id, value: AnswerValue.optional() })).max(100),
    reject: z.array(Id).max(100),
  })
  .superRefine((input, ctx) => {
    const ids = [...input.accept.map((p) => p.proposalId), ...input.reject];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Proposte duplicate." });
  });

/** Everything the citizen sees. Never contains operator-only notes or other cases. */
export const CitizenCase = z.object({
  aiCitizenAssistant: z.boolean().optional(),
  id: Id,
  reference: z.string(),
  /** Engine used for the most recent intake turn, when present. */
  engine: z.enum(["ai", "heuristic"]).optional(),
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
  practiceYear: z.number().int().optional(),
  reuseNotice: z.string().nullable().optional(),
  renewal: z
    .object({
      year: z.number().int(),
      previousYear: z.number().int(),
      householdConfirmationRequired: z.boolean(),
      householdConfirmedAt: IsoDateTime.nullable(),
      notice: z.string(),
    })
    .nullable()
    .optional(),
  renewalContactConsent: z.boolean().optional(),
  renewalContactConsentAt: IsoDateTime.nullable().optional(),
  renewalContactConsentVersion: z.string().nullable().optional(),
  renewalConsentVersion: z.string().optional(),
  messages: z.array(ChatMessage),
  conversation: ConversationState.optional(),
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
  officeSlug: SafeName.min(1).max(80),
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
  z.object({ type: z.literal("text"), text: SafeText.trim().min(1).max(2000) }),
  z.object({ type: z.literal("answer"), questionId: z.string(), value: AnswerValue }),
  z.object({ type: z.literal("skip"), questionId: z.string() }),
  z.object({ type: z.literal("choose_practice"), practiceId: PracticeId }),
  /** Go back and change a previous answer. */
  z.object({ type: z.literal("edit"), questionId: z.string() }),
]);
export type IntakeTurn = z.infer<typeof IntakeTurn>;

export const IntakeTurnResponse = CitizenCase.extend({
  /** Unavailable classification for this turn only; no practice was started for it. */
  unavailablePractice: PracticeId.nullable(),
});
export type IntakeTurnResponse = z.infer<typeof IntakeTurnResponse>;

export const UpdateLanguageRequest = z.object({ language: Language });

export const CitizenContactRequest = CitizenContact;
export type CitizenContactRequest = z.infer<typeof CitizenContactRequest>;

export const SubmitCaseRequest = z.object({
  contact: CitizenContactRequest,
  /** Citizen confirms the info is truthful and accepts sending it to the CAF. */
  confirmed: z.literal(true),
  /** Free note to the operator. */
  note: SafeText.trim().max(1000).optional(),
  /** Explicit permission for annual ISEE renewal email. Omission preserves the preference. */
  renewalContactConsent: z.boolean().optional(),
});
export type SubmitCaseRequest = z.infer<typeof SubmitCaseRequest>;

/** Multipart fields alongside `file` for POST /api/c/:token/documents. */
export const UploadDocumentFields = z.object({
  checklistItemId: Id.optional(),
});

export const ReassignDocumentRequest = z.object({
  checklistItemId: Id.nullable(),
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
  /** True after an admin set a temporary password: the console asks for a new one first. */
  mustChangePassword: z.boolean().default(false),
  mfaEnabled: z.boolean().default(false),
  mustSetupMfa: z.boolean().default(false),
});
export type Operator = z.infer<typeof Operator>;

export const LoginRequest = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** Password accepted; only MFA verification, me and logout are available. */
export const MfaChallenge = z.object({
  mfaRequired: z.literal(true),
  expiresAt: IsoDateTime,
});
export type MfaChallenge = z.infer<typeof MfaChallenge>;
export const LoginResponse = z.union([Operator, MfaChallenge]);
export type LoginResponse = z.infer<typeof LoginResponse>;
export const MfaCode = z
  .string()
  .trim()
  .regex(/^(?:[0-9]{6}|[a-fA-F0-9]{8}-[a-fA-F0-9]{8}-[a-fA-F0-9]{8}-[a-fA-F0-9]{8})$/);
export const MfaVerifyRequest = z.object({ code: MfaCode }).strict();
export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequest>;
export const MfaSetupStartRequest = z
  .object({ currentPassword: z.string().min(1).max(200) })
  .strict();
export const MfaSetupConfirmRequest = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/),
  })
  .strict();
export const MfaSensitiveRequest = MfaVerifyRequest.extend({
  currentPassword: z.string().min(1).max(200),
}).strict();
export const MfaResetRequest = z.object({}).strict();
export type MfaCode = z.infer<typeof MfaCode>;
export type MfaSetupStartRequest = z.infer<typeof MfaSetupStartRequest>;
export type MfaSetupConfirmRequest = z.infer<typeof MfaSetupConfirmRequest>;
export type MfaSensitiveRequest = z.infer<typeof MfaSensitiveRequest>;
export type MfaResetRequest = z.infer<typeof MfaResetRequest>;

export const MfaSetupResponse = z.object({
  secret: z.string().regex(/^[A-Z2-7]{32}$/),
  otpauthUri: z.string().startsWith("otpauth://totp/"),
  expiresAt: IsoDateTime,
});
export type MfaSetupResponse = z.infer<typeof MfaSetupResponse>;
export const MfaRecoveryCodesResponse = z.object({ recoveryCodes: z.array(MfaCode).length(10) });
export type MfaRecoveryCodesResponse = z.infer<typeof MfaRecoveryCodesResponse>;
export const MfaStatus = z.object({
  enabled: z.boolean(),
  required: z.boolean(),
  recoveryCodesRemaining: z.number().int().min(0).max(10),
  setupPending: z.boolean(),
});
export type MfaStatus = z.infer<typeof MfaStatus>;

export const CaseListItem = z.object({
  nearReadyBadge: z.boolean().default(false),
  hasCitizenQuestion: z.boolean().default(false),
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
  aiAttention: z.number().int().nonnegative().nullable().default(null),
  aiPriority: z
    .enum(["quick_review", "attention", "citizen_question", "near_ready"])
    .nullable()
    .default(null),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  submittedAt: IsoDateTime.nullable(),
  /**
   * Queue only: set while the case is submitted and nobody has taken it. `since` is the first
   * submission, `days` Italian calendar days since then, `overdue` past the working-day threshold.
   */
  waiting: z
    .object({
      since: IsoDateTime,
      days: z.number().int().nonnegative(),
      overdue: z.boolean(),
    })
    .nullable()
    .optional(),
});
export type CaseListItem = z.infer<typeof CaseListItem>;

export const CaseListQuery = z.object({
  ai: z.enum(["quick_review", "attention", "citizen_question", "near_ready"]).optional(),
  status: CaseStatus.optional(),
  practiceId: PracticeId.optional(),
  officeId: Id.optional(),
  assignee: z.union([Id, z.literal("me"), z.literal("none")]).optional(),
  q: SafeText.trim().max(100).optional(),
  /** `waiting`: first submission oldest first, the cases that have waited longest on top. */
  sort: z.enum(["updated", "waiting"]).default("updated"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CaseListQuery = z.infer<typeof CaseListQuery>;

export const CaseListResponse = z.object({
  items: z.array(CaseListItem),
  nextCursor: z.string().nullable(),
  counts: z.record(CaseStatus, z.number().int().nonnegative()),
  priorityCounts: z
    .object({ near_ready: z.number().int().nonnegative() })
    .default({ near_ready: 0 }),
  /** Submitted, unassigned and past the waiting threshold, with the list filters except status. */
  waitingOverdue: z.number().int().nonnegative().default(0),
});
export type CaseListResponse = z.infer<typeof CaseListResponse>;

/**
 * Admin only. Each case carries the `updatedAt` read in the queue: a case changed since then is
 * reported as `conflict` and left untouched, while the others are assigned in the same
 * transaction. `assigneeId: null` removes the assignment.
 */
export const AssignCasesRequest = z
  .object({
    assigneeId: Id.nullable(),
    cases: z
      .array(z.object({ id: Id, expectedUpdatedAt: IsoDateTime }).strict())
      .min(1)
      .max(ASSIGN_CASES_MAX)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: "Ogni pratica può comparire una sola volta.",
      }),
  })
  .strict();
export type AssignCasesRequest = z.infer<typeof AssignCasesRequest>;

export const AssignCaseOutcome = z.enum(["assigned", "unchanged", "conflict", "not_found"]);
export type AssignCaseOutcome = z.infer<typeof AssignCaseOutcome>;
/** Results in request order; `updatedAt` is the current version, null when not found. */
export const AssignCasesResponse = z.object({
  assignee: z.object({ id: Id, name: z.string() }).nullable(),
  results: z.array(
    z.object({ id: Id, outcome: AssignCaseOutcome, updatedAt: IsoDateTime.nullable() }),
  ),
});
export type AssignCasesResponse = z.infer<typeof AssignCasesResponse>;

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

/** Preparatory DSU values: document amounts require explicit operator confirmation. */
export const DsuSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), questionId: z.string().min(1).max(200) }),
  z.object({
    kind: z.literal("document"),
    documentId: Id,
    checklistItemId: Id,
    operatorConfirmed: z.boolean().optional(),
    page: z.number().int().positive().nullable().optional(),
  }),
  z.object({
    kind: z.literal("missing"),
    questionId: z.string().min(1).max(200).optional(),
    checklistItemId: Id.optional(),
  }),
  z.object({ kind: z.literal("caf") }),
]);
export type DsuSource = z.infer<typeof DsuSource>;

export const DsuRow = z
  .object({
    label: z.string().min(1),
    value: z.string().nullable(),
    source: DsuSource,
    note: z.string().optional(),
  })
  .refine(
    (row) =>
      row.source.kind === "answer" ||
      (row.source.kind === "document" && row.source.operatorConfirmed)
        ? row.value !== null
        : row.value === null,
    {
      message: "Un valore richiede una risposta o un documento confermato dall’operatore.",
    },
  );
export type DsuRow = z.infer<typeof DsuRow>;

export const DsuSection = z.object({
  module: z.enum(["MB.1", "FC.1", "FC.2", "FC.3"]),
  quadro: z.enum(["A", "B", "FC1", "FC2", "FC3", "FC4", "FC5", "FC6", "FC7", "FC8"]),
  title: z.string(),
  memberId: Id.nullable(),
  memberName: z.string().nullable(),
  /** Numbered intake instance, never an official financial/property identifier. */
  instanceId: Id.nullable(),
  note: z.string().optional(),
  rows: z.array(DsuRow),
});
export type DsuSection = z.infer<typeof DsuSection>;

export const DsuSheet = z.object({
  version: z.literal(1),
  practiceId: z.literal("isee_ordinario"),
  modelYear: z.literal(2026),
  modelUrl: z.string().url(),
  declarationYear: z.number().int(),
  referenceYear: z.number().int(),
  notes: z.array(z.string()),
  sections: z.array(DsuSection),
});
export type DsuSheet = z.infer<typeof DsuSheet>;
export const DsuSheetResponse = DsuSheet.nullable();

/** Full dossier for operators. Everything is in Italian regardless of the citizen language. */
export const CaseDossier = CaseListItem.extend({
  nearReady: NearReady.nullable().default(null),
  assistantTurns: z.array(AssistantTurn).default([]),
  citizen: z.object({
    firstName: SafeName.nullable(),
    lastName: SafeName.nullable(),
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
  practiceYear: z.number().int().optional(),
  /** Preparatory DSU sheet; null for an unclassified or non-ordinary-ISEE case. */
  dsuSheet: DsuSheetResponse.default(null),
  findings: z.array(Finding),
  messages: z.array(ChatMessage),
  conversation: ConversationState.optional(),
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

export const PracticeYear = z.number().int().min(2020).max(2100);

export const CreateCaseRequest = z.object({
  officeId: Id,
  practiceId: PracticeId.optional(),
  language: Language.default("it"),
  citizen: CitizenContactRequest.partial().optional(),
  practiceYear: PracticeYear.optional(),
});
export type CreateCaseRequest = z.infer<typeof CreateCaseRequest>;

export const CreateCaseResponse = z.object({
  case: CaseDossier,
  /** Absolute citizen link to share (SMS, WhatsApp, QR). Shown once. */
  citizenLink: z.string(),
});
export type CreateCaseResponse = z.infer<typeof CreateCaseResponse>;

/** POST /cases/:id/reuse. Only the operator links dossiers; no identity auto-matching. */
export const ReuseCaseRequest = z.object({
  officeId: Id,
  practiceId: PracticeId,
  practiceYear: PracticeYear,
  language: Language.default("it"),
  confirmed: z.literal(true),
  members: z
    .array(MemberInput)
    .min(1)
    .max(20)
    .refine((members) => members.filter((m) => m.role === "richiedente").length === 1),
  /** Omitted: all eligible source documents. Empty: household only. */
  documentIds: z.array(Id).max(60).optional(),
  /** Other members' documents remain operator-only unless explicitly granted here. */
  citizenVisibleDocumentIds: z.array(Id).max(60).default([]),
});
export type ReuseCaseRequest = z.infer<typeof ReuseCaseRequest>;
export const ReuseCaseResponse = CreateCaseResponse;
export type ReuseCaseResponse = z.infer<typeof ReuseCaseResponse>;

export const RenewalStatus = z.enum(["not_invited", "invited", "started", "submitted"]);
export type RenewalStatus = z.infer<typeof RenewalStatus>;
export const RenewalsQuery = z
  .object({
    year: z.coerce.number().int().min(2021).max(2100),
    status: z
      .enum(["not_invited", "invited", "started", "submitted", "all"])
      .default("not_invited"),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    after: Id.optional(),
  })
  .strict();
export type RenewalsQuery = z.infer<typeof RenewalsQuery>;
export const CreateRenewalsRequest = z
  .object({
    sourceCaseIds: z
      .array(Id)
      .min(1)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
    year: PracticeYear.min(2021),
    regenerateLinks: z.boolean().default(false),
  })
  .strict();
export type CreateRenewalsRequest = z.infer<typeof CreateRenewalsRequest>;
export const RenewalItem = z.object({
  sourceCaseId: Id,
  sourceKind: z.enum(["case", "reminder"]),
  reminderExpiresAt: IsoDateTime.nullable(),
  renewalContactConsent: z.boolean(),
  householdConfirmationRequired: z.boolean(),
  reference: z.string(),
  citizenName: z.string().nullable(),
  householdCount: z.number().int().nonnegative(),
  documents: z.object({
    valid: z.number().int().nonnegative(),
    toUpdate: z.number().int().nonnegative(),
    toVerify: z.number().int().nonnegative(),
  }),
  status: RenewalStatus,
  renewalCaseId: Id.nullable(),
  lastInvitedAt: IsoDateTime.nullable(),
});
export type RenewalItem = z.infer<typeof RenewalItem>;
export const RenewalsResponse = z.object({
  year: PracticeYear,
  items: z.array(RenewalItem),
  counts: z.object({
    not_invited: z.number().int().nonnegative(),
    invited: z.number().int().nonnegative(),
    started: z.number().int().nonnegative(),
    submitted: z.number().int().nonnegative(),
  }),
  nextAfter: Id.nullable(),
});
export type RenewalsResponse = z.infer<typeof RenewalsResponse>;
export const CreateRenewalsResponse = z.object({
  year: PracticeYear,
  items: z.array(
    z.object({
      sourceCaseId: Id,
      caseId: Id,
      reference: z.string(),
      status: RenewalStatus,
      created: z.boolean(),
      citizenLink: z.string().nullable(),
      invitation: z.enum([
        "queued",
        "disabled",
        "no_email",
        "no_consent",
        "rate_limited",
        "existing",
      ]),
    }),
  ),
});
export type CreateRenewalsResponse = z.infer<typeof CreateRenewalsResponse>;
export const RenewalConsentRequest = z.object({ consented: z.boolean() }).strict();
export type RenewalConsentRequest = z.infer<typeof RenewalConsentRequest>;
/** CAF acts only on withdrawal requested by the citizen, never on a consent grant. */
export const RevokeRenewalConsentRequest = z.object({ consented: z.literal(false) }).strict();
export type RevokeRenewalConsentRequest = z.infer<typeof RevokeRenewalConsentRequest>;

/** POST, so personal search terms never appear in request URLs or access logs. */
export const FamilySearchRequest = z.union([
  z.object({ taxCode: MemberInput.shape.taxCode.unwrap() }).strict(),
  z
    .object({
      firstName: SafeName.trim().min(1).max(80),
      lastName: SafeName.trim().min(1).max(80),
      birthDate: z.iso.date(),
    })
    .strict(),
]);
export type FamilySearchRequest = z.infer<typeof FamilySearchRequest>;
export const FamilySearchResponse = z.object({
  items: z.array(
    z.object({
      caseId: Id,
      reference: z.string(),
      practiceId: PracticeId.nullable(),
      practiceYear: PracticeYear,
      applicant: Member,
    }),
  ),
  truncated: z.boolean(),
});
export type FamilySearchResponse = z.infer<typeof FamilySearchResponse>;

export const CheckDocumentReuseRequest = z.object({ useAi: z.boolean().default(false) });
export const EraseFamilyRequest = z.object({
  confirmReference: SafeName.trim().min(1),
  confirmed: z.literal(true),
});
export const EraseFamilyResponse = z.object({
  deletedCases: z.number().int().nonnegative(),
  deletedReminders: z.number().int().nonnegative().optional(),
});

export const RegenerateLinkResponse = z.object({
  /** Secret capability URL, returned only by the regeneration request. */
  url: z.string().url(),
  expiresAt: IsoDateTime,
});
export type RegenerateLinkResponse = z.infer<typeof RegenerateLinkResponse>;

/**
 * GET /cases/:id/citizen-handoff: what the operator hands to a citizen without email (a
 * WhatsApp/SMS notice) or without a smartphone (a printed list), in the citizen's language
 * with the Italian beside it. Only documents still to bring or redo.
 */
export const CitizenHandoffItem = z.object({
  id: Id,
  /** As the citizen sees it in the link: may contain names or banks from their answers. */
  title: z.string(),
  titleIt: z.string(),
  /** Catalog title without personal details, for messages sent through third-party apps. */
  genericTitle: z.string(),
  genericTitleIt: z.string(),
  howToGet: z.string().nullable(),
  memberName: z.string().nullable(),
  required: z.boolean(),
  status: z.enum(["missing", "rejected", "issue"]),
  /** The desk's note on a rejected item, as written by the operator. */
  note: z.string().nullable(),
});
export type CitizenHandoffItem = z.infer<typeof CitizenHandoffItem>;

export const CitizenHandoff = z.object({
  reference: z.string(),
  language: Language,
  status: CaseStatus,
  organization: OrganizationPublic,
  office: Office.nullable(),
  practice: z.object({ name: z.string(), nameIt: z.string() }).nullable(),
  /** False while the interview is still open: the list can still grow. */
  interviewComplete: z.boolean(),
  items: z.array(CitizenHandoffItem),
  /**
   * While the case waits for the citizen: the desk's latest request without the item list.
   * `text` is what the citizen read: the translation, or without AI a localized notice that
   * points to the Italian original in `textIt`.
   */
  request: z.object({ text: z.string(), textIt: z.string() }).nullable(),
});
export type CitizenHandoff = z.infer<typeof CitizenHandoff>;

/** POST /cases/:id/citizen-handoff/events: recorded in the timeline, never the message text. */
export const CitizenHandoffChannel = z.enum(["whatsapp", "sms", "copy", "print"]);
export type CitizenHandoffChannel = z.infer<typeof CitizenHandoffChannel>;
export const RecordCitizenHandoffRequest = z.object({ channel: CitizenHandoffChannel }).strict();
export type RecordCitizenHandoffRequest = z.infer<typeof RecordCitizenHandoffRequest>;

export const UpdateCaseRequest = z.object({
  /** Required by the API for writes; use updatedAt from the dossier and reload on 409. */
  expectedUpdatedAt: IsoDateTime.optional(),
  status: CaseStatus.optional(),
  assigneeId: Id.nullable().optional(),
  internalNotes: SafeText.max(5000).nullable().optional(),
});
export type UpdateCaseRequest = z.infer<typeof UpdateCaseRequest>;

export const ReviewChecklistItemRequest = z.object({
  /** Required by the API for writes; use updatedAt from the dossier and reload on 409. */
  expectedUpdatedAt: IsoDateTime.optional(),
  decision: z.enum(["verified", "rejected", "waived", "reset"]),
  note: SafeText.trim().max(500).optional(),
});
export type ReviewChecklistItemRequest = z.infer<typeof ReviewChecklistItemRequest>;

/** Italian templates copied into the existing integration request, where translation is applied. */
export const QuickReplyInput = z
  .object({
    title: SafeName.trim().min(1).max(80),
    text: SafeText.trim().min(1).max(1000),
  })
  .strict();
export type QuickReplyInput = z.infer<typeof QuickReplyInput>;
export const UpdateQuickReplyRequest = QuickReplyInput.partial().refine(
  (input) => Object.keys(input).length > 0,
);
export type UpdateQuickReplyRequest = z.infer<typeof UpdateQuickReplyRequest>;
export const QuickReply = QuickReplyInput.extend({
  id: Id,
  position: z.number().int().min(0).max(49),
});
export type QuickReply = z.infer<typeof QuickReply>;
export const QuickReplyList = z.array(QuickReply).max(50);
export type QuickReplyList = z.infer<typeof QuickReplyList>;
export const ReorderQuickRepliesRequest = z
  .object({
    ids: z
      .array(Id)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export type ReorderQuickRepliesRequest = z.infer<typeof ReorderQuickRepliesRequest>;

export const RequestFromCitizenRequest = z.object({
  /** Required by the API for writes; use updatedAt from the dossier and reload on 409. */
  expectedUpdatedAt: IsoDateTime.optional(),
  checklistItemIds: z.array(Id).max(50),
  /** Italian text; translated to the citizen language by the server. */
  message: SafeText.trim().min(1).max(1000),
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
  /** Share (0–1) of submitted dossiers with zero blockers at first submission. Null when no data. */
  completeAtFirstSubmission: z.number().min(0).max(1).nullable(),
  avgCitizenMinutes: z.number().nullable(),
  avgReviewMinutes: z.number().nullable(),
  /** Baseline declared by the CAF in settings (manual prep minutes per case before Avanti). */
  baselineMinutesPerCase: z.number().nullable(),
  /** Share (0–1) of submitted dossiers sent back to the citizen at least once. */
  needsCitizenRate: z.number().min(0).max(1).nullable(),
  byPractice: z.array(z.object({ practiceId: PracticeId, count: z.number().int() })),
  byLanguage: z.array(z.object({ language: Language, count: z.number().int() })),
  daily: z.array(
    z.object({ date: IsoDate, started: z.number().int(), submitted: z.number().int() }),
  ),
});
export type Metrics = z.infer<typeof Metrics>;

/** Operational DTO: fixed codes/counts only, no identities or provider diagnostics. */
export const SystemStatusLevel = z.enum(["ok", "attention", "problem"]);
export type SystemStatusLevel = z.infer<typeof SystemStatusLevel>;
export const SystemStatusCode = z.enum([
  "available",
  "unavailable",
  "probe_unavailable",
  "not_configured",
  "no_observations",
  "ai_fallback",
  "ai_errors",
  "never_run",
  "running",
  "stale",
  "failed",
  "backlog",
  "recent_errors",
  "not_supported",
  "email_simulated",
  "email_backlog",
  "email_failed",
]);
const StatusComponent = z
  .object({
    status: SystemStatusLevel,
    code: SystemStatusCode.exclude(["email_simulated", "email_backlog", "email_failed"]),
  })
  .strict();
const StatusCounter = StatusComponent.extend({
  count: z.number().int().nonnegative().nullable(),
}).strict();
const StatusJob = StatusComponent.extend({
  lastStartedAt: IsoDateTime.nullable(),
  lastFinishedAt: IsoDateTime.nullable(),
  outcome: z.enum(["running", "ok", "failed"]).nullable(),
}).strict();
export const SystemStatus = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: IsoDateTime,
    usage: CommercialUsage.optional(),
    status: SystemStatusLevel,
    version: z
      .object({
        commit: z
          .string()
          .regex(/^[a-f0-9]{7,40}$/i)
          .nullable(),
        tag: z
          .string()
          .regex(/^v?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/)
          .max(80)
          .nullable(),
      })
      .strict(),
    components: z
      .object({
        database: StatusComponent,
        storage: StatusComponent,
        ai: StatusComponent.extend({
          configured: z.boolean(),
          mode: z.enum(["ai", "fallback", "unknown"]),
          /** Current UTC hour plus the preceding 23 hours, scoped to the authenticated CAF. */
          hourly: z
            .array(
              z
                .object({
                  hour: IsoDateTime,
                  successes: z.number().int().nonnegative(),
                  fallbacks: z.number().int().nonnegative(),
                  errors: z.number().int().nonnegative(),
                })
                .strict(),
            )
            .length(24)
            .nullable(),
        }).strict(),
        maintenance: StatusJob,
        retention: StatusJob,
        email: StatusComponent.extend({
          code: z.enum([
            "available",
            "unavailable",
            "email_simulated",
            "email_backlog",
            "email_failed",
          ]),
          provider: z.enum(["console", "resend"]),
          queuedOver1Hour: z.number().int().nonnegative().nullable(),
          failed24Hours: z.number().int().nonnegative().nullable(),
          sent24Hours: z.number().int().nonnegative().nullable(),
        }).strict(),
      })
      .strict(),
    counters: z
      .object({
        documentsProcessingOver10Minutes: StatusCounter,
        casesWaitingForCitizenOver7Days: StatusCounter,
        linksExpiringWithin7Days: StatusCounter,
        recentApiErrors24Hours: StatusCounter,
        /** All pending/sending notifications for the authenticated CAF, regardless of age. */
        notificationsQueued: StatusCounter,
      })
      .strict(),
  })
  .strict();
export type SystemStatus = z.infer<typeof SystemStatus>;
export const SystemStatusQuery = z.object({}).strict();

/* ------------------------------------------------------------------ */
/* Administration (role "admin" only, scoped to the operator's organization) */
/* ------------------------------------------------------------------ */

export const AuditAction = z.enum([
  "copilot.asked",
  "privacy.accepted",
  "case.created",
  "case.viewed",
  "case.link_created",
  "case.link_regenerated",
  "answer.updated",
  "answer.edited",
  "language.updated",
  "review.started",
  "review.completed",
  "citizen.requested",
  "citizen.question",
  "document.kept",
  "document.uploaded",
  "document.analyzed",
  "document.reassigned",
  "document.deleted",
  "document.downloaded",
  "documents.archive_downloaded",
  "case.submitted",
  "checklist.reviewed",
  "case.requested",
  "case.in_review",
  "case.needs_citizen",
  "case.reopened",
  "case.assigned",
  "case.note_updated",
  "checklist.verified",
  "checklist.rejected",
  "checklist.waived",
  "checklist.reset",
  "case.ready",
  "case.closed",
  "case.exported",
  "citizen.checklist_printed",
  "dsu_sheet.viewed",
  "case.deleted",
  "case.retention_deleted",
  "family.searched",
  "renewals.listed",
  "renewal.created",
  "renewal.link_regenerated",
  "renewal.invitation_queued",
  "renewal.household_confirmed",
  "renewal.consent_updated",
  "case.reused",
  "document.reuse_checked",
  "family.erased",
  "auth.login_succeeded",
  "auth.login_failed",
  "auth.password_changed",
  "auth.logged_out",
  "auth.mfa_enabled",
  "auth.mfa_disabled",
  "auth.mfa_failed",
  "auth.mfa_recovery_used",
  "auth.mfa_recovery_regenerated",
  "operator.mfa_reset",
  "operator.created",
  "operator.updated",
  "operator.deactivated",
  "operator.activated",
  "operator.password_reset",
  "settings.updated",
  "near_ready.resumed",
  "quick_reply.created",
  "quick_reply.updated",
  "quick_reply.deleted",
  "quick_reply.reordered",
  "citizen.reminder_sent",
  "citizen.reminder_simulated",
  "office.created",
  "office.updated",
  "organization.bootstrapped",
  "organization.exported",
  "audit.exported",
  "pilot_report.exported",
  "activity.recorded",
]);
export type AuditAction = z.infer<typeof AuditAction>;

/** Fixed keys only: never citizen text, names, email, document names or credential hashes. */
export const AuditDetails = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  consented: z.boolean().optional(),
  consentTextVersion: z.number().int().positive().optional(),
  consentLanguage: z.number().int().min(0).max(7).optional(),
  answersCount: z.number().int().nonnegative().optional(),
  heuristic: z.boolean().optional(),
  bytes: z.number().int().nonnegative().optional(),
  blockers: z.number().int().nonnegative().optional(),
  first: z.boolean().optional(),
  itemsCount: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().nonnegative().nullable().optional(),
  cases: z.number().int().nonnegative().optional(),
  reminders: z.number().int().nonnegative().optional(),
  documents: z.number().int().nonnegative().optional(),
  rows: z.number().int().nonnegative().optional(),
  rateLimited: z.boolean().optional(),
  cli: z.boolean().optional(),
  reportJson: z.boolean().optional(),
  reportCsv: z.boolean().optional(),
  reportPdf: z.boolean().optional(),
});
export type AuditDetails = z.infer<typeof AuditDetails>;

export const AuditQuery = z
  .object({
    /** Inclusive lower bound and exclusive upper bound, with explicit UTC offset. */
    from: IsoDateTime.optional(),
    to: IsoDateTime.optional(),
    operatorId: Id.optional(),
    reference: z.string().trim().min(1).max(64).optional(),
    action: AuditAction.optional(),
    cursor: z
      .string()
      .min(1)
      .max(1024)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine((q) => !q.from || !q.to || Date.parse(q.from) < Date.parse(q.to), {
    message: "Il periodo non è valido.",
  });
export type AuditQuery = z.infer<typeof AuditQuery>;

export const AuditEvent = z.object({
  id: Id,
  /** ISO instant with the Europe/Rome offset at that instant (including daylight saving). */
  at: IsoDateTime,
  timeZone: z.literal("Europe/Rome"),
  actor: z.object({ type: z.enum(["operator", "citizen", "system"]), id: Id.nullable() }),
  /** Account affected by a reset/deactivation or attempted login; not proof of identity. */
  subjectOperatorId: Id.nullable(),
  action: AuditAction,
  label: z.string(),
  case: z.object({ id: Id, reference: z.string().nullable(), deleted: z.boolean() }).nullable(),
  details: AuditDetails,
});
export type AuditEvent = z.infer<typeof AuditEvent>;
export const AuditPage = z.object({
  items: z.array(AuditEvent),
  nextCursor: z.string().nullable(),
});
export type AuditPage = z.infer<typeof AuditPage>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

export const CitizenReminderDays = z.array(z.number().int().min(1).max(30)).min(1).max(2);
export type CitizenReminderDays = z.infer<typeof CitizenReminderDays>;

export const OrganizationSettings = z.object({
  nearReadyMode: z.enum(["off", "shadow", "visible"]).default("shadow"),
  nearReadyCriticalThreshold: z.number().min(0).max(1).default(0.98),
  nearReadyOtherThreshold: z.number().min(0).max(1).default(0.95),
  nearReadySuspendedAt: IsoDateTime.nullable().default(null),
  mfaRequired: z.boolean().default(false),
  aiCopilot: z.boolean().default(true),
  aiCitizenAssistant: z.boolean().default(true),
  /** Minutes per case measured by the CAF before Avanti; null until measured. */
  baselineMinutesPerCase: z.number().int().min(1).max(600).nullable(),
  /** Validity of citizen links, in days. */
  linkDays: z.number().int().min(1).max(365),
  /** How long Avanti keeps closed or expired cases and their files, in days. */
  retentionDays: z.number().int().min(30).max(3650),
  /** Service email when the operator marks a case ready. Off unless enabled by the CAF. */
  notifyCitizenReady: z.boolean().default(false),
  /** First-submission receipt. Off until the organization enables the email channel. */
  notifyCitizenSubmission: z.boolean().default(false),
  notifyCitizenRenewals: z.boolean().default(false),
  /** Daily UTC aggregate, sent to active operators. No citizen data. */
  notifyOperatorDigest: z.boolean().default(false),
  notifyCitizenReminders: z.boolean().default(false),
  /** First delay after the request, then additional days after the first delivery. */
  citizenReminderDays: CitizenReminderDays.default([3, 4]),
});
export type OrganizationSettings = z.infer<typeof OrganizationSettings>;

// PATCH must preserve omitted preferences: Zod defaults would otherwise reset them
// (an unrelated PATCH would turn off required MFA or the email notices).
// AI is included in the plan: the budget is not part of the CAF's settings. A stale client
// sending `aiMonthlyBudgetEur` is not rejected, because unknown keys are stripped.
export const UpdateSettingsRequest = OrganizationSettings.omit({
  nearReadySuspendedAt: true,
})
  .partial()
  .extend({
    nearReadyMode: z.enum(["off", "shadow", "visible"]).optional(),
    nearReadyCriticalThreshold: z.number().min(0).max(1).optional(),
    nearReadyOtherThreshold: z.number().min(0).max(1).optional(),
    aiCopilot: z.boolean().optional(),
    aiCitizenAssistant: z.boolean().optional(),
    mfaRequired: z.boolean().optional(),
    notifyCitizenReady: z.boolean().optional(),
    notifyCitizenSubmission: z.boolean().optional(),
    notifyCitizenRenewals: z.boolean().optional(),
    notifyOperatorDigest: z.boolean().optional(),
    notifyCitizenReminders: z.boolean().optional(),
    citizenReminderDays: CitizenReminderDays.optional(),
  });
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequest>;

export const OperatorSummary = z.object({
  mfaEnabled: z.boolean().default(false),
  id: Id,
  name: z.string(),
  email: z.string().email(),
  role: OperatorRole,
  active: z.boolean(),
  lastLoginAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type OperatorSummary = z.infer<typeof OperatorSummary>;

export const CreateOperatorRequest = z.object({
  name: SafeName.trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role: OperatorRole.default("operator"),
});
export type CreateOperatorRequest = z.infer<typeof CreateOperatorRequest>;

/** The temporary password is returned once and never stored in clear. */
export const TemporaryPasswordResponse = z.object({
  operator: OperatorSummary,
  temporaryPassword: z.string(),
});
export type TemporaryPasswordResponse = z.infer<typeof TemporaryPasswordResponse>;

/** An admin cannot demote or deactivate themselves (the API answers `conflict`). */
export const UpdateOperatorRequest = z.object({
  name: SafeName.trim().min(2).max(120).optional(),
  role: OperatorRole.optional(),
  active: z.boolean().optional(),
});
export type UpdateOperatorRequest = z.infer<typeof UpdateOperatorRequest>;

export const OfficeInput = z.object({
  name: SafeName.trim().min(2).max(120),
  address: SafeName.trim().max(200).default(""),
  city: SafeName.trim().min(2).max(120),
  phone: SafeName.trim().max(30).nullable().optional(),
  openingHours: SafeText.trim().max(200).nullable().optional(),
  bookingUrl: BookingUrl.nullable().optional(),
  citizenNote: SafeText.trim().max(300).nullable().optional(),
});
export type OfficeInput = z.infer<typeof OfficeInput>;

/** Interactive CLI provisioning; never exposed as an unauthenticated API. */
export const BootstrapOrganizationRequest = z.object({
  organization: z.object({
    name: SafeName.trim().min(2).max(160),
    kind: OrganizationKind,
  }),
  office: OfficeInput.extend({
    slug: z
      .string()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }),
  admin: CreateOperatorRequest.pick({ name: true, email: true }),
  confirmation: z.literal("CREA CAF PILOTA"),
});

export const OrganizationExportRequest = z.object({
  organizationId: Id,
  login: LoginRequest.extend({ code: MfaCode.optional() }),
});

export const UpdateOfficeRequest = OfficeInput.partial().extend({
  // A create default must not erase the address during an unrelated PATCH.
  address: SafeName.trim().max(200).optional(),
});
export type UpdateOfficeRequest = z.infer<typeof UpdateOfficeRequest>;

/**
 * Permanent erasure of a case and its files (GDPR request handled by the CAF).
 * The reference must be typed again to confirm. Leaves an audit entry without personal data.
 */
export const DeleteCaseRequest = z.object({ confirmReference: z.string().trim().min(1) });
export type DeleteCaseRequest = z.infer<typeof DeleteCaseRequest>;

/* ------------------------------------------------------------------ */
/* Public site                                                         */
/* ------------------------------------------------------------------ */

export const PilotLeadRequest = z.object({
  name: SafeName.trim().min(2).max(120),
  organization: SafeName.trim().min(2).max(160),
  role: SafeName.trim().max(120).optional(),
  email: z.string().trim().email().max(200),
  phone: SafeName.trim().max(30).optional(),
  offices: z.coerce.number().int().min(1).max(5000).optional(),
  message: SafeText.trim().max(2000).optional(),
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
  "practice_unavailable",
  "unauthorized",
  "forbidden",
  "not_found",
  "link_expired",
  "conflict",
  "file_too_large",
  "unsupported_file",
  /** The case already holds the most documents or bytes allowed: delete some first. */
  "case_full",
  "rate_limited",
  "ai_unavailable",
  "transcription_unavailable",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    /** Safe to show; domain errors may use the citizen language. Never contains internals. */
    message: SafeText,
    /** Field-level validation issues, keyed by dotted path. */
    fields: z.record(z.string(), z.string()).optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

/** Value of `IDEMPOTENCY_HEADER`: a UUID fits. */
export const IdempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

export * from "./pilot-report";

/* Copilota: le proposte non sono decisioni sulla pratica. */
export const Evidence = z.object({
  kind: z.enum(["answer", "document", "checklist", "finding"]),
  id: SafeText.min(1).max(200),
  label: SafeText.min(1).max(500),
});
export type Evidence = z.infer<typeof Evidence>;
export const AiEngine = z.enum(["ai", "heuristic"]);
export type AiEngine = z.infer<typeof AiEngine>;
export type Engine = AiEngine;
const AiVersion = { engine: AiEngine, generatedAt: IsoDateTime, caseVersion: IsoDateTime };
export const DossierBrief = z.object({
  situation: SafeText.min(1).max(1000),
  attention: z
    .array(z.object({ text: SafeText.min(1).max(700), evidence: z.array(Evidence).min(1).max(20) }))
    .max(5),
  missing: z.array(SafeText.min(1).max(200)).max(1000),
  nextStep: z.enum([
    "verify_documents",
    "ask_citizen",
    "ready_for_practice",
    "needs_operator_judgement",
  ]),
  nextStepReason: SafeText.min(1).max(700),
  model: SafeText.nullable(),
  ...AiVersion,
});
export type DossierBrief = z.infer<typeof DossierBrief>;
export const ConsistencyIssue = z.object({
  id: SafeText.min(1).max(200),
  severity: z.enum(["blocker", "warning", "info"]),
  text: SafeText.min(1).max(700),
  evidence: z.array(Evidence).min(1).max(20),
  checklistItemId: Id.nullable(),
});
export type ConsistencyIssue = z.infer<typeof ConsistencyIssue>;
export const DossierConsistency = z.object({
  issues: z.array(ConsistencyIssue).max(2000),
  ...AiVersion,
});
export type DossierConsistency = z.infer<typeof DossierConsistency>;
export const DsuPrefillField = z.object({
  sectionId: SafeText.min(1).max(200),
  fieldId: SafeText.min(1).max(200),
  label: SafeText.min(1).max(200),
  value: z.union([SafeText.min(1).max(300), z.number().finite()]),
  documentId: Id,
  page: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
  note: SafeText.max(700).nullable(),
});
export type DsuPrefillField = z.infer<typeof DsuPrefillField>;
export const DsuPrefill = z.object({ fields: z.array(DsuPrefillField).max(200), ...AiVersion });
export type DsuPrefill = z.infer<typeof DsuPrefill>;
export const RequestDraftRequest = z.object({
  checklistItemIds: z
    .array(Id)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const RequestDraftResponse = z.object({
  message: SafeText.min(1).max(3000),
  engine: AiEngine,
});
export type RequestDraftResponse = z.infer<typeof RequestDraftResponse>;
export const KnowledgeCitation = z.object({
  id: SafeText.min(1).max(200),
  title: SafeText.min(1).max(500),
  source: SafeText.min(1).max(500),
  url: z.string().url().nullable(),
});
export type KnowledgeCitation = z.infer<typeof KnowledgeCitation>;
export const OperatorAskRequest = z.object({
  question: SafeText.trim().min(3).max(500),
  practiceId: PracticeId.optional(),
});
export const OperatorAskResponse = z.object({
  answer: SafeText.min(1).max(18000),
  coverage: z.enum(["full", "partial", "none"]),
  citations: z.array(KnowledgeCitation).max(10),
  engine: AiEngine,
});
export type OperatorAskResponse = z.infer<typeof OperatorAskResponse>;
export const ReplyDraftRequest = z.object({ messageId: Id });
export const ReplyDraftResponse = z.object({
  message: SafeText.min(1).max(3000),
  citations: z.array(KnowledgeCitation).max(10),
  engine: AiEngine,
});
export type ReplyDraftResponse = z.infer<typeof ReplyDraftResponse>;
export const PrefillDecisionResponse = z.object({
  fieldId: SafeText.min(1).max(200),
  decision: z.enum(["accepted", "rejected"]),
});

export const ConsistencyReport = DossierConsistency;
export type ConsistencyReport = DossierConsistency;
export const KnowledgeAnswer = OperatorAskResponse;
export type KnowledgeAnswer = OperatorAskResponse;

export type RequestDraftRequest = z.infer<typeof RequestDraftRequest>;
export type OperatorAskRequest = z.infer<typeof OperatorAskRequest>;
export type ReplyDraftRequest = z.infer<typeof ReplyDraftRequest>;
export type PrefillDecisionResponse = z.infer<typeof PrefillDecisionResponse>;

/** Operator-private dossier chat. History is context, never a source of dossier facts. */
export const DossierAskHistoryTurn = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: SafeText.trim().min(1).max(5000),
  })
  .strict();
export const DossierAskRequest = z
  .object({
    question: SafeText.trim().min(3).max(1000),
    history: z.array(DossierAskHistoryTurn).max(8).optional(),
  })
  .strict();
export const DossierAskResponse = z.object({
  answer: SafeText.min(1).max(6000),
  evidence: z.array(Evidence).max(60),
  citations: z.array(KnowledgeCitation).max(5),
  engine: AiEngine,
  suggestions: z.array(SafeText.trim().min(1).max(150)).min(2).max(3).optional(),
});
export const DossierChatTurn = z.object({
  id: Id,
  question: DossierAskRequest.shape.question,
  response: DossierAskResponse,
  createdAt: IsoDateTime,
  caseVersion: IsoDateTime,
});
/** POST answer, plus the saved turn's identity so the client never invents one. */
export const DossierAskResult = DossierAskResponse.extend({
  turn: DossierChatTurn.pick({ id: true, createdAt: true, caseVersion: true }),
});
export const DossierChatQuery = z.object({ beforeId: Id.optional() }).strict();
export const DossierChatResponse = z.object({
  /** Chronological order within this page. Old references describe the version at generation. */
  turns: z.array(DossierChatTurn).max(50),
  nextBeforeId: Id.nullable(),
});
export type DossierAskRequest = z.infer<typeof DossierAskRequest>;
export type DossierAskResponse = z.infer<typeof DossierAskResponse>;
export type DossierChatTurn = z.infer<typeof DossierChatTurn>;
export type DossierAskResult = z.infer<typeof DossierAskResult>;
export type DossierChatResponse = z.infer<typeof DossierChatResponse>;

export * from "./platform";
