ALTER TABLE "operators" ADD COLUMN "mfa_secret" text;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "mfa_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "mfa_last_used_step" bigint;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "mfa_recovery_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "state" text DEFAULT 'authenticated' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_setup_secret" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mfa_setup_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "mfa_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_state_check" CHECK ("sessions"."state" in ('authenticated', 'mfa_pending', 'mfa_setup'));