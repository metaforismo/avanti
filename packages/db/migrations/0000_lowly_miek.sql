CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"office_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"reference" text NOT NULL,
	"language" text NOT NULL,
	"practice_id" text,
	"status" text DEFAULT 'intake' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contact" jsonb,
	"citizen_note" text,
	"internal_notes" text,
	"assignee_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"review_started_at" timestamp with time zone,
	"review_completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"first_submission_complete" boolean,
	CONSTRAINT "cases_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "cases_status_check" CHECK ("cases"."status" in ('intake','submitted','in_review','needs_citizen','ready','closed'))
);
--> statement-breakpoint
CREATE TABLE "checklist_reviews" (
	"case_id" text NOT NULL,
	"item_id" text NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"operator_id" text,
	"reviewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "checklist_reviews_case_id_item_id_pk" PRIMARY KEY("case_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"pages" integer,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"checklist_item_id" text,
	"member_id" text,
	"status" text NOT NULL,
	"analysis" jsonb,
	CONSTRAINT "documents_size_check" CHECK ("documents"."size_bytes" >= 0),
	CONSTRAINT "documents_pages_check" CHECK ("documents"."pages" is null or "documents"."pages" > 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text,
	"organization_id" text NOT NULL,
	"actor" text NOT NULL,
	"actor_id" text,
	"type" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization" text NOT NULL,
	"role" text,
	"email" text NOT NULL,
	"phone" text,
	"offices" integer,
	"message" text,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text NOT NULL,
	"case_id" text NOT NULL,
	"role" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"birth_year" integer,
	CONSTRAINT "members_case_id_id_pk" PRIMARY KEY("case_id","id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"original_text" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"phone" text,
	"opening_hours" text,
	CONSTRAINT "offices_slug_unique" UNIQUE("slug"),
	CONSTRAINT "offices_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "operators_email_unique" UNIQUE("email"),
	CONSTRAINT "operators_id_org_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_counters" (
	"organization_id" text NOT NULL,
	"year" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "reference_counters_organization_id_year_pk" PRIMARY KEY("organization_id","year"),
	CONSTRAINT "reference_counters_value_check" CHECK ("reference_counters"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"operator_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"baseline_minutes_per_case" integer,
	"retention_days" integer DEFAULT 180 NOT NULL,
	"link_days" integer DEFAULT 60 NOT NULL,
	CONSTRAINT "settings_days_check" CHECK ("settings"."retention_days" > 0 and "settings"."link_days" > 0),
	CONSTRAINT "settings_baseline_check" CHECK ("settings"."baseline_minutes_per_case" is null or "settings"."baseline_minutes_per_case" > 0)
);
--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_office_org_fk" FOREIGN KEY ("office_id","organization_id") REFERENCES "public"."offices"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assignee_org_fk" FOREIGN KEY ("assignee_id","organization_id") REFERENCES "public"."operators"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_reviews" ADD CONSTRAINT "checklist_reviews_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_reviews" ADD CONSTRAINT "checklist_reviews_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_counters" ADD CONSTRAINT "reference_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cases_org_reference_unique" ON "cases" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "cases_org_status_updated_idx" ON "cases" USING btree ("organization_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "cases_org_office_created_idx" ON "cases" USING btree ("organization_id","office_id","created_at");--> statement-breakpoint
CREATE INDEX "cases_org_assignee_idx" ON "cases" USING btree ("organization_id","assignee_id");--> statement-breakpoint
CREATE INDEX "cases_expires_idx" ON "cases" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "documents_case_idx" ON "documents" USING btree ("case_id","uploaded_at");--> statement-breakpoint
CREATE INDEX "documents_case_sha_idx" ON "documents" USING btree ("case_id","sha256");--> statement-breakpoint
CREATE INDEX "events_case_time_idx" ON "events" USING btree ("case_id","at");--> statement-breakpoint
CREATE INDEX "events_org_type_time_idx" ON "events" USING btree ("organization_id","type","at");--> statement-breakpoint
CREATE INDEX "messages_case_time_idx" ON "messages" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "offices_org_idx" ON "offices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "operators_org_idx" ON "operators" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");