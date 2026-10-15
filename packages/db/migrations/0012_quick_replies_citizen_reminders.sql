CREATE TABLE "quick_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "quick_replies_org_position_unique" UNIQUE("organization_id","position"),
	CONSTRAINT "quick_replies_position_check" CHECK ("quick_replies"."position" between 0 and 49),
	CONSTRAINT "quick_replies_text_check" CHECK (length(trim("quick_replies"."title")) between 1 and 80 and length(trim("quick_replies"."text")) between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "citizen_request_id" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "citizen_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "citizen_reminders_queued" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "citizen_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "citizen_request_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "reminder_number" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "notify_citizen_reminders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "citizen_reminder_days" jsonb DEFAULT '[3,4]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cases_citizen_reminders_idx" ON "cases" USING btree ("citizen_requested_at","id") WHERE "cases"."status" = 'needs_citizen' and "cases"."citizen_request_id" is not null;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_reminders_check" CHECK ("cases"."citizen_reminders_queued" between 0 and 2);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reminder_check" CHECK ("notifications"."kind" <> 'citizen_reminder' or
      ("notifications"."citizen_request_id" is not null and "notifications"."reminder_number" is not null
       and "notifications"."reminder_number" between 1 and 2 and "notifications"."case_id" is not null and "notifications"."organization_id" is not null));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('pilot_lead', 'citizen_request', 'citizen_ready', 'citizen_reminder', 'operator_digest'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_reminder_days_check" CHECK (jsonb_typeof("settings"."citizen_reminder_days") = 'array'
      and jsonb_array_length("settings"."citizen_reminder_days") between 1 and 2
      and not jsonb_path_exists("settings"."citizen_reminder_days", '$[*] ? (@.type() != "number" || @ < 1 || @ > 30 || @ != @.floor())'));