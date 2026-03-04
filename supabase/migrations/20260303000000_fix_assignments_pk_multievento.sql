-- Fix legacy PK that made seat_id globally unique across all events.
-- We now enforce uniqueness by (template_id, seat_id) for multievent support.

ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_template_seat_unique
  ON assignments(template_id, seat_id)
  WHERE template_id IS NOT NULL;
