ALTER TABLE "documents" ADD COLUMN "analysis_lease_token" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "analysis_lease_until" timestamp with time zone;