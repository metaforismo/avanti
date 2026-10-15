ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "booking_url" text;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "citizen_note" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "notify_citizen_submission" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('pilot_lead', 'citizen_request', 'citizen_ready', 'citizen_submission', 'citizen_reminder', 'operator_digest'));