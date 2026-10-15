ALTER TABLE "cases" ADD COLUMN "family_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reused_from_year" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reused_member" jsonb;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "citizen_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "cases_org_family_idx" ON "cases" USING btree ("organization_id","family_id");--> statement-breakpoint
CREATE INDEX "documents_storage_key_idx" ON "documents" USING btree ("storage_key");