import { and, asc, eq } from "drizzle-orm";
import {
  cases,
  organizations,
  offices,
  operators,
  documents,
  messages,
  events,
  checklistReviews,
  members,
  type Database,
} from "@avanti/db";
import type { CaseDossier, CitizenCase, DocumentSummary, Language } from "@avanti/contracts";
import {
  buildHousehold,
  buildChecklist,
  evaluateDossier,
  nextQuestion,
  getPractice,
  getQuestions,
  dossierSummary,
  timelineLabel,
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
export async function persistMembers(db: Database, row: CaseRow) {
  // A composite primary key scopes deterministic household IDs to their case.
  await db.delete(members).where(eq(members.caseId, row.id));
  const household = buildHousehold(row.answers);
  if (household.length)
    await db.insert(members).values(
      household.map((m) => ({
        ...m,
        id: m.id,
        caseId: row.id,
        lastName: m.lastName ?? null,
        birthYear: m.birthYear ?? null,
      })),
    );
}
export async function citizenView(
  db: Database,
  row: CaseRow,
  now: Date,
  language: Language = row.language,
): Promise<CitizenCase> {
  const [[organization], [office], storedDocs, reviews, chat] = await Promise.all([
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
    ? buildChecklist(row.practiceId, row.answers, household, language, now)
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
  const question = row.practiceId ? nextQuestion(row.practiceId, row.answers, language, now) : null;
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
    practice: row.practiceId ? getPractice(row.practiceId, language, now) : null,
    organization: organizationView(organization),
    office: office ? officeView(office) : null,
    progress: evaluation.progress,
    nextQuestion: question,
    answers: row.answers,
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
    findings: evaluation.findings,
    submittedAt: row.submittedAt ? iso(row.submittedAt) : null,
    expiresAt: iso(row.expiresAt),
  };
}
export async function dossierView(db: Database, row: CaseRow, now: Date): Promise<CaseDossier> {
  const view = await citizenView(db, row, now, "it");
  const [timeline, [assignee]] = await Promise.all([
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
  ]);
  const summary = row.practiceId
    ? dossierSummary(row.practiceId, row.answers, view.household, now)
    : { headline: "Pratica da scegliere", facts: [] };
  const questions = row.practiceId ? getQuestions(row.practiceId, row.answers, "it", now) : [];
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
    answers: questions
      .filter((q) => q.id in row.answers)
      .map((q) => ({
        questionId: q.id,
        question: q.prompt,
        answer:
          typeof row.answers[q.id] === "string"
            ? String(row.answers[q.id])
            : JSON.stringify(row.answers[q.id]),
        section: q.section,
      })),
    checklist: view.checklist,
    documents: view.documents,
    findings: view.findings,
    messages: view.messages,
    timeline: timeline.map((e) => ({
      id: e.id,
      at: iso(e.at),
      actor: e.actor,
      actorName: null,
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
