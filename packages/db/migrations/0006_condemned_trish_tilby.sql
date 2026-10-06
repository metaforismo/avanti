CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "cases_reference_search_idx" ON "cases" USING gin ("reference" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "cases_contact_search_idx" ON "cases" USING gin ((coalesce("contact"->>'firstName','') || ' ' || coalesce("contact"->>'lastName','')) gin_trgm_ops);
--> statement-breakpoint
UPDATE sessions SET expires_at = least(expires_at, now() + interval '30 minutes');
