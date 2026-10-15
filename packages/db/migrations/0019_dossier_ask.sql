CREATE TABLE "dossier_chat_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"operator_id" text NOT NULL,
	"question" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"case_version" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dossier_chat_turns" ADD CONSTRAINT "dossier_chat_turns_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_chat_turns" ADD CONSTRAINT "dossier_chat_turns_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dossier_chat_scope_time_idx" ON "dossier_chat_turns" USING btree ("case_id","operator_id","created_at","id");