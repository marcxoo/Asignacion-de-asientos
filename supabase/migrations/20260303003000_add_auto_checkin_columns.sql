-- Automatic seat QR check-in tracking
ALTER TABLE registros
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_seat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_registros_template_checked_in
  ON registros(template_id, checked_in_at);
