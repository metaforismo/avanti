CREATE TABLE "idempotency_keys" (
	"case_id" text NOT NULL,
	"actor" text NOT NULL,
	"key" text NOT NULL,
	"route" text NOT NULL,
	"fingerprint" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_case_id_actor_key_pk" PRIMARY KEY("case_id","actor","key")
);
--> statement-breakpoint
ALTER TABLE "near_ready_events" DROP CONSTRAINT "near_ready_reason_check";--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "near_ready_events" ADD CONSTRAINT "near_ready_reason_check" CHECK ("near_ready_events"."reason" is null or "near_ready_events"."reason" in ('identity','household','document_match','year','amount','other','missing_document','integration_requested'));