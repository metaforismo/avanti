ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "renewal_source_id" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "renewal_year" integer;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "renewal_household_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "renewal_invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "renewal_contact_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "citizen_link_hash" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "notify_citizen_renewals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cases_renewal_source_year_unique" ON "cases" USING btree ("organization_id","renewal_source_id","renewal_year");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_renewal_check" CHECK (("cases"."renewal_source_id" is null and "cases"."renewal_year" is null and "cases"."renewal_household_confirmed_at" is null and "cases"."renewal_invited_at" is null) or ("cases"."renewal_source_id" is not null and "cases"."renewal_year" is not null and "cases"."practice_id" is not null and "cases"."renewal_year" between 2021 and 2100 and "cases"."practice_id" = 'isee_ordinario' and "cases"."family_id" is not null));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_renewal_check" CHECK ("notifications"."kind" <> 'citizen_renewal' or ("notifications"."citizen_link_hash" is not null and "notifications"."case_id" is not null and "notifications"."organization_id" is not null));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('pilot_lead', 'citizen_request', 'citizen_ready', 'citizen_submission', 'citizen_reminder', 'citizen_renewal', 'operator_digest'));