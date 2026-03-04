-- Attendance tracking by event registration
ALTER TABLE registros
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_registros_template_attended
  ON registros(template_id, attended_at);
