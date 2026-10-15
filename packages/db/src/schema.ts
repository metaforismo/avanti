import type {
  AnswerValue,
  CitizenReminderDays,
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
  doublePrecision,
  bigint,
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
    bookingUrl: text("booking_url"),
    citizenNote: text("citizen_note"),
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
    mfaSecret: text("mfa_secret"),
    mfaEnabledAt: instant("mfa_enabled_at"),
    mfaLastUsedStep: bigint("mfa_last_used_step", { mode: "number" }),
    mfaRecoveryHashes: jsonb("mfa_recovery_hashes").$type<string[]>().notNull().default([]),
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
    state: text("state")
      .$type<"authenticated" | "mfa_pending" | "mfa_setup">()
      .notNull()
      .default("authenticated"),
    mfaSetupSecret: text("mfa_setup_secret"),
    mfaSetupExpiresAt: instant("mfa_setup_expires_at"),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_expires_idx").on(t.expiresAt),
    check("sessions_state_check", sql`${t.state} in ('authenticated', 'mfa_pending', 'mfa_setup')`),
  ],
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
    familyId: text("family_id"),
    language: text("language").$type<Language>().notNull(),
    practiceId: text("practice_id").$type<PracticeId>(),
    status: text("status").$type<CaseStatus>().notNull().default("intake"),
    citizenRequestId: text("citizen_request_id"),
    citizenRequestedAt: instant("citizen_requested_at"),
    citizenRemindersQueued: integer("citizen_reminders_queued").notNull().default(0),
    citizenReminderSentAt: instant("citizen_reminder_sent_at"),
    editingQuestion: text("editing_question"),
    confirmedAnswers: jsonb("confirmed_answers").$type<string[]>().notNull().default([]),
    conversationProposals: jsonb("conversation_proposals")
      .$type<import("@avanti/contracts").Proposal[]>()
      .notNull()
      .default([]),
    conversationEngine: text("conversation_engine")
      .$type<"ai" | "heuristic">()
      .notNull()
      .default("heuristic"),
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
    index("cases_org_family_idx").on(t.organizationId, t.familyId),
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
    index("cases_citizen_reminders_idx")
      .on(t.citizenRequestedAt, t.id)
      .where(sql`${t.status} = 'needs_citizen' and ${t.citizenRequestId} is not null`),
    check("cases_reminders_check", sql`${t.citizenRemindersQueued} between 0 and 2`),
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
    reusedFromYear: integer("reused_from_year"),
    reusedMember: jsonb("reused_member").$type<import("@avanti/contracts").Member>(),
    citizenVisible: boolean("citizen_visible").notNull().default(true),
    analysisLeaseToken: text("analysis_lease_token"),
    analysisLeaseUntil: instant("analysis_lease_until"),
  },
  (t) => [
    index("documents_storage_key_idx").on(t.storageKey),
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
    kind: text("kind")
      .$type<import("@avanti/contracts").ConversationTurn["kind"]>()
      .notNull()
      .default("message"),
    questionId: text("question_id"),
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
    mfaRequired: boolean("mfa_required").notNull().default(false),
    baselineMinutesPerCase: integer("baseline_minutes_per_case"),
    aiMonthlyBudgetEur: doublePrecision("ai_monthly_budget_eur"),
    retentionDays: integer("retention_days").notNull().default(180),
    linkDays: integer("link_days").notNull().default(60),
    notifyCitizenReady: boolean("notify_citizen_ready").notNull().default(false),
    notifyCitizenSubmission: boolean("notify_citizen_submission").notNull().default(false),
    notifyOperatorDigest: boolean("notify_operator_digest").notNull().default(false),
    notifyCitizenReminders: boolean("notify_citizen_reminders").notNull().default(false),
    citizenReminderDays: jsonb("citizen_reminder_days")
      .$type<CitizenReminderDays>()
      .notNull()
      .default([3, 4]),
    lastDigestDate: text("last_digest_date"),
  },
  (t) => [
    check(
      "settings_reminder_days_check",
      sql`jsonb_typeof(${t.citizenReminderDays}) = 'array'
      and jsonb_array_length(${t.citizenReminderDays}) between 1 and 2
      and not jsonb_path_exists(${t.citizenReminderDays}, '$[*] ? (@.type() != "number" || @ < 1 || @ > 30 || @ != @.floor())')`,
    ),
    check(
      "settings_ai_budget_check",
      sql`${t.aiMonthlyBudgetEur} is null or (${t.aiMonthlyBudgetEur} >= 0 and ${t.aiMonthlyBudgetEur} <= 100000)`,
    ),
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

export type NotificationKind =
  | "pilot_lead"
  | "citizen_request"
  | "citizen_ready"
  | "citizen_submission"
  | "citizen_reminder"
  | "operator_digest";
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    kind: text("kind").$type<NotificationKind>().notNull(),
    language: text("language").$type<Language>().notNull(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    caseId: text("case_id").references(() => cases.id, { onDelete: "cascade" }),
    citizenRequestId: text("citizen_request_id"),
    reminderNumber: integer("reminder_number"),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    operatorId: text("operator_id").references(() => operators.id, { onDelete: "cascade" }),
    // AES-GCM envelope contains only recipient, sender and the rendered minimal email.
    envelope: text("envelope"),
    state: text("state")
      .$type<"pending" | "sending" | "sent" | "simulated" | "failed" | "cancelled">()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: instant("next_attempt_at").notNull(),
    firstAttemptAt: instant("first_attempt_at"),
    leaseToken: text("lease_token"),
    lastError: text("last_error"),
    createdAt: instant("created_at").notNull(),
    completedAt: instant("completed_at"),
  },
  (t) => [
    index("notifications_due_idx")
      .on(t.nextAttemptAt, t.id)
      .where(sql`${t.state} = 'pending' or ${t.state} = 'sending'`),
    index("notifications_case_idx").on(t.caseId),
    index("notifications_completed_idx").on(t.completedAt),
    check(
      "notifications_kind_check",
      sql`${t.kind} in ('pilot_lead', 'citizen_request', 'citizen_ready', 'citizen_submission', 'citizen_reminder', 'operator_digest')`,
    ),
    check(
      "notifications_reminder_check",
      sql`${t.kind} <> 'citizen_reminder' or
      (${t.citizenRequestId} is not null and ${t.reminderNumber} is not null
       and ${t.reminderNumber} between 1 and 2 and ${t.caseId} is not null and ${t.organizationId} is not null)`,
    ),
    check(
      "notifications_language_check",
      sql`${t.language} in ('it', 'en', 'fr', 'es', 'ro', 'uk', 'ar', 'bn')`,
    ),
    check(
      "notifications_state_check",
      sql`${t.state} in ('pending', 'sending', 'sent', 'simulated', 'failed', 'cancelled')`,
    ),
    check("notifications_attempts_check", sql`${t.attempts} between 0 and 5`),
    foreignKey({
      columns: [t.caseId, t.organizationId],
      foreignColumns: [cases.id, cases.organizationId],
      name: "notifications_case_org_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.operatorId, t.organizationId],
      foreignColumns: [operators.id, operators.organizationId],
      name: "notifications_operator_org_fk",
    }).onDelete("cascade"),
  ],
);

export const systemJobs = pgTable(
  "system_jobs",
  {
    kind: text("kind").$type<"maintenance" | "retention">().primaryKey(),
    runId: text("run_id").notNull(),
    startedAt: instant("started_at").notNull(),
    finishedAt: instant("finished_at"),
    outcome: text("outcome").$type<"running" | "ok" | "failed">().notNull(),
  },
  (t) => [
    check("system_jobs_kind_check", sql`${t.kind} in ('maintenance','retention')`),
    check("system_jobs_outcome_check", sql`${t.outcome} in ('running','ok','failed')`),
  ],
);

export const operationalCounters = pgTable(
  "operational_counters",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    hour: instant("hour").notNull(),
    metric: text("metric")
      .$type<"ai_success" | "ai_fallback" | "ai_error" | "api_error">()
      .notNull(),
    count: integer("count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.hour, t.metric] }),
    index("operational_counters_hour_idx").on(t.hour),
    check(
      "operational_counters_metric_check",
      sql`${t.metric} in ('ai_success','ai_fallback','ai_error','api_error')`,
    ),
    check("operational_counters_count_check", sql`${t.count} > 0`),
  ],
);

export const quickReplies = pgTable(
  "quick_replies",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    text: text("text").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("quick_replies_org_position_unique").on(t.organizationId, t.position),
    check("quick_replies_position_check", sql`${t.position} between 0 and 49`),
    check(
      "quick_replies_text_check",
      sql`length(trim(${t.title})) between 1 and 80 and length(trim(${t.text})) between 1 and 1000`,
    ),
  ],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    task: text("task").notNull(),
    version: text("version").notNull(),
    model: text("model"),
    engine: text("engine").$type<"ai" | "heuristic">().notNull(),
    outcome: text("outcome").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costEstimateEur: doublePrecision("cost_estimate_eur").notNull().default(0),
    reservedEur: doublePrecision("reserved_eur").notNull().default(0),
    manipulationAttempts: integer("manipulation_attempts").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    day: text("day").notNull(),
  },
  (t) => [
    index("ai_usage_org_day_idx").on(t.organizationId, t.day),
    check(
      "ai_usage_nonnegative",
      sql`${t.costEstimateEur} >= 0 and ${t.reservedEur} >= 0 and ${t.inputTokens} >= 0 and ${t.outputTokens} >= 0`,
    ),
    check("ai_usage_engine", sql`${t.engine} in ('ai', 'heuristic')`),
  ],
);
