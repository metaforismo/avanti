CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"task" text NOT NULL,
	"version" text NOT NULL,
	"model" text,
	"engine" text NOT NULL,
	"outcome" text NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_estimate_eur" double precision DEFAULT 0 NOT NULL,
	"reserved_eur" double precision DEFAULT 0 NOT NULL,
	"manipulation_attempts" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"day" text NOT NULL,
	CONSTRAINT "ai_usage_nonnegative" CHECK ("ai_usage"."cost_estimate_eur" >= 0 and "ai_usage"."reserved_eur" >= 0 and "ai_usage"."input_tokens" >= 0 and "ai_usage"."output_tokens" >= 0),
	CONSTRAINT "ai_usage_engine" CHECK ("ai_usage"."engine" in ('ai', 'heuristic'))
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_monthly_budget_eur" double precision;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_org_day_idx" ON "ai_usage" USING btree ("organization_id","day");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_ai_budget_check" CHECK ("settings"."ai_monthly_budget_eur" is null or ("settings"."ai_monthly_budget_eur" >= 0 and "settings"."ai_monthly_budget_eur" <= 100000));