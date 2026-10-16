CREATE TABLE "commercial_usage" (
	"organization_id" text NOT NULL,
	"office_id" text NOT NULL,
	"month" text NOT NULL,
	"started" integer DEFAULT 0 NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "commercial_usage_organization_id_month_office_id_pk" PRIMARY KEY("organization_id","month","office_id"),
	CONSTRAINT "commercial_usage_counts_check" CHECK ("commercial_usage"."started" >= 0 and "commercial_usage"."delivered" >= 0),
	CONSTRAINT "commercial_usage_month_check" CHECK ("commercial_usage"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "usage_quota_alerts" (
	"organization_id" text NOT NULL,
	"month" text NOT NULL,
	"threshold" integer NOT NULL,
	"cap" integer NOT NULL,
	"delivered" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "usage_quota_alerts_organization_id_month_threshold_pk" PRIMARY KEY("organization_id","month","threshold"),
	CONSTRAINT "usage_quota_threshold_check" CHECK ("usage_quota_alerts"."threshold" in (70,90,100))
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "office_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "office_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "metering_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "monthly_delivery_cap" integer;--> statement-breakpoint
ALTER TABLE "commercial_usage" ADD CONSTRAINT "commercial_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_quota_alerts" ADD CONSTRAINT "usage_quota_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('pilot_lead', 'citizen_request', 'citizen_ready', 'citizen_submission', 'citizen_reminder', 'citizen_renewal', 'operator_digest', 'usage_quota'));--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_delivery_cap_check" CHECK ("settings"."monthly_delivery_cap" is null or "settings"."monthly_delivery_cap" > 0);--> statement-breakpoint
-- DDL and backfill share the migration transaction; writers cannot slip between them.
LOCK TABLE cases IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
UPDATE organizations SET metering_excluded = true WHERE id = 'demo-caf-milano';
--> statement-breakpoint
UPDATE events e SET office_id = c.office_id FROM cases c
WHERE e.case_id = c.id AND e.organization_id = c.organization_id;
--> statement-breakpoint
INSERT INTO commercial_usage (organization_id, office_id, month, started, delivered)
SELECT organization_id, coalesce(office_id, ''), month, sum(started)::int, sum(delivered)::int
FROM (
  SELECT c.organization_id, c.office_id,
    to_char(c.created_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM') AS month, 1 AS started, 0 AS delivered
  FROM cases c JOIN organizations o ON o.id = c.organization_id WHERE NOT o.metering_excluded
  UNION ALL
  SELECT c.organization_id, c.office_id,
    to_char(c.submitted_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM'), 0, 1
  FROM cases c JOIN organizations o ON o.id = c.organization_id
  WHERE c.submitted_at IS NOT NULL AND NOT o.metering_excluded
  UNION ALL
  -- Erased cases can only be recovered when a surviving audit proves the creation/first send.
  -- Their former office is unknown: do not allocate it to an arbitrary existing office.
  SELECT e.organization_id, '__unattributed__',
    to_char(min(e.at) AT TIME ZONE 'Europe/Rome', 'YYYY-MM'),
    CASE WHEN e.type = 'case.created' THEN 1 ELSE 0 END,
    CASE WHEN e.type = 'case.submitted' THEN 1 ELSE 0 END
  FROM events e JOIN organizations o ON o.id = e.organization_id
  WHERE NOT o.metering_excluded AND e.deleted_case_id IS NOT NULL
    AND (e.type = 'case.created' OR (e.type = 'case.submitted' AND e.metadata->>'first' = 'true'))
    AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = e.deleted_case_id AND c.organization_id = e.organization_id)
  GROUP BY e.organization_id, e.deleted_case_id, e.type
) history
GROUP BY GROUPING SETS ((organization_id, month), (organization_id, office_id, month));
--> statement-breakpoint
CREATE FUNCTION avanti_meter_case() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  started_month text;
  delivered_month text;
  scope text;
BEGIN
  IF (SELECT metering_excluded FROM organizations WHERE id = NEW.organization_id) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    started_month := to_char(NEW.created_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM');
  END IF;
  IF NEW.submitted_at IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      delivered_month := to_char(NEW.submitted_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM');
    ELSIF OLD.submitted_at IS NULL THEN
      delivered_month := to_char(NEW.submitted_at AT TIME ZONE 'Europe/Rome', 'YYYY-MM');
    END IF;
  END IF;
  -- Always lock the organization total first, including submissions to different offices.
  FOREACH scope IN ARRAY ARRAY['', NEW.office_id] LOOP
    IF started_month IS NOT NULL THEN
      INSERT INTO commercial_usage (organization_id, office_id, month, started, delivered)
      VALUES (NEW.organization_id, scope, started_month, 1, 0)
      ON CONFLICT (organization_id, month, office_id)
      DO UPDATE SET started = commercial_usage.started + 1;
    END IF;
    IF delivered_month IS NOT NULL THEN
      INSERT INTO commercial_usage (organization_id, office_id, month, started, delivered)
      VALUES (NEW.organization_id, scope, delivered_month, 0, 1)
      ON CONFLICT (organization_id, month, office_id)
      DO UPDATE SET delivered = commercial_usage.delivered + 1;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER commercial_case_meter AFTER INSERT OR UPDATE OF submitted_at ON cases
FOR EACH ROW EXECUTE FUNCTION avanti_meter_case();
