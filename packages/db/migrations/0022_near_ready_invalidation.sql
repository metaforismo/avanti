CREATE OR REPLACE FUNCTION withdraw_near_ready() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at
    OR NEW.ai_attention IS DISTINCT FROM OLD.ai_attention THEN
    WITH withdrawn AS (
      UPDATE near_ready_evaluations SET state = 'withdrawn', current_version = NEW.updated_at
      WHERE case_id = NEW.id AND state IN ('suggested','accepted','shadow') AND eligible
      RETURNING id, checked_at
    )
    INSERT INTO near_ready_events (id,evaluation_id,action,actor,at,case_version)
    SELECT md5(random()::text || clock_timestamp()::text || id),id,'withdrawn','system',greatest(clock_timestamp(),checked_at),NEW.updated_at FROM withdrawn;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS cases_withdraw_near_ready ON cases;
--> statement-breakpoint
CREATE TRIGGER cases_withdraw_near_ready AFTER UPDATE OF updated_at, ai_attention ON cases FOR EACH ROW EXECUTE FUNCTION withdraw_near_ready();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION invalidate_near_ready_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.near_ready_mode, NEW.near_ready_critical_threshold, NEW.near_ready_other_threshold, NEW.near_ready_suspended_at, NEW.ai_copilot, NEW.ai_monthly_budget_eur)
    IS DISTINCT FROM (OLD.near_ready_mode, OLD.near_ready_critical_threshold, OLD.near_ready_other_threshold, OLD.near_ready_suspended_at, OLD.ai_copilot, OLD.ai_monthly_budget_eur) THEN
    -- API versions use ISO instants with millisecond precision; PostgreSQL clocks also have microseconds.
    UPDATE cases SET updated_at = greatest(date_trunc('milliseconds', updated_at) + interval '1 millisecond', date_trunc('milliseconds', clock_timestamp()))
      WHERE organization_id = NEW.organization_id AND status IN ('submitted','in_review','needs_citizen');
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
-- Advance existing fractional versions, withdrawing their suggestions instead of reusing stale evidence.
UPDATE cases SET updated_at = date_trunc('milliseconds', updated_at) + interval '1 millisecond'
  WHERE updated_at IS DISTINCT FROM date_trunc('milliseconds', updated_at);
