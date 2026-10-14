ALTER TABLE "events" DROP CONSTRAINT "events_case_id_cases_id_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_case_org_fk";
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "case_reference" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "subject_operator_id" text;--> statement-breakpoint
UPDATE "events" e SET "case_reference" = c."reference" FROM "cases" c
WHERE e."case_id" = c."id" AND e."organization_id" = c."organization_id";
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_org_fk" FOREIGN KEY ("case_id","organization_id") REFERENCES "public"."cases"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_org_time_id_idx" ON "events" USING btree ("organization_id","at","id");--> statement-breakpoint
CREATE INDEX "events_at_id_idx" ON "events" USING btree ("at","id");--> statement-breakpoint
CREATE INDEX "events_org_reference_time_idx" ON "events" USING btree ("organization_id","case_reference","at","id");--> statement-breakpoint
CREATE INDEX "events_org_actor_time_idx" ON "events" USING btree ("organization_id","actor_id","at","id");--> statement-breakpoint
CREATE INDEX "events_org_subject_time_idx" ON "events" USING btree ("organization_id","subject_operator_id","at","id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_scope_check" CHECK ("events"."organization_id" is not null or ("events"."type" = 'auth.login_failed' and "events"."actor" = 'system' and "events"."actor_id" is null and "events"."subject_operator_id" is null and "events"."case_id" is null and "events"."deleted_case_id" is null and "events"."case_reference" is null));
