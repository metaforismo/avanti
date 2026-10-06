CREATE TABLE "storage_deletions" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TEMP TABLE avanti_member_remap AS
WITH answer_members AS (
  SELECT c.id AS case_id, a.value, a.position,
    row_number() OVER (PARTITION BY c.id, a.value->>'role' ORDER BY a.position) - 1 AS role_position,
    row_number() OVER (PARTITION BY c.id, a.value->>'role', a.value->>'firstName', coalesce(a.value->>'lastName', ''), coalesce(a.value->>'birthYear', '') ORDER BY a.position) AS occurrence
  FROM cases c
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.answers->'members') = 'array' THEN c.answers->'members' ELSE '[]'::jsonb END) WITH ORDINALITY a(value, position)
), stored_members AS (
  SELECT m.*, row_number() OVER (PARTITION BY case_id, role, first_name, coalesce(last_name, ''), coalesce(birth_year::text, '')
    ORDER BY substring(id from '[0-9]+$')::integer NULLS LAST, id) AS occurrence
  FROM members m
)
SELECT a.case_id, a.position, m.id AS old_id, 'm_' || (a.value->>'role') || '_' || a.role_position::text AS new_id
FROM answer_members a JOIN stored_members m
  ON m.case_id = a.case_id AND m.role = a.value->>'role'
  AND m.first_name = a.value->>'firstName'
  AND coalesce(m.last_name, '') = coalesce(a.value->>'lastName', '')
  AND coalesce(m.birth_year::text, '') = coalesce(a.value->>'birthYear', '')
  AND m.occurrence = a.occurrence;
--> statement-breakpoint
UPDATE documents d SET member_id = r.new_id FROM avanti_member_remap r
WHERE d.case_id = r.case_id AND d.member_id = r.old_id;
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM avanti_member_remap LOOP
    UPDATE documents SET checklist_item_id = replace(checklist_item_id, r.old_id, r.new_id)
    WHERE case_id = r.case_id;
    UPDATE checklist_reviews SET item_id = replace(item_id, r.old_id, r.new_id)
    WHERE case_id = r.case_id;
    UPDATE cases SET answers = (
      SELECT jsonb_object_agg(replace(key, r.old_id, r.new_id),
        CASE WHEN value = to_jsonb(r.old_id::text) THEN to_jsonb(r.new_id::text)
          WHEN jsonb_typeof(value) = 'array' THEN coalesce((SELECT jsonb_agg(CASE WHEN element = to_jsonb(r.old_id::text) THEN to_jsonb(r.new_id::text) ELSE element END) FROM jsonb_array_elements(value) element), '[]'::jsonb)
          ELSE value END)
      FROM jsonb_each(answers)
    ) WHERE id = r.case_id;
  END LOOP;
END $$;
--> statement-breakpoint
UPDATE cases c SET answers = jsonb_set(answers, '{members}', (
  SELECT jsonb_agg(a.value || jsonb_build_object('id', r.new_id) ORDER BY a.position)
  FROM jsonb_array_elements(c.answers->'members') WITH ORDINALITY a(value, position)
  JOIN avanti_member_remap r ON r.case_id = c.id AND r.position = a.position
)) WHERE EXISTS (SELECT 1 FROM avanti_member_remap r WHERE r.case_id = c.id);
--> statement-breakpoint
DROP TABLE avanti_member_remap;
--> statement-breakpoint
DROP TABLE "members" CASCADE;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "confirmed_answers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE cases SET confirmed_answers = coalesce((SELECT jsonb_agg(key ORDER BY key) FROM jsonb_object_keys(answers) key), '[]'::jsonb);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE sessions SET expires_at = least(expires_at, now());
