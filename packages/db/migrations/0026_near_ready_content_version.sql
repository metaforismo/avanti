ALTER TABLE "cases" ADD COLUMN "content_version" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Evaluations, blind reviews and events written so far are keyed by updated_at: the current
-- updated_at is the content those rows refer to. Runs before the new triggers exist.
UPDATE cases SET content_version = updated_at;
--> statement-breakpoint
-- Fail-safe classification: every write that advances updated_at changes the content, unless
-- the transaction declared operator work (presa in carico, revisione delle voci, note, link…).
-- A new writer that forgets the flag therefore withdraws a suggestion, never keeps a stale one.
-- New AI inconsistencies (ai_attention) are published without advancing updated_at but are
-- content too. The column is owned by this trigger: direct writes keep the previous value.
CREATE FUNCTION advance_case_content_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_version := NEW.updated_at;
  ELSIF NEW.ai_attention IS DISTINCT FROM OLD.ai_attention
    OR (NEW.updated_at IS DISTINCT FROM OLD.updated_at
      AND coalesce(current_setting('avanti.operator_work', true), '') <> 'on') THEN
    NEW.content_version := greatest(NEW.updated_at, OLD.content_version + interval '1 millisecond');
  ELSE
    NEW.content_version := OLD.content_version;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER cases_content_version BEFORE INSERT OR UPDATE OF updated_at, ai_attention, content_version ON cases FOR EACH ROW EXECUTE FUNCTION advance_case_content_version();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION withdraw_near_ready() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content_version IS DISTINCT FROM OLD.content_version THEN
    WITH withdrawn AS (
      UPDATE near_ready_evaluations SET state = 'withdrawn', current_version = NEW.content_version
      WHERE case_id = NEW.id AND state IN ('suggested','accepted','shadow') AND eligible
      RETURNING id, checked_at
    )
    INSERT INTO near_ready_events (id,evaluation_id,action,actor,at,case_version)
    SELECT md5(random()::text || clock_timestamp()::text || id),id,'withdrawn','system',greatest(clock_timestamp(),checked_at),NEW.content_version FROM withdrawn;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS cases_withdraw_near_ready ON cases;
--> statement-breakpoint
-- UPDATE OF ignores columns changed only by BEFORE triggers: list what the writers set.
CREATE TRIGGER cases_withdraw_near_ready AFTER UPDATE OF updated_at, ai_attention, content_version ON cases FOR EACH ROW EXECUTE FUNCTION withdraw_near_ready();
