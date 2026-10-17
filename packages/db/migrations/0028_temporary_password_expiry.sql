ALTER TABLE "operators" ADD COLUMN "temporary_password_expires_at" timestamp with time zone;--> statement-breakpoint
-- Temporary passwords issued before this change get the same window, starting now.
UPDATE "operators" SET "temporary_password_expires_at" = now() + interval '7 days' WHERE "must_change_password";
