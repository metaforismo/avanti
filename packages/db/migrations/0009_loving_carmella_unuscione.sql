CREATE TABLE "operational_counters" (
	"organization_id" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"metric" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "operational_counters_organization_id_hour_metric_pk" PRIMARY KEY("organization_id","hour","metric"),
	CONSTRAINT "operational_counters_metric_check" CHECK ("operational_counters"."metric" in ('ai_success','ai_fallback','ai_error','api_error')),
	CONSTRAINT "operational_counters_count_check" CHECK ("operational_counters"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE "system_jobs" (
	"kind" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" text NOT NULL,
	CONSTRAINT "system_jobs_kind_check" CHECK ("system_jobs"."kind" in ('maintenance','retention')),
	CONSTRAINT "system_jobs_outcome_check" CHECK ("system_jobs"."outcome" in ('running','ok','failed'))
);
--> statement-breakpoint
ALTER TABLE "operational_counters" ADD CONSTRAINT "operational_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operational_counters_hour_idx" ON "operational_counters" USING btree ("hour");