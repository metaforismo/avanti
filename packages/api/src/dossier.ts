import { and, asc, eq, inArray } from "drizzle-orm";
import {
  cases,
  organizations,
  offices,
  operators,
  documents,
  messages,
  events,
  checklistReviews,
  type Database,
} from "@avanti/db";
import {
  CitizenContact,
  type CaseDossier,
  type CitizenCase,
  type DocumentSummary,
  type Language,
} from "@avanti/contracts";
import {
  buildHousehold,
  buildChecklist,
  evaluateDossier,
  nextQuestion,
  getPractice,
  getQuestions,
  dossierSummary,
  timelineLabel,
  answeredQuestions,
} from "@avanti/core";
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
  row: CaseRow,
  actor: "citizen" | "operator" | "system" | "ai",
  type: string,
  now: Date,
  actorId: string | null = null,
  metadata: Record<string, number | boolean | null> = {},
) {
  await db.insert(events).values({
    id: crypto.randomUUID(),
    caseId: row.id,
    organizationId: row.organizationId,
    actor,
    actorId,
    type,
    at: now.toISOString(),
    metadata,
  });
}
type ViewData = {
  organization: typeof organizations.$inferSelect;
  office: typeof offices.$inferSelect | undefined;
  storedDocs: (typeof documents.$inferSelect)[];
  reviews: (typeof checklistReviews.$inferSelect)[];
  chat: (typeof messages.$inferSelect)[];
};
const citizenCodes = new Set([
  "checklist.missing",
  "checklist.rejected",
  "document.expired",
  "document.wrong_year",
  "document.illegible",
  "document.missing_pages",
  "document.duplicate",
  "document.unmatched",
  "document.wrong_owner",
  "document.other_practice",
  "document.failed",
]);
export async function citizenView(
  db: Database,
  row: CaseRow,
  now: Date,
  language: Language = row.language,
  operatorView = false,
  data?: ViewData,
): Promise<CitizenCase> {
  const [[organization], [office], storedDocs, reviews, chat] = data
    ? [[data.organization], [data.office], data.storedDocs, data.reviews, data.chat]
    : await Promise.all([
        db.select().from(organizations).where(eq(organizations.id, row.organizationId)),
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
  const household = buildHousehold(row.answers);
  const checklist = row.practiceId
    ? buildChecklist(row.practiceId, row.answers, household, language)
    : [];
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
    analysis: d.analysis,
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
  for (const item of checklist)
    if (
      item.status === "uploaded" &&
      evaluation.findings.some((f) => f.checklistItemId === item.id && f.severity === "blocker")
    )
      item.status = "issue";
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
    reference: row.reference,
    status: row.status,
    step,
    language,
    practice: row.practiceId ? getPractice(row.practiceId, language) : null,
    organization: organizationView(organization),
    office: office ? officeView(office) : null,
    progress: evaluation.progress,
    nextQuestion: question,
    answers: row.answers,
    answered: answeredQuestions(
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
    messages: chat.map((m) => ({
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
      ? evaluation.findings
      : evaluation.findings.filter(
          (f) =>
            citizenCodes.has(f.code) &&
            !checklist.some(
              (item) =>
                item.id === f.checklistItemId && ["verified", "waived"].includes(item.status),
            ),
        ),
    submittedAt: row.submittedAt ? iso(row.submittedAt) : null,
    expiresAt: iso(row.expiresAt),
  };
}
export async function dossierView(db: Database, row: CaseRow, now: Date): Promise<CaseDossier> {
  const view = await citizenView(db, row, now, "it", true);
  const [timeline, [assignee], actors] = await Promise.all([
    db
      .select()
      .from(events)
      .where(and(eq(events.caseId, row.id), eq(events.organizationId, row.organizationId)))
      .orderBy(asc(events.at), asc(events.id)),
    row.assigneeId
      ? db
          .select({ id: operators.id, name: operators.name })
          .from(operators)
          .where(
            and(eq(operators.id, row.assigneeId), eq(operators.organizationId, row.organizationId)),
          )
      : Promise.resolve([]),
    db
      .select({ id: operators.id, name: operators.name })
      .from(operators)
      .where(eq(operators.organizationId, row.organizationId)),
  ]);
  const summary = dossierSummary(row.practiceId, row.answers, view.household);
  return {
    id: row.id,
    reference: row.reference,
    citizenName: row.contact?.firstName
      ? [row.contact.firstName, row.contact.lastName].filter(Boolean).join(" ")
      : null,
    practice: view.practice,
    status: row.status,
    language: row.language,
    office: view.office,
    assignee: assignee ?? null,
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
    household: view.household,
    answers: view.answered.map(({ editable: _editable, ...answer }) => answer),
    checklist: view.checklist,
    documents: view.documents,
    findings: view.findings,
    messages: view.messages,
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
}

export async function caseListViews(db: Database, rows: CaseRow[], now: Date) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const organizationId = rows[0]!.organizationId;
  const [[organization], officeRows, operatorRows, storedDocs, reviews] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, organizationId)),
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
  ]);
  if (!organization) throw notFound();
  return Promise.all(
    rows.map(async (row) => {
      const office = officeRows.find((o) => o.id === row.officeId);
      const view = await citizenView(db, row, now, "it", true, {
        organization,
        office,
        storedDocs: storedDocs.filter((d) => d.caseId === row.id),
        reviews: reviews.filter((r) => r.caseId === row.id),
        chat: [],
      });
      return {
        id: row.id,
        reference: row.reference,
        citizenName: row.contact?.firstName
          ? [row.contact.firstName, row.contact.lastName].filter(Boolean).join(" ")
          : null,
        practice: view.practice,
        status: row.status,
        language: row.language,
        office: view.office,
        assignee: operatorRows.find((o) => o.id === row.assigneeId) ?? null,
        progress: view.progress,
        blockers: view.findings.filter((f) => f.severity === "blocker").length,
        warnings: view.findings.filter((f) => f.severity === "warning").length,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
        submittedAt: view.submittedAt,
      };
    }),
  );
}
