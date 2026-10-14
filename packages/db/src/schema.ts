import type {
  AnswerValue,
  CaseStatus,
  CitizenContactRequest,
  DocumentAnalysis,
  DocumentStatus,
  Language,
  Operator,
  PracticeId,
} from "@avanti/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").$type<"caf" | "patronato" | "studio">().notNull(),
  },
  (t) => [check("organizations_kind_check", sql`${t.kind} in ('caf', 'patronato', 'studio')`)],
);

export const offices = pgTable(
  "offices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    phone: text("phone"),
    openingHours: text("opening_hours"),
  },
  (t) => [
    unique("offices_id_org_unique").on(t.id, t.organizationId),
    index("offices_org_idx").on(t.organizationId),
  ],
);

export const operators = pgTable(
  "operators",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<Operator["role"]>().notNull(),
    active: boolean("active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: instant("last_login_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("operators_id_org_unique").on(t.id, t.organizationId),
    index("operators_org_idx").on(t.organizationId),
    check("operators_role_check", sql`${t.role} in ('admin', 'operator')`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_expires_idx").on(t.expiresAt)],
);

export const cases = pgTable(
  "cases",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    officeId: text("office_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    reference: text("reference").notNull(),
    language: text("language").$type<Language>().notNull(),
    practiceId: text("practice_id").$type<PracticeId>(),
    status: text("status").$type<CaseStatus>().notNull().default("intake"),
    editingQuestion: text("editing_question"),
    confirmedAnswers: jsonb("confirmed_answers").$type<string[]>().notNull().default([]),
    answers: jsonb("answers").$type<Record<string, AnswerValue>>().notNull().default({}),
    contact: jsonb("contact").$type<Partial<CitizenContactRequest>>(),
    citizenNote: text("citizen_note"),
    internalNotes: text("internal_notes"),
    assigneeId: text("assignee_id"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    submittedAt: instant("submitted_at"),
    reviewStartedAt: instant("review_started_at"),
    reviewCompletedAt: instant("review_completed_at"),
    closedAt: instant("closed_at"),
    expiresAt: instant("expires_at").notNull(),
    firstSubmissionComplete: boolean("first_submission_complete"),
  },
  (t) => [
    foreignKey({
      columns: [t.officeId, t.organizationId],
      foreignColumns: [offices.id, offices.organizationId],
      name: "cases_office_org_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.assigneeId, t.organizationId],
      foreignColumns: [operators.id, operators.organizationId],
      name: "cases_assignee_org_fk",
    }).onDelete("restrict"),
    unique("cases_id_org_unique").on(t.id, t.organizationId),
    check(
      "cases_language_check",
      sql`${t.language} in ('it', 'en', 'fr', 'es', 'ro', 'uk', 'ar', 'bn')`,
    ),
    check(
      "cases_practice_check",
      sql`${t.practiceId} is null or ${t.practiceId} in ('isee_ordinario', 'isee_universitario', 'modello_730', 'red', 'assegno_unico', 'successione_semplice', 'permesso_soggiorno', 'cittadinanza', 'naspi')`,
    ),
    uniqueIndex("cases_org_reference_unique").on(t.organizationId, t.reference),
    index("cases_org_status_updated_idx").on(t.organizationId, t.status, t.updatedAt, t.id),
    index("cases_org_office_created_idx").on(t.organizationId, t.officeId, t.createdAt),
    index("cases_org_assignee_idx").on(t.organizationId, t.assigneeId),
    index("cases_reference_search_idx").using("gin", sql`${t.reference} gin_trgm_ops`),
    index("cases_contact_search_idx").using(
      "gin",
      sql`(coalesce(${t.contact}->>'firstName','') || ' ' || coalesce(${t.contact}->>'lastName','')) gin_trgm_ops`,
    ),
    index("cases_org_updated_idx").on(t.organizationId, t.updatedAt, t.id),
    index("cases_org_office_updated_idx").on(t.organizationId, t.officeId, t.updatedAt, t.id),
    index("cases_org_practice_updated_idx").on(t.organizationId, t.practiceId, t.updatedAt, t.id),
    index("cases_org_assignee_updated_idx").on(t.organizationId, t.assigneeId, t.updatedAt, t.id),
    index("cases_org_created_idx").on(t.organizationId, t.createdAt),
    index("cases_org_submitted_idx").on(t.organizationId, t.submittedAt),
    index("cases_org_office_submitted_idx").on(t.organizationId, t.officeId, t.submittedAt),
    index("cases_expires_idx").on(t.expiresAt),
    check(
      "cases_status_check",
      sql`${t.status} in ('intake','submitted','in_review','needs_citizen','ready','closed')`,
    ),
  ],
);

export const checklistReviews = pgTable(
  "checklist_reviews",
  {
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    decision: text("decision").$type<"verified" | "rejected" | "waived">().notNull(),
    note: text("note"),
    operatorId: text("operator_id").references(() => operators.id, { onDelete: "set null" }),
    reviewedAt: instant("reviewed_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.caseId, t.itemId] }),
    check(
      "checklist_reviews_decision_check",
      sql`${t.decision} in ('verified', 'rejected', 'waived')`,
    ),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pages: integer("pages"),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    uploadedAt: instant("uploaded_at").notNull(),
    checklistItemId: text("checklist_item_id"),
    memberId: text("member_id"),
    status: text("status").$type<DocumentStatus>().notNull(),
    analysis: jsonb("analysis").$type<DocumentAnalysis>(),
    analysisLeaseToken: text("analysis_lease_token"),
    analysisLeaseUntil: instant("analysis_lease_until"),
  },
  (t) => [
    index("documents_case_idx").on(t.caseId, t.uploadedAt),
    index("documents_processing_idx")
      .on(t.uploadedAt, t.id)
      .where(sql`${t.status} = 'processing'`),
    index("documents_case_sha_idx").on(t.caseId, t.sha256),
    check("documents_status_check", sql`${t.status} in ('processing', 'analyzed', 'failed')`),
    check("documents_size_check", sql`${t.sizeBytes} >= 0`),
    check("documents_pages_check", sql`${t.pages} is null or ${t.pages} > 0`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    role: text("role").$type<"citizen" | "assistant" | "operator" | "system">().notNull(),
    text: text("text").notNull(),
    originalText: text("original_text"),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [
    index("messages_case_time_idx").on(t.caseId, t.createdAt),
    check("messages_role_check", sql`${t.role} in ('citizen', 'assistant', 'operator', 'system')`),
  ],
);

export type EventMetadata = Record<string, number | boolean | null>;
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").references(() => cases.id, { onDelete: "restrict" }),
    // No FK: the erasure audit survives the removal of the case and its personal data.
    deletedCaseId: text("deleted_case_id"),
    caseReference: text("case_reference"),
    subjectOperatorId: text("subject_operator_id"),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    actor: text("actor").$type<"citizen" | "operator" | "system" | "ai">().notNull(),
    actorId: text("actor_id"),
    type: text("type").notNull(),
    at: instant("at").notNull(),
    metadata: jsonb("metadata").$type<EventMetadata>().notNull().default({}),
  },
  (t) => [
    foreignKey({
      columns: [t.caseId, t.organizationId],
      foreignColumns: [cases.id, cases.organizationId],
      name: "events_case_org_fk",
    }).onDelete("restrict"),
    check(
      "events_scope_check",
      sql`${t.organizationId} is not null or (${t.type} = 'auth.login_failed' and ${t.actor} = 'system' and ${t.actorId} is null and ${t.subjectOperatorId} is null and ${t.caseId} is null and ${t.deletedCaseId} is null and ${t.caseReference} is null)`,
    ),
    check("events_actor_check", sql`${t.actor} in ('citizen', 'operator', 'system', 'ai')`),
    check(
      "events_metadata_check",
      sql`jsonb_typeof(${t.metadata}) = 'object' and not jsonb_path_exists(${t.metadata}, '$.* ? (@.type() != "number" && @.type() != "boolean" && @.type() != "null")')`,
    ),
    index("events_case_type_time_idx").on(t.caseId, t.type, t.at),
    index("events_case_time_idx").on(t.caseId, t.at),
    index("events_org_type_time_idx").on(t.organizationId, t.type, t.at),
    index("events_org_time_id_idx").on(t.organizationId, t.at, t.id),
    index("events_at_id_idx").on(t.at, t.id),
    index("events_org_reference_time_idx").on(t.organizationId, t.caseReference, t.at, t.id),
    index("events_org_actor_time_idx").on(t.organizationId, t.actorId, t.at, t.id),
    index("events_org_subject_time_idx").on(t.organizationId, t.subjectOperatorId, t.at, t.id),
  ],
);

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organization: text("organization").notNull(),
  role: text("role"),
  email: text("email").notNull(),
  phone: text("phone"),
  offices: integer("offices"),
  message: text("message"),
  privacyAcceptedAt: instant("privacy_accepted_at").notNull(),
  createdAt: instant("created_at").notNull(),
});

export const settings = pgTable(
  "settings",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    baselineMinutesPerCase: integer("baseline_minutes_per_case"),
    retentionDays: integer("retention_days").notNull().default(180),
    linkDays: integer("link_days").notNull().default(60),
  },
  (t) => [
    check("settings_days_check", sql`${t.retentionDays} > 0 and ${t.linkDays} > 0`),
    check(
      "settings_baseline_check",
      sql`${t.baselineMinutesPerCase} is null or ${t.baselineMinutesPerCase} > 0`,
    ),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: instant("reset_at").notNull(),
  },
  (t) => [
    index("rate_limits_reset_idx").on(t.resetAt),
    check("rate_limits_count_check", sql`${t.count} > 0`),
  ],
);

export const referenceCounters = pgTable(
  "reference_counters",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    value: integer("value").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.year] }),
    check("reference_counters_value_check", sql`${t.value} > 0`),
  ],
);

export const storageDeletions = pgTable("storage_deletions", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt: instant("created_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: instant("next_attempt_at").notNull(),
});
