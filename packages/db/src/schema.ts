import type {
  AnswerValue,
  CaseStatus,
  CitizenContactRequest,
  DocumentAnalysis,
  DocumentStatus,
  Language,
  MemberRole,
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

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").$type<"caf" | "patronato" | "studio">().notNull(),
});

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
  },
  (t) => [
    unique("operators_id_org_unique").on(t.id, t.organizationId),
    index("operators_org_idx").on(t.organizationId),
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
    uniqueIndex("cases_org_reference_unique").on(t.organizationId, t.reference),
    index("cases_org_status_updated_idx").on(t.organizationId, t.status, t.updatedAt, t.id),
    index("cases_org_office_created_idx").on(t.organizationId, t.officeId, t.createdAt),
    index("cases_org_assignee_idx").on(t.organizationId, t.assigneeId),
    index("cases_expires_idx").on(t.expiresAt),
    check(
      "cases_status_check",
      sql`${t.status} in ('intake','submitted','in_review','needs_citizen','ready','closed')`,
    ),
  ],
);

export const members = pgTable(
  "members",
  {
    id: text("id").notNull(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    role: text("role").$type<MemberRole>().notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    birthYear: integer("birth_year"),
  },
  (t) => [primaryKey({ columns: [t.caseId, t.id] })],
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
  (t) => [primaryKey({ columns: [t.caseId, t.itemId] })],
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
  },
  (t) => [
    index("documents_case_idx").on(t.caseId, t.uploadedAt),
    index("documents_case_sha_idx").on(t.caseId, t.sha256),
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
  (t) => [index("messages_case_time_idx").on(t.caseId, t.createdAt)],
);

export type EventMetadata = Record<string, number | boolean | null>;
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").references(() => cases.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actor: text("actor").$type<"citizen" | "operator" | "system" | "ai">().notNull(),
    actorId: text("actor_id"),
    type: text("type").notNull(),
    at: instant("at").notNull(),
    metadata: jsonb("metadata").$type<EventMetadata>().notNull().default({}),
  },
  (t) => [
    index("events_case_time_idx").on(t.caseId, t.at),
    index("events_org_type_time_idx").on(t.organizationId, t.type, t.at),
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
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
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
