CREATE INDEX "cases_org_updated_idx" ON "cases" USING btree ("organization_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "cases_org_office_updated_idx" ON "cases" USING btree ("organization_id","office_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "cases_org_practice_updated_idx" ON "cases" USING btree ("organization_id","practice_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "cases_org_assignee_updated_idx" ON "cases" USING btree ("organization_id","assignee_id","updated_at","id");--> statement-breakpoint
CREATE INDEX "cases_org_created_idx" ON "cases" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "cases_org_submitted_idx" ON "cases" USING btree ("organization_id","submitted_at");--> statement-breakpoint
CREATE INDEX "cases_org_office_submitted_idx" ON "cases" USING btree ("organization_id","office_id","submitted_at");--> statement-breakpoint
CREATE INDEX "documents_processing_idx" ON "documents" USING btree ("uploaded_at","id") WHERE "documents"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "events_case_type_time_idx" ON "events" USING btree ("case_id","type","at");