CREATE TABLE "copilot_cache" (
	"case_id" text NOT NULL,
	"case_version" timestamp with time zone NOT NULL,
	"task" text NOT NULL,
	"payload" jsonb,
	"lease_token" text NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	CONSTRAINT "copilot_cache_case_id_case_version_task_pk" PRIMARY KEY("case_id","case_version","task")
);
--> statement-breakpoint
CREATE TABLE "prefill_decisions" (
	"case_id" text NOT NULL,
	"field_id" text NOT NULL,
	"field" jsonb NOT NULL,
	"document_hash" text NOT NULL,
	"decision" text NOT NULL,
	"operator_id" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "prefill_decisions_case_id_field_id_pk" PRIMARY KEY("case_id","field_id"),
	CONSTRAINT "prefill_decision_check" CHECK ("prefill_decisions"."decision" in ('accepted','rejected'))
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "ai_attention" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "operator_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_copilot" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_citizen_assistant" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "copilot_cache" ADD CONSTRAINT "copilot_cache_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prefill_decisions" ADD CONSTRAINT "prefill_decisions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;