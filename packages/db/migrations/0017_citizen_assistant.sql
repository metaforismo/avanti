ALTER TABLE "documents" ADD COLUMN "citizen_kept_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "assistant_metadata" jsonb;