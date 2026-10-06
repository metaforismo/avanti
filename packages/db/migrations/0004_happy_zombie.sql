ALTER TABLE "cases" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "deleted_case_id" text;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "operators" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "cases" SET "closed_at" = "updated_at" WHERE "status" = 'closed';
