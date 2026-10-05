ALTER TABLE "cases" ADD CONSTRAINT "cases_id_org_unique" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_org_fk" FOREIGN KEY ("case_id","organization_id") REFERENCES "public"."cases"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_language_check" CHECK ("cases"."language" in ('it', 'en', 'fr', 'es', 'ro', 'uk', 'ar', 'bn'));--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_practice_check" CHECK ("cases"."practice_id" is null or "cases"."practice_id" in ('isee_ordinario', 'isee_universitario', 'modello_730', 'red', 'assegno_unico', 'successione_semplice', 'permesso_soggiorno', 'cittadinanza', 'naspi'));--> statement-breakpoint
ALTER TABLE "checklist_reviews" ADD CONSTRAINT "checklist_reviews_decision_check" CHECK ("checklist_reviews"."decision" in ('verified', 'rejected', 'waived'));--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_status_check" CHECK ("documents"."status" in ('processing', 'analyzed', 'failed'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_check" CHECK ("events"."actor" in ('citizen', 'operator', 'system', 'ai'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_metadata_check" CHECK (jsonb_typeof("events"."metadata") = 'object' and not jsonb_path_exists("events"."metadata", '$.* ? (@.type() != "number" && @.type() != "boolean" && @.type() != "null")'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_role_check" CHECK ("messages"."role" in ('citizen', 'assistant', 'operator', 'system'));--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_role_check" CHECK ("operators"."role" in ('admin', 'operator'));--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_kind_check" CHECK ("organizations"."kind" in ('caf', 'patronato', 'studio'));--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_count_check" CHECK ("rate_limits"."count" > 0);
