import { RENEWAL_CONSENT_VERSIONS } from "@avanti/core";
import { nearReadyView, type NearReadyViewData } from "./near-ready-view";
import { conversationState } from "./conversation-state";
import { copilotDossier } from "./copilot-context";
import { queuePrioritySql } from "./copilot-queue";
import { and, asc, eq, inArray, getTableColumns, sql } from "drizzle-orm";
import {
  cases,
  organizations,
  offices,
  operators,
  documents,
  messages,
  events,
  checklistReviews,
  prefillDecisions,
  settings,
  nearReadyEvaluations,
  nearReadyBlindReviews,
  type Database,
} from "@avanti/db";
import {
  CitizenContact,
  AssistantTurn,
  type CaseDossier,
  type CitizenCase,
  type DocumentSummary,
  type Language,
} from "@avanti/contracts";
import {
  renewalNotice,
  renewalPending,
  assessDocumentReuse,
  practiceYear,
  buildHousehold,
  buildChecklist,
  buildDsuSheet,
  applyConfirmedPrefill,
  evaluateDossier,
  nextQuestion,
  getPractice,
  getQuestions,
  dossierSummary,
  timelineLabel,
  answeredQuestions,
  documentTypeLabel,
  referenceYearFor,
} from "@avanti/core";
import { visibleToCitizen } from "./document-visibility";
import { reuseNotice } from "./reuse-copy";
import { notFound } from "./security";
import { automaticAssistanceNotice } from "./disclosure";
import { officeView, organizationView } from "./views";

export type CaseRow = typeof cases.$inferSelect;
export const iso = (value: string) => new Date(value).toISOString();
export const minutes = (start: string | null, end: string | null) =>
  start && end ? Math.max(0, (Date.parse(end) - Date.parse(start)) / 60000) : null;
export async function caseById(
  db: Database,
  id: string,
  organizationId: string,
  lock = false,
): Promise<CaseRow> {
  const query = db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.organizationId, organizationId)))
    .limit(1);
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw notFound();
  return row;
}
export async function audit(
  db: Database,
  // Reminders kept after retention have no full case row; the office still attributes usage.
  row: Pick<CaseRow, "id" | "organizationId" | "reference"> & Partial<Pick<CaseRow, "officeId">>,
  actor: "citizen" | "operator" | "system" | "ai",
  type: string,
  now: Date,
  actorId: string | null = null,
  metadata: Record<string, number | boolean | null> = {},
) {
  await db.insert(events).values({
    id: crypto.randomUUID(),
    caseId: row.id,
    caseReference: row.reference,
    officeId: row.officeId ?? null,
    organizationId: row.organizationId,
    actor,
    actorId,
    type,
    at: now.toISOString(),
    metadata,
  });
}
type ViewData = {
  organization: typeof organizations.$inferSelect & {
    aiCitizenAssistant?: boolean | null;
    aiQueuePriority?: CaseDossier["aiPriority"];
    nearReadyEvaluation?: NearReadyViewData["evaluation"] | null;
    nearReadyPolicy?: NearReadyViewData["policy"];
    nearReadyBlind?: string | null;
  };
  office: typeof offices.$inferSelect | undefined;
  storedDocs: (typeof documents.$inferSelect)[];
  reviews: (typeof checklistReviews.$inferSelect)[];
  chat: (typeof messages.$inferSelect)[];
};
const citizenCodes = new Set([
  "checklist.missing",
  "checklist.rejected",
  "document.expired",
  "document.reuse_update",
  "document.wrong_year",
  "document.illegible",
  "document.missing_pages",
  "document.duplicate",
  "document.unmatched",
  "document.wrong_owner",
  "document.other_practice",
  "document.failed",
]);
type EvaluationRow = Pick<CaseRow, "practiceId" | "answers">;
function evaluateCase(
  row: EvaluationRow,
  storedDocs: ViewData["storedDocs"],
  reviews: ViewData["reviews"],
  now: Date,
  language: Language,
  operatorView = true,
) {
  const household = buildHousehold(row.answers);
  const checklist = row.practiceId
    ? buildChecklist(row.practiceId, row.answers, household, language)
    : [];
  const year = row.practiceId ? referenceYearFor(row.practiceId, row.answers) : null;
  const docViews: DocumentSummary[] = storedDocs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    pages: d.pages,
    uploadedAt: iso(d.uploadedAt),
    checklistItemId: checklist.some((i) => i.id === d.checklistItemId) ? d.checklistItemId : null,
    memberId: household.some((m) => m.id === d.memberId) ? d.memberId : null,
    status: d.status,
    analysis: d.analysis && {
      ...d.analysis,
      // The citizen named the file: a guess from that name is not shown back as a reading.
      detectedLabel:
        !operatorView && d.analysis.engine === "heuristic"
          ? null
          : documentTypeLabel(d.analysis, language, d.analysis.referenceYear ?? year),
    },
    reuse:
      d.reusedFromYear !== null && row.practiceId
        ? assessDocumentReuse({
            analysis: d.analysis,
            status: d.status,
            applicable: checklist.some((item) => item.id === d.checklistItemId),
            requirementId:
              checklist.find((item) => item.id === d.checklistItemId)?.requirementId ??
              d.analysis?.detectedRequirementId ??
              null,
            sourceYear: d.reusedFromYear,
            practiceId: row.practiceId,
            answers: row.answers,
            member: household.find((member) => member.id === d.memberId) ?? null,
            previousMember: d.reusedMember,
            now,
          })
        : null,
    citizenKeptAt: d.citizenKeptAt ? iso(d.citizenKeptAt) : null,
    citizenCheck: { status: d.status === "processing" ? "pending" : "warning", messages: [] },
  }));
  for (const item of checklist) {
    item.documentIds = docViews.filter((d) => d.checklistItemId === item.id).map((d) => d.id);
    const review = reviews.find((r) => r.itemId === item.id);
    item.status = review?.decision ?? (item.documentIds.length ? "uploaded" : "missing");
    item.note = review?.note ?? null;
  }
  const evaluation = row.practiceId
    ? evaluateDossier({
        practiceId: row.practiceId,
        answers: row.answers,
        household,
        checklist,
        documents: docViews,
        language,
        now,
        hashes: Object.fromEntries(storedDocs.map((d) => [d.id, d.sha256])),
      })
    : {
        findings: [],
        progress: {
          questionsAnswered: 0,
          questionsTotal: 0,
          documentsDone: 0,
          documentsRequired: 0,
          percent: 0,
        },
      };
  for (const doc of docViews) {
    if (doc.status === "processing") continue;
    // "Unchecked" is the operator's caveat on automatic reading, not something to fix.
    const issues = evaluation.findings.filter(
      (f) =>
        f.documentId === doc.id &&
        f.code !== "document.observation" &&
        f.code !== "document.unchecked",
    );
    doc.citizenCheck = {
      status: issues.some((f) => f.severity === "blocker")
        ? "problem"
        : issues.length
          ? "warning"
          : "ok",
      messages: issues.map((f) => f.message),
    };
  }
  for (const item of checklist)
    if (
      item.status === "uploaded" &&
      evaluation.findings.some((f) => f.checklistItemId === item.id && f.severity === "blocker")
    )
      item.status = "issue";
  return { household, checklist, docViews, evaluation };
}

export async function loadViewData(
  db: Database,
  row: CaseRow,
  now?: Date,
  profile?: string,
  operatorId?: string,
): Promise<ViewData> {
  const [[organization], [office], storedDocs, reviews, chat] = await Promise.all([
    db
      .select({
        ...getTableColumns(organizations),
        aiCitizenAssistant: settings.aiCitizenAssistant,
        nearReadyEvaluation: nearReadyEvaluations,
        nearReadyPolicy: settings,
        nearReadyBlind: nearReadyBlindReviews.caseId,
        aiQueuePriority: sql<
          CaseDossier["aiPriority"]
        >`(select ${queuePrioritySql(profile, now)} from ${cases} where ${cases.id} = ${row.id})`,
      })
      .from(organizations)
      .leftJoin(settings, eq(settings.organizationId, organizations.id))
      .leftJoin(
        nearReadyEvaluations,
        and(
          eq(nearReadyEvaluations.caseId, row.id),
          eq(
            nearReadyEvaluations.caseVersion,
            sql`(select max(nr.case_version) from near_ready_evaluations nr where nr.case_id = ${row.id})`,
          ),
        ),
      )
      .leftJoin(
        nearReadyBlindReviews,
        and(
          eq(nearReadyBlindReviews.caseId, row.id),
          eq(nearReadyBlindReviews.caseVersion, row.contentVersion),
          eq(nearReadyBlindReviews.operatorId, operatorId ?? ""),
        ),
      )
      .where(eq(organizations.id, row.organizationId)),
    db
      .select()
      .from(offices)
      .where(and(eq(offices.id, row.officeId), eq(offices.organizationId, row.organizationId))),
    db
      .select()
      .from(documents)
      .where(eq(documents.caseId, row.id))
      .orderBy(asc(documents.uploadedAt), asc(documents.id)),
    db.select().from(checklistReviews).where(eq(checklistReviews.caseId, row.id)),
    db
      .select()
      .from(messages)
      .where(eq(messages.caseId, row.id))
      .orderBy(asc(messages.createdAt), asc(messages.id)),
  ]);
  if (!organization) throw notFound();
  return { organization, office, storedDocs, reviews, chat };
}

export async function citizenView(
  db: Database,
  row: CaseRow,
  now: Date,
  language: Language = row.language,
  operatorView = false,
  data?: ViewData,
): Promise<CitizenCase> {
  const { organization, office, storedDocs, reviews, chat } = data ?? (await loadViewData(db, row));
  if (!organization) throw notFound();
  const { household, checklist, docViews, evaluation } = evaluateCase(
    row,
    operatorView ? storedDocs : storedDocs.filter((doc) => visibleToCitizen(doc, row)),
    reviews,
    now,
    language,
    operatorView,
  );
  const questions = row.practiceId ? getQuestions(row.practiceId, row.answers, language) : [];
  const question =
    questions.find((q) => q.id === row.editingQuestion) ??
    (row.practiceId ? nextQuestion(row.practiceId, row.answers, language) : null);
  let step: CitizenCase["step"] = "documents";
  if (["submitted", "in_review", "ready", "closed"].includes(row.status)) step = "submitted";
  else if (!row.practiceId) step = "need";
  else if (question) step = "interview";
  return {
    id: row.id,
    aiCitizenAssistant: organization.aiCitizenAssistant ?? true,
    reference: row.reference,
    status: row.status,
    step,
    language,
    practice: row.practiceId ? getPractice(row.practiceId, language, row.answers) : null,
    organization: organizationView(organization),
    office: office ? officeView(office) : null,
    progress: evaluation.progress,
    nextQuestion: question,
    answers: row.answers,
    answered: renewalPending(row.answers)
      ? []
      : answeredQuestions(
          row.practiceId ? getQuestions(row.practiceId, row.answers, language) : [],
          row.answers,
          row.confirmedAnswers,
          language,
        ),
    contact: CitizenContact.safeParse(row.contact).success
      ? CitizenContact.parse(row.contact)
      : null,
    household,
    checklist,
    documents: docViews,
    renewal: row.renewalYear
      ? {
          year: row.renewalYear,
          previousYear: row.renewalYear - 1,
          householdConfirmationRequired: renewalPending(row.answers),
          householdConfirmedAt: row.renewalHouseholdConfirmedAt
            ? iso(row.renewalHouseholdConfirmedAt)
            : null,
          notice: renewalNotice(language, row.renewalYear - 1, row.renewalYear),
        }
      : null,
    renewalContactConsent: row.renewalContactConsentAt !== null,
    renewalContactConsentAt: row.renewalContactConsentAt ? iso(row.renewalContactConsentAt) : null,
    renewalContactConsentVersion: row.renewalContactConsentVersion,
    renewalConsentVersion: RENEWAL_CONSENT_VERSIONS[row.language],
    practiceYear: practiceYear(row.answers),
    reuseNotice: storedDocs.some((doc) => doc.reusedFromYear !== null && visibleToCitizen(doc, row))
      ? reuseNotice[language]
      : null,
    conversation: conversationState(
      row,
      chat.filter((m) => m.kind !== "citizen_assistant" && m.kind !== "citizen_question"),
      evaluation.progress,
      now,
      language,
    ),
    messages: chat
      .filter((m) => m.kind !== "citizen_assistant")
      .map((m) => ({
        id: m.id,
        role: m.role,
        text:
          m.role === "system" && m.originalText === automaticAssistanceNotice.it
            ? automaticAssistanceNotice[language]
            : language === "it" && m.originalText
              ? m.originalText
              : m.text,
        originalText: m.originalText,
        createdAt: iso(m.createdAt),
      })),
    findings: operatorView
      ? evaluation.findings.map((finding) => ({
          ...finding,
          message: finding.operatorMessage ?? finding.message,
        }))
      : evaluation.findings
          .filter(
            (f) =>
              citizenCodes.has(f.code) &&
              !checklist.some(
                (item) =>
                  item.id === f.checklistItemId && ["verified", "waived"].includes(item.status),
              ),
          )
          .map(({ operatorMessage: _operatorMessage, ...finding }) => finding),
    submittedAt: row.submittedAt ? iso(row.submittedAt) : null,
    expiresAt: iso(row.expiresAt),
  };
}
export async function dossierView(
  db: Database,
  row: CaseRow,
  now: Date,
  operatorId?: string,
  profile?: string,
): Promise<CaseDossier> {
  const data = await loadViewData(db, row, now, profile, operatorId);
  const view = await citizenView(db, row, now, "it", true, data);
  const [timeline, actors] = await Promise.all([
    db
      .select()
      .from(events)
      .where(and(eq(events.caseId, row.id), eq(events.organizationId, row.organizationId)))
      .orderBy(asc(events.at), asc(events.id)),
    db
      .select({ id: operators.id, name: operators.name })
      .from(operators)
      .where(eq(operators.organizationId, row.organizationId)),
  ]);
  const summary = dossierSummary(row.practiceId, row.answers, view.household);
  const dossier: CaseDossier = {
    id: row.id,
    nearReady: await nearReadyView(
      db,
      row,
      operatorId,
      profile,
      now,
      data.organization.nearReadyEvaluation
        ? {
            evaluation: data.organization.nearReadyEvaluation,
            policy: data.organization.nearReadyPolicy ?? null,
            blind: data.organization.nearReadyBlind ?? null,
          }
        : null,
    ),
    nearReadyBadge: false,
    reference: row.reference,
    aiAttention: row.aiAttention,
    aiPriority: data.organization.aiQueuePriority ?? null,
    citizenName: row.contact?.firstName
      ? [row.contact.firstName, row.contact.lastName].filter(Boolean).join(" ")
      : null,
    practice: view.practice,
    status: row.status,
    language: row.language,
    office: view.office,
    assignee: actors.find((actor) => actor.id === row.assigneeId) ?? null,
    progress: view.progress,
    blockers: view.findings.filter((f) => f.severity === "blocker").length,
    warnings: view.findings.filter((f) => f.severity === "warning").length,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    submittedAt: view.submittedAt,
    citizen: {
      firstName: row.contact?.firstName ?? null,
      lastName: row.contact?.lastName ?? null,
      phone: row.contact?.phone ?? null,
      email: row.contact?.email ?? null,
    },
    ...summary,
    hasCitizenQuestion: data.chat.some((m) => m.kind === "citizen_question"),
    assistantTurns: mapAssistantTurns(data.chat.filter((m) => m.kind === "citizen_assistant")),
    household: view.household,
    answers: view.answered.map(({ editable: _editable, ...answer }) => answer),
    checklist: view.checklist,
    documents: view.documents,
    practiceYear: practiceYear(row.answers),
    dsuSheet: buildDsuSheet(
      row.practiceId,
      row.answers,
      view.household,
      view.checklist,
      view.documents,
    ),
    findings: view.findings,
    messages: view.messages,
    conversation: view.conversation,
    timeline: timeline.map((e) => ({
      id: e.id,
      at: iso(e.at),
      actor: e.actor,
      actorName:
        e.actor === "operator"
          ? (actors.find((actor) => actor.id === e.actorId)?.name ?? null)
          : null,
      type: e.type,
      label: timelineLabel(e.type),
    })),
    citizenNote: row.citizenNote,
    internalNotes: row.internalNotes,
    timing: {
      citizenMinutes: minutes(row.createdAt, row.submittedAt),
      reviewMinutes: minutes(row.reviewStartedAt, row.reviewCompletedAt),
    },
    citizenLink: null,
  };
  const decisions = await db
    .select({ field: prefillDecisions.field })
    .from(prefillDecisions)
    .innerJoin(
      documents,
      and(
        eq(documents.id, sql`${prefillDecisions.field}->>'documentId'`),
        eq(documents.caseId, row.id),
        eq(documents.sha256, prefillDecisions.documentHash),
      ),
    )
    .where(and(eq(prefillDecisions.caseId, row.id), eq(prefillDecisions.decision, "accepted")));
  if (decisions.length)
    dossier.dsuSheet = applyConfirmedPrefill(
      dossier.dsuSheet,
      copilotDossier(dossier),
      decisions.map((decision) => decision.field),
    );
  if (dossier.nearReady?.state === "accepted") {
    const order = dossier.nearReady.reviewOrder;
    const rank = (id: string) => {
      const at = order.indexOf(id);
      return at < 0 ? order.length : at;
    };
    dossier.documents.sort((a, b) => rank(a.id) - rank(b.id));
    dossier.checklist.sort(
      (a, b) =>
        Math.min(...a.documentIds.map(rank), order.length) -
        Math.min(...b.documentIds.map(rank), order.length),
    );
  }
  dossier.nearReadyBadge = dossier.aiPriority === "near_ready";
  return dossier;
}

// No capability hash, notes or interview UI state is needed to render the queue.
export const caseListColumns = {
  id: cases.id,
  aiAttention: cases.aiAttention,
  aiPriority: queuePrioritySql().as("ai_priority"),
  organizationId: cases.organizationId,
  officeId: cases.officeId,
  reference: cases.reference,
  language: cases.language,
  practiceId: cases.practiceId,
  status: cases.status,
  answers: cases.answers,
  contact: cases.contact,
  assigneeId: cases.assigneeId,
  createdAt: cases.createdAt,
  updatedAt: cases.updatedAt,
  submittedAt: cases.submittedAt,
};
type CaseListRow = Pick<CaseRow, Exclude<keyof typeof caseListColumns, "aiPriority">> & {
  aiPriority: "quick_review" | "attention" | "citizen_question" | "near_ready" | null;
};
function byCase<T extends { caseId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.caseId) ?? [];
    bucket.push(row);
    grouped.set(row.caseId, bucket);
  }
  return grouped;
}

export async function caseListViews(db: Database, rows: CaseListRow[], now: Date) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const organizationId = rows[0]!.organizationId;
  const [officeRows, operatorRows, storedDocs, reviews, questions] = await Promise.all([
    db.select().from(offices).where(eq(offices.organizationId, organizationId)),
    db
      .select({ id: operators.id, name: operators.name })
      .from(operators)
      .where(eq(operators.organizationId, organizationId)),
    db
      .select()
      .from(documents)
      .where(inArray(documents.caseId, ids))
      .orderBy(asc(documents.uploadedAt), asc(documents.id)),
    db.select().from(checklistReviews).where(inArray(checklistReviews.caseId, ids)),
    db
      .selectDistinct({ caseId: messages.caseId })
      .from(messages)
      .where(and(inArray(messages.caseId, ids), eq(messages.kind, "citizen_question"))),
  ]);
  const docsByCase = byCase(storedDocs);
  const reviewsByCase = byCase(reviews);
  const officesById = new Map(officeRows.map((o) => [o.id, officeView(o)]));
  const operatorsById = new Map(operatorRows.map((o) => [o.id, o]));
  return rows.map((row) => {
    const { evaluation } = evaluateCase(
      row,
      docsByCase.get(row.id) ?? [],
      reviewsByCase.get(row.id) ?? [],
      now,
      "it",
    );
    return {
      id: row.id,
      hasCitizenQuestion: questions.some((q) => q.caseId === row.id),
      reference: row.reference,
      citizenName: row.contact?.firstName
        ? [row.contact.firstName, row.contact.lastName].filter(Boolean).join(" ")
        : null,
      practice: row.practiceId ? getPractice(row.practiceId, "it", row.answers) : null,
      status: row.status,
      language: row.language,
      office: officesById.get(row.officeId) ?? null,
      assignee: row.assigneeId ? (operatorsById.get(row.assigneeId) ?? null) : null,
      progress: evaluation.progress,
      blockers: evaluation.findings.filter((f) => f.severity === "blocker").length,
      warnings: evaluation.findings.filter((f) => f.severity === "warning").length,
      aiAttention: row.aiAttention,
      aiPriority: row.aiPriority,
      nearReadyBadge: row.aiPriority === "near_ready",
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      submittedAt: row.submittedAt ? iso(row.submittedAt) : null,
    };
  });
}

export async function assistantTurns(db: Database, caseId: string): Promise<AssistantTurn[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.caseId, caseId), eq(messages.kind, "citizen_assistant")))
    .orderBy(asc(messages.createdAt), asc(messages.id));
  return mapAssistantTurns(rows);
}
function mapAssistantTurns(rows: ViewData["chat"]): AssistantTurn[] {
  return rows.map((m) =>
    AssistantTurn.parse({
      id: m.id,
      role: m.role,
      text: m.text,
      ...m.assistantMetadata,
      createdAt: iso(m.createdAt),
    }),
  );
}
