CREATE TABLE "near_ready_blind_reviews" (
	"case_id" text NOT NULL,
	"case_version" timestamp with time zone NOT NULL,
	"operator_id" text NOT NULL,
	"ready" boolean NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "near_ready_blind_reviews_case_id_case_version_operator_id_pk" PRIMARY KEY("case_id","case_version","operator_id")
);
--> statement-breakpoint
CREATE TABLE "near_ready_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"case_version" timestamp with time zone NOT NULL,
	"current_version" timestamp with time zone NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"eligible" boolean NOT NULL,
	"mode" text NOT NULL,
	"state" text NOT NULL,
	"language" text NOT NULL,
	"reading" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"dismissal_note" text,
	CONSTRAINT "near_ready_case_version_unique" UNIQUE("case_id","case_version"),
	CONSTRAINT "near_ready_state_check" CHECK ("near_ready_evaluations"."state" in ('suggested','not_eligible','withdrawn','accepted','dismissed','shadow')),
	CONSTRAINT "near_ready_mode_check" CHECK ("near_ready_evaluations"."mode" in ('off','shadow','visible'))
);
--> statement-breakpoint
CREATE TABLE "near_ready_events" (
	"id" text PRIMARY KEY NOT NULL,
	"evaluation_id" text NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"actor_id" text,
	"at" timestamp with time zone NOT NULL,
	"case_version" timestamp with time zone NOT NULL,
	"reason" text,
	"ready" boolean,
	"duration_minutes" double precision,
	CONSTRAINT "near_ready_action_check" CHECK ("near_ready_events"."action" in ('evaluated','proposed','withdrawn','viewed','accepted','dismissed','blind_review','final_decision','critical_error')),
	CONSTRAINT "near_ready_reason_check" CHECK ("near_ready_events"."reason" is null or "near_ready_events"."reason" in ('identity','household','document_match','year','amount','other','missing_document'))
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "near_ready_mode" text DEFAULT 'shadow' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "near_ready_critical_threshold" double precision DEFAULT 0.98 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "near_ready_other_threshold" double precision DEFAULT 0.95 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "near_ready_suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "near_ready_blind_reviews" ADD CONSTRAINT "near_ready_blind_reviews_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_ready_blind_reviews" ADD CONSTRAINT "near_ready_blind_reviews_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_ready_evaluations" ADD CONSTRAINT "near_ready_evaluations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_ready_events" ADD CONSTRAINT "near_ready_events_evaluation_id_near_ready_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."near_ready_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "near_ready_case_time_idx" ON "near_ready_evaluations" USING btree ("case_id","checked_at");--> statement-breakpoint
CREATE INDEX "near_ready_events_eval_idx" ON "near_ready_events" USING btree ("evaluation_id","at");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_near_ready_mode_check" CHECK ("settings"."near_ready_mode" in ('off','shadow','visible'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_near_ready_threshold_check" CHECK ("settings"."near_ready_critical_threshold" between 0 and 1 and "settings"."near_ready_other_threshold" between 0 and 1);--> statement-breakpoint
-- Every case writer, including workers and future routes, shares this invalidation boundary.
CREATE FUNCTION withdraw_near_ready() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    WITH withdrawn AS (
      UPDATE near_ready_evaluations SET state = 'withdrawn', current_version = NEW.updated_at
      WHERE case_id = NEW.id AND state IN ('suggested','accepted','shadow') AND eligible
      RETURNING id
    )
    INSERT INTO near_ready_events (id,evaluation_id,action,actor,at,case_version)
    SELECT md5(random()::text || clock_timestamp()::text || id),id,'withdrawn','system',NEW.updated_at,NEW.updated_at FROM withdrawn;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER cases_withdraw_near_ready AFTER UPDATE OF updated_at ON cases FOR EACH ROW EXECUTE FUNCTION withdraw_near_ready();
--> statement-breakpoint
CREATE FUNCTION invalidate_near_ready_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.near_ready_mode, NEW.near_ready_critical_threshold, NEW.near_ready_other_threshold, NEW.near_ready_suspended_at, NEW.ai_copilot, NEW.ai_monthly_budget_eur)
    IS DISTINCT FROM (OLD.near_ready_mode, OLD.near_ready_critical_threshold, OLD.near_ready_other_threshold, OLD.near_ready_suspended_at, OLD.ai_copilot, OLD.ai_monthly_budget_eur) THEN
    UPDATE cases SET updated_at = greatest(updated_at + interval '1 millisecond', clock_timestamp())
      WHERE organization_id = NEW.organization_id AND status IN ('submitted','in_review','needs_citizen');
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER settings_invalidate_near_ready AFTER UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION invalidate_near_ready_policy();
