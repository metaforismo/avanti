CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"dedupe_key" text NOT NULL,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"organization_id" text,
	"case_id" text,
	"lead_id" text,
	"operator_id" text,
	"envelope" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"lease_token" text,
	"last_error" text,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('pilot_lead', 'citizen_request', 'citizen_ready', 'operator_digest')),
	CONSTRAINT "notifications_language_check" CHECK ("notifications"."language" in ('it', 'en', 'fr', 'es', 'ro', 'uk', 'ar', 'bn')),
	CONSTRAINT "notifications_state_check" CHECK ("notifications"."state" in ('pending', 'sending', 'sent', 'simulated', 'failed', 'cancelled')),
	CONSTRAINT "notifications_attempts_check" CHECK ("notifications"."attempts" between 0 and 5)
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "notify_citizen_ready" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "notify_operator_digest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_digest_date" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_case_org_fk" FOREIGN KEY ("case_id","organization_id") REFERENCES "public"."cases"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_operator_org_fk" FOREIGN KEY ("operator_id","organization_id") REFERENCES "public"."operators"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_due_idx" ON "notifications" USING btree ("next_attempt_at","id") WHERE "notifications"."state" = 'pending' or "notifications"."state" = 'sending';--> statement-breakpoint
CREATE INDEX "notifications_case_idx" ON "notifications" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "notifications_completed_idx" ON "notifications" USING btree ("completed_at");