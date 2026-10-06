ALTER TABLE cases ADD COLUMN editing_question text;
--> statement-breakpoint
CREATE TEMP TABLE avanti_stable_members AS
SELECT c.id AS case_id, a.position,
  coalesce(a.value->>'id', 'm_' || (a.value->>'role') || '_' ||
    (row_number() OVER (PARTITION BY c.id, a.value->>'role' ORDER BY a.position) - 1)::text) AS old_id,
  gen_random_uuid()::text AS new_id,
  NOT (a.value ? 'id') AND count(*) OVER (PARTITION BY c.id, a.value->>'role', a.value->>'firstName', coalesce(a.value->>'lastName', ''), coalesce(a.value->>'birthYear', '')) > 1 AS ambiguous
FROM cases c
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.answers->'members') = 'array' THEN c.answers->'members' ELSE '[]'::jsonb END) WITH ORDINALITY a(value, position);
--> statement-breakpoint
-- The already-applied old migration discarded the information needed to recover ambiguous owners.
UPDATE documents d SET member_id = NULL, checklist_item_id = NULL
FROM avanti_stable_members r WHERE r.ambiguous AND d.case_id = r.case_id
  AND (d.member_id = r.old_id OR right(d.checklist_item_id, length(r.old_id)) = r.old_id);
--> statement-breakpoint
DELETE FROM checklist_reviews v USING avanti_stable_members r
WHERE r.ambiguous AND v.case_id = r.case_id AND right(v.item_id, length(r.old_id)) = r.old_id;
--> statement-breakpoint
UPDATE cases c SET answers = jsonb_set(c.answers, '{members}', (
  SELECT jsonb_agg(a.value || jsonb_build_object('id', r.new_id) ORDER BY a.position)
  FROM jsonb_array_elements(c.answers->'members') WITH ORDINALITY a(value, position)
  JOIN avanti_stable_members r ON r.case_id = c.id AND r.position = a.position
)) WHERE EXISTS (SELECT 1 FROM avanti_stable_members r WHERE r.case_id = c.id);
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM avanti_stable_members LOOP
    UPDATE documents SET member_id = r.new_id WHERE case_id = r.case_id AND member_id = r.old_id;
    UPDATE documents SET checklist_item_id = left(checklist_item_id, length(checklist_item_id) - length(r.old_id)) || r.new_id
      WHERE case_id = r.case_id AND right(checklist_item_id, length(r.old_id)) = r.old_id;
    UPDATE checklist_reviews SET item_id = left(item_id, length(item_id) - length(r.old_id)) || r.new_id
      WHERE case_id = r.case_id AND right(item_id, length(r.old_id)) = r.old_id;
    UPDATE cases SET answers = (
      SELECT jsonb_object_agg(
        CASE WHEN right(key, length(r.old_id)) = r.old_id THEN left(key, length(key) - length(r.old_id)) || r.new_id ELSE key END,
        CASE WHEN value = to_jsonb(r.old_id::text) THEN to_jsonb(r.new_id::text)
          WHEN jsonb_typeof(value) = 'array' THEN coalesce((SELECT jsonb_agg(CASE WHEN element = to_jsonb(r.old_id::text) THEN to_jsonb(r.new_id::text) ELSE element END) FROM jsonb_array_elements(value) element), '[]'::jsonb)
          ELSE value END)
      FROM jsonb_each(answers)
    ) WHERE id = r.case_id;
  END LOOP;
END $$;
--> statement-breakpoint
DROP TABLE avanti_stable_members;
--> statement-breakpoint
UPDATE cases SET confirmed_answers = coalesce((SELECT jsonb_agg(key ORDER BY key) FROM jsonb_object_keys(answers) key), '[]'::jsonb);
